/**
 * Meet Split for Broadcast - Service Worker (background)
 *
 * Registra menus de contexto (clique com botao direito) pra acessar comandos
 * da extensao sem precisar do icone da toolbar - util quando o operador usa
 * o recurso "Abrir em janela separada" do Meet (popup window sem URL bar).
 *
 * Comportamento:
 *  - "Marcar CAM/SLIDES (clique direito sobre o tile)": captura PID direto
 *    do elemento clickado, sem o fluxo de 2 cliques (botao + click)
 *  - "Toggle Split / Limpar": comandos diretos
 */

const MEET_PATTERN = ['https://meet.google.com/*'];

const MENUS = [
  { id: 'msb-mark-cam', title: 'Meet Split: Marcar CAM no tile clickado' },
  { id: 'msb-mark-slides', title: 'Meet Split: Marcar SLIDES no tile clickado' },
  { id: 'msb-sep-1', type: 'separator' },
  { id: 'msb-toggle-split', title: 'Meet Split: Ativar/Desativar Split' },
  { id: 'msb-clear', title: 'Meet Split: Limpar selecoes' }
];

function registerMenus() {
  chrome.contextMenus.removeAll(() => {
    for (const m of MENUS) {
      const item = {
        id: m.id,
        contexts: ['all'],
        documentUrlPatterns: MEET_PATTERN
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
    case 'msb-toggle-split':
      cmd = 'toggleSplit';
      break;
    case 'msb-clear':
      cmd = 'clear';
      break;
  }

  if (!cmd) return;

  chrome.tabs.sendMessage(tab.id, { cmd, ...payload }, (response) => {
    if (chrome.runtime.lastError) {
      console.warn('[MSB bg] Falha ao enviar comando pra aba (recarregue o Meet):', chrome.runtime.lastError.message);
    }
  });
});
