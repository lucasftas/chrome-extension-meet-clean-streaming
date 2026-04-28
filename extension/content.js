/**
 * Meet Split for Broadcast - Content Script
 *
 * - Selecao manual via click: usuario marca qual tile e CAM e qual e SLIDES
 * - Persistencia: data-participant-id salvo em chrome.storage.local
 * - MutationObserver: re-aplica data-msb-role nas <video> apos re-renders do Meet
 * - Split mode: classe msb-active no body ativa CSS de layout 50/50
 * - Keep-alive: override Page Visibility API + rAF loop pra evitar throttle
 * - Inspector: mantido pra debug
 */

(function () {
  'use strict';

  const LOG_PREFIX = '[MSB]';
  const STORAGE_KEYS = {
    cam: 'msb_cam_pid',
    slides: 'msb_slides_pid',
    active: 'msb_split_active'
  };

  const state = {
    camPid: null,
    slidesPid: null,
    splitActive: false,
    selectionMode: null
  };

  // Clones criados pra evitar stacking-context do Meet capturando o position:fixed.
  // Cada clone vive direto em document.body, com srcObject = MediaStream do video original.
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
      STORAGE_KEYS.active
    ]);
    state.camPid = data[STORAGE_KEYS.cam] || null;
    state.slidesPid = data[STORAGE_KEYS.slides] || null;
    state.splitActive = !!data[STORAGE_KEYS.active];
    log('Estado carregado:', state);
    applyMarks();
    applySplitClass();
  }

  async function saveState() {
    await chrome.storage.local.set({
      [STORAGE_KEYS.cam]: state.camPid,
      [STORAGE_KEYS.slides]: state.slidesPid,
      [STORAGE_KEYS.active]: state.splitActive
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
   * Procura um tile candidato a slides quando o slidesPid salvo nao existe mais.
   *
   * Caso de uso: convidado para de compartilhar tela e re-compartilha. Cada
   * sessao de screenshare gera um device novo no Meet (PID muda), entao o
   * slidesPid persistido vira stale. Sem auto-redetect, o operador tem que
   * re-marcar SLIDES manualmente toda vez.
   *
   * Heuristica:
   *  - Tile com [data-participant-id] diferente do camPid
   *  - Contem <video> NAO clone com videoWidth >= 1000 (descarta cams 360p/720p)
   *  - Tile tem rect significativo no DOM original (descarta miniaturas tipo
   *    self-view com 124x78px)
   *  - Em caso de empate, escolhe o de maior area visual
   */
  function findScreenshareCandidate() {
    const allTiles = document.querySelectorAll('[data-participant-id]');
    let best = null;
    let bestArea = 0;

    for (const tile of allTiles) {
      const pid = tile.dataset && tile.dataset.participantId;
      if (!pid || pid === state.camPid) continue;

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

  /**
   * Marca o(s) video(s) "vivos" de um tile com data-msb-role.
   *
   * IMPORTANTE: o Meet costuma deixar <video> "cadaver" no DOM quando o
   * participante desliga a camera (style="display:none" + srcObject=null).
   * Quando religa, o Meet cria um <video> novo NO MESMO TILE sem remover o
   * antigo. Pra nao confundir o syncClones, so marcamos os que TEM srcObject.
   */
  function markLiveVideosInTile(tile, role) {
    if (!tile) return;
    tile.querySelectorAll('video:not([data-msb-clone])').forEach(v => {
      if (v.srcObject) {
        v.setAttribute('data-msb-role', role);
      }
    });
  }

  function applyMarks() {
    // Nao tocar nos clones do MSB
    document.querySelectorAll('video[data-msb-role]:not([data-msb-clone])').forEach(v => {
      v.removeAttribute('data-msb-role');
    });

    // CAM: aplica direto pelo PID salvo
    if (state.camPid) {
      markLiveVideosInTile(findTileByPid(state.camPid), 'cam');
    }

    // SLIDES: aplica pelo PID salvo OU auto-redetect se stale
    let slidesTile = state.slidesPid ? findTileByPid(state.slidesPid) : null;
    if (state.slidesPid && !slidesTile) {
      // PID antigo nao existe mais (provavelmente screenshare reiniciou) -> tenta achar substituto
      const candidate = findScreenshareCandidate();
      if (candidate) {
        log(`Auto-redetect SLIDES: ${state.slidesPid} (stale) -> ${candidate.pid}`);
        state.slidesPid = candidate.pid;
        saveState();
        slidesTile = candidate.tile;
      }
    }
    markLiveVideosInTile(slidesTile, 'slides');

    // Re-sincroniza clones caso o Meet tenha recriado o <video> original
    syncClones();
  }

  function applySplitClass() {
    document.body.classList.toggle('msb-active', state.splitActive);
    syncClones();
  }

  /**
   * Cria/atualiza/remove videos clonados em document.body, evitando o stacking
   * context do Meet que prende position:fixed dos videos originais.
   *
   * Estrategia: extrai a MediaStream (srcObject) do <video> original com
   * data-msb-role e atribui a um <video> novo criado direto no body. Mesma
   * stream, sem custo de banda. Os originais ficam escondidos via CSS.
   *
   * IMPORTANTE - estabilidade pra captura externa (vMix Desktop Capture):
   * Enquanto splitActive=true, os clones SEMPRE permanecem no DOM, mesmo que
   * o video original tenha sumido (screenshare parou, cam mutada, etc). Nesse
   * caso so o srcObject vai pra null - o pane fica preto mas o elemento nao
   * é removido. Isso evita flicker / reflow no preview do vMix durante
   * intervalos de transicao (ex: convidado para e volta a compartilhar tela).
   */
  function syncClones() {
    ['cam', 'slides'].forEach(role => {
      // Split desligado -> remove clone do DOM se houver (volta ao Meet normal)
      if (!state.splitActive) {
        if (cloneNodes[role]) {
          cloneNodes[role].srcObject = null;
          cloneNodes[role].remove();
          cloneNodes[role] = null;
        }
        return;
      }

      // Split ativo -> garante que existe um clone no DOM (mesmo que sem stream)
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

      // Atualiza srcObject - aceita null (pane fica preto) sem destruir o elemento
      // Defensivo: ignora qualquer <video> "cadaver" sem srcObject (Meet costuma
      // deixar elementos antigos no DOM quando cam desliga/religa).
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
        log(`Clone ${role}: stream ${newStream ? 'atribuida' : 'limpa (pane preto, sem remover)'}.`);
      }
    });
  }

  // ================== Modo de selecao ==================

  function enterSelectionMode(role) {
    state.selectionMode = role;
    document.body.classList.add('msb-selecting');
    document.body.classList.toggle('msb-selecting-cam', role === 'cam');
    document.body.classList.toggle('msb-selecting-slides', role === 'slides');
    log(`Modo selecao ativado: ${role}. Clique no tile desejado.`);
  }

  function exitSelectionMode() {
    state.selectionMode = null;
    document.body.classList.remove('msb-selecting', 'msb-selecting-cam', 'msb-selecting-slides');
  }

  function handleSelectionClick(e) {
    if (!state.selectionMode) return;
    const pid = findParticipantId(e.target);
    if (!pid) {
      log('Click sem [data-participant-id] no caminho. Clique direto sobre o tile.', e.target);
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    const role = state.selectionMode;
    if (role === 'cam') {
      state.camPid = pid;
    } else if (role === 'slides') {
      state.slidesPid = pid;
    }
    log(`Marcado: ${role} = ${pid}`);
    saveState();
    applyMarks();
    exitSelectionMode();
  }

  // capture phase = roda antes dos handlers do Meet
  document.addEventListener('click', handleSelectionClick, true);

  // ================== MutationObserver ==================

  let pendingApply = false;
  function scheduleApply() {
    if (pendingApply) return;
    pendingApply = true;
    requestAnimationFrame(() => {
      pendingApply = false;
      applyMarks();
    });
  }

  const observer = new MutationObserver((mutations) => {
    // Pega <video> novos que apareceram e atacha listeners de stream
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

  /**
   * Atacha listeners de stream em <video>. Necessario porque o MutationObserver
   * nao detecta mudancas de srcObject (eh property JS, nao atributo). Sem isso,
   * o caso "Meet cria <video> novo sem srcObject ainda, depois atribui" deixa
   * o pane preto pra sempre.
   *
   *  - loadedmetadata: stream chegou (videoWidth/Height passa a ser != 0)
   *  - emptied: srcObject foi anulado
   */
  function attachVideoListeners(video) {
    if (video._msbListened || video.dataset.msbClone) return;
    video._msbListened = true;
    video.addEventListener('loadedmetadata', scheduleApply);
    video.addEventListener('emptied', scheduleApply);
  }

  // Atacha em <video> ja existentes na primeira execucao
  document.querySelectorAll('video').forEach(attachVideoListeners);

  // ================== Keep-alive anti-throttle ==================

  function applyKeepAlive() {
    try {
      Object.defineProperty(document, 'hidden', {
        get: () => false,
        configurable: true
      });
      Object.defineProperty(document, 'visibilityState', {
        get: () => 'visible',
        configurable: true
      });
      document.addEventListener('visibilitychange', e => {
        e.stopImmediatePropagation();
      }, true);
      log('Override de Page Visibility API aplicado.');
    } catch (err) {
      log('Falha ao aplicar override de visibility:', err);
    }

    function tick() {
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }
  applyKeepAlive();

  // ================== Inspector (debug) ==================

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

  function describeAncestry(video, levels = 8) {
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

  // ================== Listener de mensagens ==================

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    log('Mensagem:', msg);
    if (!msg || !msg.cmd) {
      sendResponse({ ok: false, error: 'comando ausente' });
      return false;
    }

    switch (msg.cmd) {
      case 'getState': {
        sendResponse({
          ok: true,
          camPid: state.camPid,
          slidesPid: state.slidesPid,
          splitActive: state.splitActive,
          selectionMode: state.selectionMode,
          videoCount: document.querySelectorAll('video').length,
          camMarked: !!document.querySelector('video[data-msb-role="cam"]'),
          slidesMarked: !!document.querySelector('video[data-msb-role="slides"]')
        });
        return false;
      }
      case 'startSelection': {
        enterSelectionMode(msg.role);
        sendResponse({ ok: true, selectionMode: state.selectionMode });
        return false;
      }
      case 'cancelSelection': {
        exitSelectionMode();
        sendResponse({ ok: true });
        return false;
      }
      case 'toggleSplit': {
        state.splitActive = !state.splitActive;
        saveState();
        applySplitClass();
        applyMarks();
        sendResponse({ ok: true, splitActive: state.splitActive });
        return false;
      }
      case 'clear': {
        state.camPid = null;
        state.slidesPid = null;
        state.splitActive = false;
        exitSelectionMode();
        saveState();
        applyMarks();
        applySplitClass();
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
