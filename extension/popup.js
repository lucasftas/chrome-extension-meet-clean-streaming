/**
 * Meet Split for Broadcast - Popup (Design 3: Live Dashboard)
 */

const els = {
  status: document.getElementById('status'),
  warnings: document.getElementById('warnings'),
  statCamValue: document.getElementById('stat-cam-value'),
  statSlidesValue: document.getElementById('stat-slides-value'),
  selectionHint: document.getElementById('selection-hint'),
  liveBadge: document.getElementById('live-badge'),
  liveLabel: document.getElementById('live-label'),
  popupInfoTag: document.getElementById('popup-info-tag'),
  btnMarkCam: document.getElementById('btn-mark-cam'),
  btnMarkSlides: document.getElementById('btn-mark-slides'),
  btnClear: document.getElementById('btn-clear'),
  btnRefresh: document.getElementById('btn-refresh'),
  btnInspect: document.getElementById('btn-inspect'),
  btnPing: document.getElementById('btn-ping'),
  fallback: document.getElementById('fallback')
};

const modeButtons = document.querySelectorAll('.mode-btn');

function setStatus(msg) {
  els.status.textContent = msg;
}

function shortPid(pid) {
  if (!pid) return null;
  const parts = pid.split('/');
  return parts.length >= 2 ? `.../${parts[parts.length - 1]}` : pid;
}

async function getActiveMeetTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) {
    setStatus('Nenhuma aba ativa.');
    return null;
  }
  if (!tab.url || !tab.url.startsWith('https://meet.google.com/')) {
    setStatus(`Aba ativa não é Google Meet:\n${tab.url || '(sem URL)'}`);
    return null;
  }
  return tab;
}

async function sendCmd(cmd, payload = {}) {
  const tab = await getActiveMeetTab();
  if (!tab) return null;
  try {
    return await chrome.tabs.sendMessage(tab.id, { cmd, ...payload });
  } catch (err) {
    setStatus(`Erro:\n${err.message}\n\nRecarregue a aba do Meet (F5).`);
    return null;
  }
}

function renderStat(el, pid, resolution, marked) {
  if (!pid) {
    el.textContent = 'não marcado';
    el.classList.remove('ok');
    el.classList.add('pending');
    return;
  }
  const pidShort = shortPid(pid);
  if (marked && resolution) {
    el.textContent = `${pidShort} · ${resolution}`;
    el.classList.add('ok');
    el.classList.remove('pending');
  } else if (marked) {
    el.textContent = `${pidShort} · OK`;
    el.classList.add('ok');
    el.classList.remove('pending');
  } else {
    el.textContent = `${pidShort} · aguardando`;
    el.classList.remove('ok');
    el.classList.add('pending');
  }
}

async function checkPopupDetected() {
  // Verifica se ha alguma janela about:blank com opener Meet aberta
  // Heuristica: vai pelo chrome.tabs.query
  try {
    const tabs = await chrome.tabs.query({});
    const popup = tabs.find(t => t.url && (t.url === 'about:blank' || t.url.startsWith('about:blank')));
    return !!popup;
  } catch {
    return false;
  }
}

function renderState(s) {
  if (!s || !s.ok) {
    setStatus('Estado indisponível. Recarregue a aba do Meet.');
    return;
  }

  // Stats
  renderStat(els.statCamValue, s.camPid, s.camResolution, s.camMarked);
  renderStat(els.statSlidesValue, s.slidesPid, s.slidesResolution, s.slidesMarked);

  // LIVE badge
  if (s.mode && s.mode !== 'off') {
    els.liveBadge.classList.remove('idle');
    els.liveLabel.textContent = 'LIVE';
  } else {
    els.liveBadge.classList.add('idle');
    els.liveLabel.textContent = 'IDLE';
  }

  // Mode buttons
  modeButtons.forEach(b => {
    b.classList.toggle('active', b.dataset.mode === s.mode);
  });

  // Selection hint
  els.selectionHint.classList.toggle('hidden', !s.selectionMode);
  if (s.selectionMode) {
    els.selectionHint.textContent = `Modo seleção ${s.selectionMode.toUpperCase()} ativo — clique no tile dentro do Meet.`;
  }

  // Popup detection (best effort)
  checkPopupDetected().then(detected => {
    if (detected) {
      els.popupInfoTag.textContent = '✓ detectada';
      els.popupInfoTag.className = 'popup-info-tag detected';
    } else {
      els.popupInfoTag.textContent = 'aguardando';
      els.popupInfoTag.className = 'popup-info-tag idle';
    }
  });

  // Status text
  const camStatus = s.camMarked ? 'OK' : (s.camPid ? 'aguardando' : 'pendente');
  const slidesStatus = s.slidesMarked ? 'OK' : (s.slidesPid ? 'aguardando' : 'pendente');
  setStatus(`videos: ${s.videoCount} · CAM: ${camStatus} · SLIDES: ${slidesStatus}\nmodo: ${s.mode || 'off'}`);

  // Warnings (split ativo mas tile sumiu)
  els.warnings.innerHTML = '';
  if (s.mode && s.mode !== 'off') {
    if (s.camPid && !s.camMarked && (s.mode === 'split' || s.mode === 'solo-cam')) {
      addWarning('CAM não encontrada no DOM. Verifique se o layout do Meet não está em "Em destaque" sem fixar a cam marcada. Use Auto/Mosaico/Lado a lado, ou Spotlight a cam.');
    }
    if (s.slidesPid && !s.slidesMarked && (s.mode === 'split' || s.mode === 'solo-slides')) {
      addWarning('SLIDES não encontrado no DOM. Verifique se o screenshare ainda está ativo. (Auto-redetect deve assumir em segundos quando o convidado voltar a compartilhar.)');
    }
  }
}

function addWarning(text) {
  const div = document.createElement('div');
  div.className = 'warning';
  div.textContent = text;
  els.warnings.appendChild(div);
}

async function refresh() {
  const s = await sendCmd('getState');
  renderState(s);
}

// ================== Handlers ==================

els.btnMarkCam.addEventListener('click', async () => {
  const s = await sendCmd('startSelection', { role: 'cam' });
  if (s && s.ok) {
    setStatus('Modo seleção CAM ativo.\nClique no tile da câmera no Meet.');
    setTimeout(() => window.close(), 800);
  }
});

els.btnMarkSlides.addEventListener('click', async () => {
  const s = await sendCmd('startSelection', { role: 'slides' });
  if (s && s.ok) {
    setStatus('Modo seleção SLIDES ativo.\nClique no tile da apresentação no Meet.');
    setTimeout(() => window.close(), 800);
  }
});

modeButtons.forEach(btn => {
  btn.addEventListener('click', async () => {
    const mode = btn.dataset.mode;
    const s = await sendCmd('setMode', { mode });
    if (s && s.ok) {
      refresh();
    }
  });
});

els.btnClear.addEventListener('click', async () => {
  const s = await sendCmd('clear');
  if (s && s.ok) {
    setStatus('Seleções apagadas.');
    refresh();
  }
});

els.btnRefresh.addEventListener('click', refresh);

els.btnInspect.addEventListener('click', async () => {
  setStatus('Coletando snapshot...');
  els.fallback.style.display = 'none';
  const res = await sendCmd('inspect');
  if (!res || !res.json) return;
  try {
    await navigator.clipboard.writeText(res.json);
    setStatus(`OK — ${res.videoCount} video(s).\nJSON copiado pra clipboard.`);
  } catch (err) {
    setStatus(`OK — ${res.videoCount} video(s).\nClipboard falhou — copie do textarea.`);
    els.fallback.value = res.json;
    els.fallback.style.display = 'block';
    els.fallback.focus();
    els.fallback.select();
  }
});

els.btnPing.addEventListener('click', async () => {
  const res = await sendCmd('ping');
  if (res && res.ready) {
    setStatus(`Content script ATIVO.\n${res.videoCount} video(s).`);
  } else {
    setStatus('Content script não respondeu.\nRecarregue a aba do Meet.');
  }
});

refresh();
