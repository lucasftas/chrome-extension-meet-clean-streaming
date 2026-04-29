/**
 * Meet Split for Broadcast - Content Script
 *
 * Roda em 2 contextos:
 *  1. Janela principal do Meet (meet.google.com/...)
 *     -> selection mode + split/solo modes + clones em document.body
 *  2. Popup nativa do Meet ("Abrir em uma nova janela" do screenshare)
 *     -> apenas limpa UI residual + maximiza video
 *
 * Detecção: window.opener != null + URL "about:blank" (Document PiP) OU
 * URL meet.google.com sem layout normal de sala.
 */

(function () {
  'use strict';

  const LOG_PREFIX = '[MSB]';

  // ==============================================================
  // PATH 1: Popup nativa do Meet (slide em janela separada)
  // ==============================================================
  // Detecta: temos window.opener (popup) e nao temos a UI normal do Meet.
  // Aplica CSS de limpeza + permite fullscreen video. Sai sem rodar split.
  const isMeetPopup = (() => {
    try {
      if (!window.opener || window.opener === window) return false;
      const openerHref = window.opener.location?.href || '';
      const isOpenerMeet = openerHref.startsWith('https://meet.google.com/');
      const isAboutBlank = window.location.href === 'about:blank';
      return isOpenerMeet || isAboutBlank;
    } catch {
      return window.location.href === 'about:blank' && !!window.opener;
    }
  })();

  if (isMeetPopup) {
    console.log(LOG_PREFIX, 'Popup do Meet detectada em', window.location.href);

    // Sinaliza pra janela principal que ha popup ativa - usado pra suprimir
    // o auto-redetect SLIDES enquanto o screenshare esta na popup.
    function setPopupFlag() {
      chrome.storage.local.set({ msb_popup_open_at: Date.now() }).catch(() => {});
    }
    setPopupFlag();
    // Heartbeat (caso o beforeunload nao dispare por algum motivo)
    const popupHeartbeat = setInterval(setPopupFlag, 5000);
    window.addEventListener('beforeunload', () => {
      clearInterval(popupHeartbeat);
      chrome.storage.local.remove('msb_popup_open_at').catch(() => {});
    });
    window.addEventListener('pagehide', () => {
      clearInterval(popupHeartbeat);
      chrome.storage.local.remove('msb_popup_open_at').catch(() => {});
    });

    let popupClone = null;

    function pickLiveVideo() {
      // Pega o <video> original (nao clone) com srcObject, de maior area visual
      const videos = Array.from(document.querySelectorAll('video:not([data-msb-clone])'));
      let best = null;
      let bestArea = 0;
      for (const v of videos) {
        if (!v.srcObject) continue;
        const r = v.getBoundingClientRect();
        const area = Math.max(r.width * r.height, v.videoWidth * v.videoHeight);
        if (area > bestArea) {
          bestArea = area;
          best = v;
        }
      }
      return best;
    }

    function syncPopupClone() {
      if (!document.body) return;
      document.body.dataset.msbMeetPopup = 'true';

      const original = pickLiveVideo();

      // Garante clone no DOM
      if (!popupClone || !popupClone.isConnected) {
        if (popupClone) {
          popupClone.srcObject = null;
        }
        popupClone = document.createElement('video');
        popupClone.autoplay = true;
        popupClone.playsInline = true;
        popupClone.muted = true;
        popupClone.dataset.msbClone = 'popup';
        document.body.appendChild(popupClone);
        console.log(LOG_PREFIX, 'Clone popup criado.');
      }

      const newStream = original ? original.srcObject : null;
      if (popupClone.srcObject !== newStream) {
        popupClone.srcObject = newStream;
        console.log(LOG_PREFIX, `Clone popup: stream ${newStream ? 'atribuida' : 'limpa'}.`);
      }
    }

    // Roda quando body existe + a cada mutacao significativa
    function bootPopup() {
      syncPopupClone();
      let pending = false;
      function schedule() {
        if (pending) return;
        pending = true;
        requestAnimationFrame(() => {
          pending = false;
          syncPopupClone();
        });
      }
      const obs = new MutationObserver(schedule);
      obs.observe(document.documentElement, { childList: true, subtree: true });

      // Listeners de stream em videos novos
      function attach(v) {
        if (v._msbListened || v.dataset.msbClone) return;
        v._msbListened = true;
        v.addEventListener('loadedmetadata', schedule);
        v.addEventListener('emptied', schedule);
      }
      document.querySelectorAll('video').forEach(attach);
      new MutationObserver((muts) => {
        for (const m of muts) {
          m.addedNodes.forEach(n => {
            if (n.nodeType !== 1) return;
            if (n.tagName === 'VIDEO') attach(n);
            else if (n.querySelectorAll) n.querySelectorAll('video').forEach(attach);
          });
        }
      }).observe(document.documentElement, { childList: true, subtree: true });
    }

    if (document.body) {
      bootPopup();
    } else {
      document.addEventListener('DOMContentLoaded', bootPopup);
      // fallback: se body aparecer antes do DOMContentLoaded
      const waitObs = new MutationObserver(() => {
        if (document.body) {
          waitObs.disconnect();
          bootPopup();
        }
      });
      waitObs.observe(document.documentElement, { childList: true });
    }
    return;
  }

  // ==============================================================
  // PATH 2: Janela principal do Meet
  // ==============================================================

  const STORAGE_KEYS = {
    cam: 'msb_cam_pid',
    slides: 'msb_slides_pid',
    mode: 'msb_mode',
    splitActiveLegacy: 'msb_split_active'
  };

  const VALID_MODES = ['off', 'split', 'solo-cam', 'solo-slides'];

  const state = {
    camPid: null,
    slidesPid: null,
    mode: 'off',
    selectionMode: null
  };

  const cloneNodes = {
    cam: null,
    slides: null
  };

  function log(...args) {
    console.log(LOG_PREFIX, ...args);
  }

  // ================== Storage ==================

  async function loadState() {
    const data = await chrome.storage.local.get([
      STORAGE_KEYS.cam,
      STORAGE_KEYS.slides,
      STORAGE_KEYS.mode,
      STORAGE_KEYS.splitActiveLegacy
    ]);
    state.camPid = data[STORAGE_KEYS.cam] || null;
    state.slidesPid = data[STORAGE_KEYS.slides] || null;

    // Migracao: se nao tem msb_mode mas tem msb_split_active, converte
    if (data[STORAGE_KEYS.mode] && VALID_MODES.includes(data[STORAGE_KEYS.mode])) {
      state.mode = data[STORAGE_KEYS.mode];
    } else if (data[STORAGE_KEYS.splitActiveLegacy]) {
      state.mode = 'split';
    } else {
      state.mode = 'off';
    }

    log('Estado carregado:', state);
    applyMarks();
    applyModeClass();
  }

  async function saveState() {
    await chrome.storage.local.set({
      [STORAGE_KEYS.cam]: state.camPid,
      [STORAGE_KEYS.slides]: state.slidesPid,
      [STORAGE_KEYS.mode]: state.mode
    });
  }

  // ================== Marcacao via data-participant-id ==================

  function findParticipantId(el) {
    let cur = el;
    while (cur && cur.nodeType === 1) {
      if (cur.dataset && cur.dataset.participantId) {
        return cur.dataset.participantId;
      }
      cur = cur.parentElement;
    }
    return null;
  }

  function findTileByPid(pid) {
    if (!pid) return null;
    return document.querySelector(`[data-participant-id="${CSS.escape(pid)}"]`);
  }

  /**
   * Cache local da flag "popup do slide aberta" (setada pelo content_script
   * da popup). Atualizado em tempo real via chrome.storage.onChanged. Usado
   * pra suprimir auto-redetect enquanto o slide esta na popup nativa.
   */
  let popupOpenCached = false;
  chrome.storage.local.get('msb_popup_open_at').then(d => {
    if (d.msb_popup_open_at && (Date.now() - d.msb_popup_open_at) < 30_000) {
      popupOpenCached = true;
    }
  }).catch(() => {});
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && 'msb_popup_open_at' in changes) {
      popupOpenCached = !!changes.msb_popup_open_at.newValue;
      log(`Popup ${popupOpenCached ? 'aberta' : 'fechada'} (flag de storage).`);
    }
  });

  /**
   * Heuristica empirica baseada em DOM real do Meet:
   *  - Cams tem classe `iPFm3e` na sub-arvore (visto em CNjCjf, dkjMxf)
   *  - Cams em layout PIP/destaque tem classe `Gv1mTb-PVLJEc` no <video>
   *  - Screenshares NAO tem nenhuma das duas
   *
   * Classes minificadas mudam entre versoes do Meet - se pararem de
   * funcionar, atualizar com base em snapshot novo do DOM.
   */
  function tileLooksLikeCam(tile) {
    if (tile.querySelector('.iPFm3e')) return true;
    const video = tile.querySelector('video.Gv1mTb-PVLJEc:not([data-msb-clone])');
    if (video) return true;
    return false;
  }

  function findScreenshareCandidate() {
    // Suprimir auto-redetect enquanto slide esta na popup nativa do Meet
    // (slide tile na janela principal perde data-participant-id, e o unico
    // candidato HD que sobra e cam de outro participante - falso positivo).
    if (popupOpenCached) {
      log('Auto-redetect suprimido: popup do slide esta aberta.');
      return null;
    }

    const allTiles = document.querySelectorAll('[data-participant-id]');
    let best = null;
    let bestArea = 0;

    for (const tile of allTiles) {
      const pid = tile.dataset && tile.dataset.participantId;
      if (!pid || pid === state.camPid) continue;

      // Filtro anti-cam: descarta tiles que parecem cam pela heuristica DOM
      if (tileLooksLikeCam(tile)) continue;

      const videos = tile.querySelectorAll('video:not([data-msb-clone])');
      let qualifies = false;
      for (const v of videos) {
        if (v.videoWidth >= 1000) {
          qualifies = true;
          break;
        }
      }
      if (!qualifies) continue;

      const rect = tile.getBoundingClientRect();
      if (rect.width < 300 || rect.height < 200) continue;

      const area = rect.width * rect.height;
      if (area > bestArea) {
        bestArea = area;
        best = { pid, tile };
      }
    }
    return best;
  }

  function markLiveVideosInTile(tile, role) {
    if (!tile) return;
    tile.querySelectorAll('video:not([data-msb-clone])').forEach(v => {
      if (v.srcObject) {
        v.setAttribute('data-msb-role', role);
      }
    });
  }

  function applyMarks() {
    document.querySelectorAll('video[data-msb-role]:not([data-msb-clone])').forEach(v => {
      v.removeAttribute('data-msb-role');
    });

    if (state.camPid) {
      markLiveVideosInTile(findTileByPid(state.camPid), 'cam');
    }

    let slidesTile = state.slidesPid ? findTileByPid(state.slidesPid) : null;
    if (state.slidesPid && !slidesTile) {
      const candidate = findScreenshareCandidate();
      if (candidate) {
        log(`Auto-redetect SLIDES: ${state.slidesPid} (stale) -> ${candidate.pid}`);
        state.slidesPid = candidate.pid;
        saveState();
        slidesTile = candidate.tile;
      }
    }
    markLiveVideosInTile(slidesTile, 'slides');

    syncClones();
  }

  /**
   * Aplica as classes msb-active e msb-mode-* no body baseado em state.mode.
   *
   * - msb-active: presente quando mode != 'off' (overlay preto + clones visiveis)
   * - msb-mode-split: clones em 50/50 lado a lado (CAM esq + SLIDES dir)
   * - msb-mode-solo-cam: apenas clone cam fullscreen, slides hidden
   * - msb-mode-solo-slides: apenas clone slides fullscreen, cam hidden
   */
  function applyModeClass() {
    const body = document.body;
    if (!body) return;
    body.classList.toggle('msb-active', state.mode !== 'off');
    VALID_MODES.forEach(m => {
      body.classList.toggle(`msb-mode-${m}`, state.mode === m);
    });
    syncClones();
  }

  // ================== Clones ==================

  function syncClones() {
    ['cam', 'slides'].forEach(role => {
      // Modo off -> remove clones (volta ao Meet normal)
      if (state.mode === 'off') {
        if (cloneNodes[role]) {
          cloneNodes[role].srcObject = null;
          cloneNodes[role].remove();
          cloneNodes[role] = null;
        }
        return;
      }

      // Garantir que existe clone no DOM
      if (!cloneNodes[role] || !cloneNodes[role].isConnected) {
        if (cloneNodes[role]) {
          cloneNodes[role].srcObject = null;
        }
        const clone = document.createElement('video');
        clone.autoplay = true;
        clone.playsInline = true;
        clone.muted = true;
        clone.dataset.msbClone = role;
        document.body.appendChild(clone);
        cloneNodes[role] = clone;
        log(`Clone ${role} criado no DOM.`);
      }

      // Atualiza srcObject (defensivo: ignora cadaveres sem srcObject)
      const candidates = document.querySelectorAll(`video[data-msb-role="${role}"]:not([data-msb-clone])`);
      let newStream = null;
      for (const v of candidates) {
        if (v.srcObject) {
          newStream = v.srcObject;
          break;
        }
      }
      if (cloneNodes[role].srcObject !== newStream) {
        cloneNodes[role].srcObject = newStream;
        log(`Clone ${role}: stream ${newStream ? 'atribuida' : 'limpa (pane preto)'}.`);
      }
    });
  }

  // ================== Modo de selecao ==================

  function enterSelectionMode(role) {
    state.selectionMode = role;
    document.body.classList.add('msb-selecting');
    document.body.classList.toggle('msb-selecting-cam', role === 'cam');
    document.body.classList.toggle('msb-selecting-slides', role === 'slides');
    log(`Modo selecao ativado: ${role}.`);
  }

  function exitSelectionMode() {
    state.selectionMode = null;
    document.body.classList.remove('msb-selecting', 'msb-selecting-cam', 'msb-selecting-slides');
  }

  function handleSelectionClick(e) {
    if (!state.selectionMode) return;
    const pid = findParticipantId(e.target);
    if (!pid) {
      log('Click sem [data-participant-id]:', e.target);
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    const role = state.selectionMode;
    if (role === 'cam') state.camPid = pid;
    else if (role === 'slides') state.slidesPid = pid;
    log(`Marcado: ${role} = ${pid}`);
    saveState();
    applyMarks();
    exitSelectionMode();
  }

  document.addEventListener('click', handleSelectionClick, true);

  // Memoriza target do clique direito pro menu de contexto
  let lastContextTarget = null;
  document.addEventListener('contextmenu', (e) => {
    lastContextTarget = e.target;
  }, true);

  // ================== MutationObserver + listeners ==================

  let pendingApply = false;
  function scheduleApply() {
    if (pendingApply) return;
    pendingApply = true;
    requestAnimationFrame(() => {
      pendingApply = false;
      applyMarks();
    });
  }

  function attachVideoListeners(video) {
    if (video._msbListened || video.dataset.msbClone) return;
    video._msbListened = true;
    video.addEventListener('loadedmetadata', scheduleApply);
    video.addEventListener('emptied', scheduleApply);
  }

  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      m.addedNodes.forEach(n => {
        if (n.nodeType !== 1) return;
        if (n.tagName === 'VIDEO') {
          attachVideoListeners(n);
        } else if (n.querySelectorAll) {
          n.querySelectorAll('video').forEach(attachVideoListeners);
        }
      });
    }
    scheduleApply();
  });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });

  document.querySelectorAll('video').forEach(attachVideoListeners);

  // ================== Keep-alive ==================

  function applyKeepAlive() {
    try {
      Object.defineProperty(document, 'hidden', { get: () => false, configurable: true });
      Object.defineProperty(document, 'visibilityState', { get: () => 'visible', configurable: true });
      document.addEventListener('visibilitychange', e => e.stopImmediatePropagation(), true);
      log('Override de Page Visibility API aplicado.');
    } catch (err) {
      log('Falha ao aplicar override de visibility:', err);
    }
    function tick() { requestAnimationFrame(tick); }
    requestAnimationFrame(tick);
  }
  applyKeepAlive();

  // ================== Inspector ==================

  function describeElement(el, depth = 0) {
    if (!el || el.nodeType !== 1) return null;
    const attrs = {};
    for (const attr of el.attributes) {
      if (attr.name.startsWith('aria-') && attr.name !== 'aria-label') continue;
      attrs[attr.name] = attr.value.length > 200 ? attr.value.slice(0, 200) + '...' : attr.value;
    }
    const rect = el.getBoundingClientRect();
    return {
      depth,
      tag: el.tagName.toLowerCase(),
      id: el.id || null,
      classes: el.className && typeof el.className === 'string' ? el.className.split(/\s+/).filter(Boolean) : [],
      attrs,
      rect: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) },
      childrenCount: el.children.length
    };
  }

  function describeAncestry(video, levels = 4) {
    const chain = [];
    let cur = video;
    let depth = 0;
    while (cur && depth <= levels) {
      chain.push(describeElement(cur, depth));
      cur = cur.parentElement;
      depth++;
    }
    return chain;
  }

  function collectSnapshot() {
    const videos = Array.from(document.querySelectorAll('video'));
    return {
      timestamp: new Date().toISOString(),
      url: window.location.href,
      pathname: window.location.pathname,
      viewport: { w: window.innerWidth, h: window.innerHeight },
      videoCount: videos.length,
      state: { ...state },
      clones: {
        cam: cloneNodes.cam ? {
          inDom: cloneNodes.cam.isConnected,
          rect: cloneNodes.cam.getBoundingClientRect(),
          paused: cloneNodes.cam.paused,
          videoWidth: cloneNodes.cam.videoWidth,
          videoHeight: cloneNodes.cam.videoHeight,
          hasStream: !!cloneNodes.cam.srcObject
        } : null,
        slides: cloneNodes.slides ? {
          inDom: cloneNodes.slides.isConnected,
          rect: cloneNodes.slides.getBoundingClientRect(),
          paused: cloneNodes.slides.paused,
          videoWidth: cloneNodes.slides.videoWidth,
          videoHeight: cloneNodes.slides.videoHeight,
          hasStream: !!cloneNodes.slides.srcObject
        } : null
      },
      videos: videos.map((v, idx) => {
        const rect = v.getBoundingClientRect();
        return {
          index: idx,
          msbRole: v.getAttribute('data-msb-role'),
          msbClone: v.getAttribute('data-msb-clone'),
          self: describeElement(v, 0),
          isPaused: v.paused,
          isMuted: v.muted,
          srcObject: v.srcObject ? 'MediaStream' : null,
          videoWidth: v.videoWidth,
          videoHeight: v.videoHeight,
          areaPx: Math.round(rect.width * rect.height),
          ancestry: describeAncestry(v, 4)
        };
      })
    };
  }

  // ================== Helpers de modo ==================

  function setMode(newMode) {
    if (!VALID_MODES.includes(newMode)) {
      log(`Mode invalida: ${newMode}`);
      return false;
    }
    state.mode = newMode;
    saveState();
    applyModeClass();
    applyMarks();
    log(`Modo: ${newMode}`);
    return true;
  }

  // ================== Listener de mensagens ==================

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    log('Mensagem:', msg);
    if (!msg || !msg.cmd) {
      sendResponse({ ok: false, error: 'comando ausente' });
      return false;
    }

    switch (msg.cmd) {
      case 'getState': {
        const camClone = cloneNodes.cam;
        const slidesClone = cloneNodes.slides;
        sendResponse({
          ok: true,
          camPid: state.camPid,
          slidesPid: state.slidesPid,
          mode: state.mode,
          splitActive: state.mode !== 'off', // backwards compat
          selectionMode: state.selectionMode,
          videoCount: document.querySelectorAll('video').length,
          camMarked: !!document.querySelector('video[data-msb-role="cam"]'),
          slidesMarked: !!document.querySelector('video[data-msb-role="slides"]'),
          camResolution: camClone && camClone.videoWidth ? `${camClone.videoWidth}x${camClone.videoHeight}` : null,
          slidesResolution: slidesClone && slidesClone.videoWidth ? `${slidesClone.videoWidth}x${slidesClone.videoHeight}` : null
        });
        return false;
      }
      case 'setMode': {
        const ok = setMode(msg.mode);
        sendResponse({ ok, mode: state.mode });
        return false;
      }
      case 'toggleSplit': {
        // Atalho: off <-> split
        const newMode = state.mode === 'off' ? 'split' : 'off';
        setMode(newMode);
        sendResponse({ ok: true, mode: state.mode, splitActive: state.mode !== 'off' });
        return false;
      }
      case 'startSelection': {
        enterSelectionMode(msg.role);
        sendResponse({ ok: true, selectionMode: state.selectionMode });
        return false;
      }
      case 'markFromContext': {
        if (msg.role !== 'cam' && msg.role !== 'slides') {
          sendResponse({ ok: false, error: 'role invalida' });
          return false;
        }
        if (!lastContextTarget) {
          sendResponse({ ok: false, error: 'nenhum target de clique direito memorizado' });
          return false;
        }
        const pid = findParticipantId(lastContextTarget);
        if (!pid) {
          sendResponse({ ok: false, error: 'sem [data-participant-id] no caminho do target' });
          return false;
        }
        if (msg.role === 'cam') state.camPid = pid;
        else state.slidesPid = pid;
        log(`Marcado via menu de contexto: ${msg.role} = ${pid}`);
        saveState();
        applyMarks();
        sendResponse({ ok: true, role: msg.role, pid });
        return false;
      }
      case 'cancelSelection': {
        exitSelectionMode();
        sendResponse({ ok: true });
        return false;
      }
      case 'clear': {
        state.camPid = null;
        state.slidesPid = null;
        state.mode = 'off';
        exitSelectionMode();
        saveState();
        applyMarks();
        applyModeClass();
        sendResponse({ ok: true });
        return false;
      }
      case 'inspect': {
        const snapshot = collectSnapshot();
        sendResponse({
          ok: true,
          videoCount: snapshot.videoCount,
          json: JSON.stringify(snapshot, null, 2)
        });
        return false;
      }
      case 'ping': {
        sendResponse({
          ok: true,
          ready: true,
          videoCount: document.querySelectorAll('video').length
        });
        return false;
      }
      default: {
        sendResponse({ ok: false, error: `comando desconhecido: ${msg.cmd}` });
        return false;
      }
    }
  });

  // ================== Bootstrap ==================

  loadState();
  log('Content script carregado em', window.location.href);
})();
