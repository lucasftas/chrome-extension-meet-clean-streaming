/**
 * Meet Split for Broadcast - Popup
 * Envia comandos ao content script da aba ativa do Meet e renderiza estado.
 */

const els = {
  status: document.getElementById('status'),
  pillCam: document.getElementById('pill-cam'),
  pillSlides: document.getElementById('pill-slides'),
  selectionHint: document.getElementById('selection-hint'),
  btnMarkCam: document.getElementById('btn-mark-cam'),
  btnMarkSlides: document.getElementById('btn-mark-slides'),
  btnToggle: document.getElementById('btn-toggle-split'),
  btnClear: document.getElementById('btn-clear'),
  btnRefresh: document.getElementById('btn-refresh'),
  btnInspect: document.getElementById('btn-inspect'),
  btnPing: document.getElementById('btn-ping'),
  fallback: document.getElementById('fallback')
};

function setStatus(msg) {
  els.status.textContent = msg;
}

function shortPid(pid) {
  if (!pid) return null;
  const parts = pid.split('/');
  return parts.length >= 2 ? `.../${parts[parts.length - 2]}/${parts[parts.length - 1]}` : pid;
}

async function getActiveMeetTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) {
    setStatus('Nenhuma aba ativa.');
    return null;
  }
  if (!tab.url || !tab.url.startsWith('https://meet.google.com/')) {
    setStatus(`Aba ativa nao e Google Meet:\n${tab.url || '(sem URL)'}`);
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
    setStatus(`Erro ao enviar comando:\n${err.message}\n\nRecarregue a aba do Meet (F5).`);
    return null;
  }
}

function renderState(s) {
  if (!s || !s.ok) {
    setStatus('Estado indisponivel. Recarregue a aba do Meet.');
    return;
  }

  if (s.camPid) {
    els.pillCam.textContent = shortPid(s.camPid) + (s.camMarked ? ' [OK]' : ' [aguard]');
    els.pillCam.classList.add('cam-marked');
    els.pillCam.classList.remove('marked');
  } else {
    els.pillCam.textContent = 'nao marcado';
    els.pillCam.classList.remove('cam-marked', 'marked');
  }

  if (s.slidesPid) {
    els.pillSlides.textContent = shortPid(s.slidesPid) + (s.slidesMarked ? ' [OK]' : ' [aguard]');
    els.pillSlides.classList.add('marked');
    els.pillSlides.classList.remove('cam-marked');
  } else {
    els.pillSlides.textContent = 'nao marcado';
    els.pillSlides.classList.remove('cam-marked', 'marked');
  }

  els.btnToggle.classList.toggle('toggle-on', s.splitActive);
  els.btnToggle.classList.toggle('toggle-off', !s.splitActive);
  els.btnToggle.textContent = s.splitActive ? 'Desativar Split' : 'Ativar Split';

  els.selectionHint.classList.toggle('hidden', !s.selectionMode);
  if (s.selectionMode) {
    els.selectionHint.textContent = `Modo selecao ${s.selectionMode.toUpperCase()} ativo - clique no tile desejado dentro do Meet.`;
  }

  const camStatus = s.camMarked ? 'OK' : (s.camPid ? 'aguardando re-render' : 'pendente');
  const slidesStatus = s.slidesMarked ? 'OK' : (s.slidesPid ? 'aguardando re-render' : 'pendente');
  setStatus(`videos: ${s.videoCount}\nCAM: ${camStatus}\nSLIDES: ${slidesStatus}\nsplit: ${s.splitActive ? 'ATIVO' : 'desligado'}`);
}

async function refresh() {
  const s = await sendCmd('getState');
  renderState(s);
}

// ================== Handlers ==================

els.btnMarkCam.addEventListener('click', async () => {
  const s = await sendCmd('startSelection', { role: 'cam' });
  if (s && s.ok) {
    setStatus('Modo selecao CAM ativo.\nClique no tile da camera dentro do Meet.\n(Popup vai fechar.)');
    setTimeout(() => window.close(), 800);
  }
});

els.btnMarkSlides.addEventListener('click', async () => {
  const s = await sendCmd('startSelection', { role: 'slides' });
  if (s && s.ok) {
    setStatus('Modo selecao SLIDES ativo.\nClique no tile da apresentacao dentro do Meet.\n(Popup vai fechar.)');
    setTimeout(() => window.close(), 800);
  }
});

els.btnToggle.addEventListener('click', async () => {
  const s = await sendCmd('toggleSplit');
  if (s && s.ok) {
    setStatus(s.splitActive ? 'Split ATIVADO.\nCapture a janela do Chrome no vMix.' : 'Split desativado.');
    refresh();
  }
});

els.btnClear.addEventListener('click', async () => {
  const s = await sendCmd('clear');
  if (s && s.ok) {
    setStatus('Selecoes apagadas.');
    refresh();
  }
});

els.btnRefresh.addEventListener('click', refresh);

els.btnInspect.addEventListener('click', async () => {
  setStatus('Coletando snapshot do DOM...');
  els.fallback.style.display = 'none';
  const res = await sendCmd('inspect');
  if (!res || !res.json) return;
  try {
    await navigator.clipboard.writeText(res.json);
    setStatus(`OK - ${res.videoCount} video(s).\nJSON copiado pro clipboard.`);
  } catch (err) {
    setStatus(`OK - ${res.videoCount} video(s).\nClipboard falhou - copie do textarea (Ctrl+A, Ctrl+C).`);
    els.fallback.value = res.json;
    els.fallback.style.display = 'block';
    els.fallback.focus();
    els.fallback.select();
  }
});

els.btnPing.addEventListener('click', async () => {
  const res = await sendCmd('ping');
  if (res && res.ready) {
    setStatus(`Content script ATIVO.\n${res.videoCount} video(s) presente(s).`);
  } else {
    setStatus('Content script nao respondeu. Recarregue a aba do Meet.');
  }
});

refresh();
