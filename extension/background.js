/**
 * Meet Split for Broadcast - Service Worker (background)
 *
 * Registra menus de contexto (clique direito) com:
 *  - Marcar CAM/SLIDES no tile clickado (captura PID direto sem 2 cliques)
 *  - Trocar modo: Off / Split 50/50 / Solo CAM / Solo SLIDES
 *  - Limpar selecoes
 *
 * Sem documentUrlPatterns (default = todas URLs) pra cobrir tambem a popup
 * nativa do Meet (about:blank em janela separada). O content script so esta
 * injetado em meet.google.com + about:blank com opener do Meet, entao em
 * outras paginas o sendMessage simplesmente falha silenciosamente.
 */

const MENUS = [
  { id: 'msb-mark-cam', title: 'Meet Split: Marcar CAM no tile clickado' },
  { id: 'msb-mark-slides', title: 'Meet Split: Marcar SLIDES no tile clickado' },
  { id: 'msb-sep-1', type: 'separator' },
  { id: 'msb-mode-off', title: 'Meet Split: Modo Off' },
  { id: 'msb-mode-split', title: 'Meet Split: Modo Split 50/50' },
  { id: 'msb-mode-solo-cam', title: 'Meet Split: Modo Solo CAM' },
  { id: 'msb-mode-solo-slides', title: 'Meet Split: Modo Solo SLIDES' },
  { id: 'msb-sep-2', type: 'separator' },
  { id: 'msb-clear', title: 'Meet Split: Limpar selecoes' }
];

function registerMenus() {
  chrome.contextMenus.removeAll(() => {
    for (const m of MENUS) {
      const item = {
        id: m.id,
        contexts: ['all']
      };
      if (m.type === 'separator') {
        item.type = 'separator';
      } else {
        item.title = m.title;
      }
      chrome.contextMenus.create(item);
    }
  });
}

chrome.runtime.onInstalled.addListener(registerMenus);
chrome.runtime.onStartup.addListener(registerMenus);

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab || !tab.id) return;

  let cmd = null;
  let payload = {};

  switch (info.menuItemId) {
    case 'msb-mark-cam':
      cmd = 'markFromContext';
      payload.role = 'cam';
      break;
    case 'msb-mark-slides':
      cmd = 'markFromContext';
      payload.role = 'slides';
      break;
    case 'msb-mode-off':
      cmd = 'setMode';
      payload.mode = 'off';
      break;
    case 'msb-mode-split':
      cmd = 'setMode';
      payload.mode = 'split';
      break;
    case 'msb-mode-solo-cam':
      cmd = 'setMode';
      payload.mode = 'solo-cam';
      break;
    case 'msb-mode-solo-slides':
      cmd = 'setMode';
      payload.mode = 'solo-slides';
      break;
    case 'msb-clear':
      cmd = 'clear';
      break;
  }

  if (!cmd) return;

  chrome.tabs.sendMessage(tab.id, { cmd, ...payload }, () => {
    if (chrome.runtime.lastError) {
      console.warn('[MSB bg] Falha ao enviar comando (recarregue a aba do Meet):', chrome.runtime.lastError.message);
    }
  });
});
