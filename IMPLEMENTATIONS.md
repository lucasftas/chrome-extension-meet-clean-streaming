# Implementations

Histórico de implementações por versão, com resumo do que foi entregue em cada uma.

## v0.0.1 — 2026-04-28 — Captura da ideia

Primeira commit do repositório. Sem código de extensão ainda — apenas captura da proposta e documentação inicial.

**Entregue:**
- `README.md` alpha descrevendo proposta, problema, fluxo principal, stack, MVP e backlog futuro.
- `CLAUDE.md` do projeto com regras (privacidade, convenções, hardening, gatilho `filé`).
- `CHANGELOG.md`, `IMPLEMENTATIONS.md`, `OPERATIONS.md` (índices iniciais).
- `.gitignore` para Chrome Extension / Node.
- `Implementação-Meet-ISO.md` preservado como referência histórica da spec original (que evoluiu durante a entrevista — modelo final é janela única split, sem PowerShell).

**Decisões-chave capturadas na entrevista (gatilho `bora`):**
- Modelo: janela única split 50/50 (CAM esq + SLIDES dir), em vez de duas janelas separadas como na spec original.
- Controle: 100% via popup da extensão, sem PowerShell launcher.
- Identificação: seleção manual por click (descartada heurística frágil de `objectFit`).
- Hardening anti-pause: extensão aplica keep-alive + README documenta flags Chrome para o operador.
- Distribuição: ZIP versionado em GitHub Release (load unpacked), Chrome Web Store fica para depois.
- Privacidade: projeto será público — sem referências a empresa/marca pessoal em nenhum artefato.

## v0.2.2 — 2026-04-29 — Hotfix auto-redetect pegando cam errada

Quando o operador abre o slide em janela separada (popup nativa do Meet), o tile do screenshare na janela principal perde o `data-participant-id`. O `findTileByPid(slidesPid)` retorna null e dispara auto-redetect. Sem filtros adequados, o único candidato HD que sobra na janela principal é cam de outro participante — slide pane passa a mostrar cam.

**Solução em 2 camadas:**

1. **Filtro heurístico anti-cam**: classes empíricas do DOM do Meet diferenciam cam de screenshare:
   - Cams têm `iPFm3e` na sub-árvore do tile
   - Cams em layout PIP/destaque têm `Gv1mTb-PVLJEc` no `<video>`
   - Screenshares não têm nenhuma das duas
   `findScreenshareCandidate` agora descarta tiles que batem nesses padrões.

2. **Flag `msb_popup_open_at` em `chrome.storage.local`**: setada pelo content script da popup ao carregar (com heartbeat de 5s) e removida em `beforeunload`/`pagehide`. A janela principal mantém cache local via `chrome.storage.onChanged` listener. Quando popup ativa, auto-redetect é suprimido — `slidesPid` permanece stale temporariamente, mas o slide volta sozinho quando o user fecha a popup (PID novo no DOM principal).

## v0.2.1 — 2026-04-29 — Hotfix popup preta

Corrige regressão da v0.2.0 onde a popup nativa do Meet ("Abrir em uma nova janela") ficava preta. Causa: regra CSS `body[data-msb-meet-popup] > *:not(video) { display: none !important }` escondia o `<div>` wrapper que continha o `<video>`, sumindo com o vídeo junto.

**Solução:** mesma estratégia da janela principal — clone via `srcObject` em `<video>` novo criado direto em `document.body` da popup, com `position: fixed` em fullscreen. Overlay preto cobre o resto. Robusto contra estrutura DOM aninhada do Meet e stacking context.

**Entregue:**
- Path popup do `content.js` reescrito: detecta `<video>` original com `srcObject` (de maior área visual), cria clone, atribui stream, MutationObserver re-sincroniza.
- `style.css` removeu regra `body > *:not(video)`. Adicionou overlay preto via `body[data-msb-meet-popup]::before` e regra `video[data-msb-clone="popup"]` posicionando clone em fullscreen.

## v0.2.0 — 2026-04-28 — Modos de layout + popup nativa + Design 3

Release significativa: introduz múltiplos modos de operação (não só Split 50/50), suporta a popup nativa "Abrir em uma nova janela" do Meet com limpeza automática, popup redesenhado em estilo OBS/vMix com indicador LIVE, e ícone próprio gerado via System.Drawing.

**Entregue:**
- `state.mode` substitui `splitActive`. 4 modos: `off`, `split`, `solo-cam`, `solo-slides`. Migração automática do storage antigo.
- `extension/style.css` reescrito com regras `body.msb-mode-*` controlando posicionamento e visibilidade dos clones por modo.
- `content.js` bifurcado em 2 paths:
  - **Janela principal**: lógica completa (selection + clones + modos + auto-redetect + listeners de stream + keep-alive).
  - **Popup nativa do Meet**: detectada via `window.opener` + URL `about:blank`. Aplica `data-msb-meet-popup` no body; CSS faz o resto (esconde tudo exceto `<video>`, maximiza fullscreen com object-position bottom).
- Manifest V3: `match_about_blank: true` + `all_frames: true` no content_scripts → injeção automática na popup nativa.
- `extension/popup.html` + `popup.js` reescritos com Design 3 (Live Dashboard):
  - Top bar com indicador 🔴 LIVE pulsando quando modo != off, IDLE caso contrário.
  - Stats inline com PID curto + resolução real do clone (`videoWidth × videoHeight`).
  - Grid 2×2 de modos com botão ativo destacado em azul.
  - Avisos laranja quando split ativo + tile correspondente sumiu.
  - Detecção best-effort da popup nativa via `chrome.tabs.query`.
- `extension/background.js` expandido com 4 itens de menu pra trocar modo direto (Off/Split/Solo CAM/Solo SLIDES). `documentUrlPatterns` removido pra cobrir também a popup `about:blank`.
- `extension/icons/icon-{16,48,128}.png` gerados via `scripts/build-icons.ps1` (System.Drawing + GraphicsPath com cantos arredondados procedurais). Design E (REC + Split): retângulos azul + verde com bolinha vermelha de REC no topo, fundo preto rounded.
- Manifest com `default_icon` + `icons` apontando pros PNGs.

**Decisões de design:**
- Modos exclusivos (não combinação de toggles) — operadores em live precisam de um único click pra alternar entre cenários comuns.
- "Janela separada de SLIDES" usa o botão NATIVO do Meet (em vez de implementar Document PiP custom). A extensão só LIMPA a popup que o Meet já cria.
- Ícone gerado via PowerShell + System.Drawing (sem dependência de Inkscape/ImageMagick) — script reproduzível, qualquer um na máquina Windows pode regerar.

## v0.1.2 — 2026-04-28 — Menu de contexto (clique direito)

Endereça o caso da popup window do Meet (recurso "Abrir em janela separada") onde a janela não tem barra de URL nem ícone da extensão na toolbar — o operador não tinha como acessar comandos da extensão. Solução: menu de contexto via `chrome.contextMenus` API, disponível em qualquer janela do Chrome com URL no padrão `meet.google.com/*`.

**Entregue:**
- `extension/background.js` (service worker MV3) registrando menus em `onInstalled` + `onStartup` (este último cobre o caso de service worker dormir e acordar).
- 4 itens de menu + 1 separador: Marcar CAM/SLIDES (captura PID do tile clickado), Toggle Split, Limpar.
- `content.js` memoriza `lastContextTarget` via listener de `contextmenu` event.
- Comando `markFromContext` no listener de mensagens — usa o target memorizado pra extrair PID via `findParticipantId(lastContextTarget)`. Mais rápido que o fluxo de 2 cliques do popup.
- Permissão `contextMenus` no manifest.

## v0.1.1 — 2026-04-28 — Avisos de layout no popup

Patch incremental focado em UX: quando o split está ativo mas o tile da CAM/SLIDES sumiu do DOM (típico do layout "Em destaque" do Meet, que remove participantes não destacados), o popup mostra um aviso laranja explicando o que aconteceu e como mitigar (mudar layout no Meet ou fixar/Spotlight a cam marcada).

**Entregue:**
- `popup.html`: estilos `.warning` + container `#warnings` em modo "vazio = display:none".
- `popup.js`: lógica `renderState()` adiciona warnings dinamicamente quando `splitActive && (camPid && !camMarked)` ou `splitActive && (slidesPid && !slidesMarked)`.

Não há mudanças no `content.js` ou `style.css` — apenas UX no popup.

## v0.1.0 — 2026-04-28 — MVP funcional

Primeira release com extensão completa e validada em sessão real do Meet.

**Entregue:**
- Estrutura `extension/` com Manifest V3, content script, popup UI, CSS de modo seleção + split.
- Selection mode via click → captura `data-participant-id` do ancestral.
- Split mode com 2 `<video>` clones em `document.body` (escapando do stacking context do Meet) compartilhando `srcObject` dos originais.
- Auto-redetect heurístico para SLIDES quando o screenshare reinicia com novo PID.
- Filtro de cadáver (`srcObject !== null`) + listeners de stream (`loadedmetadata`/`emptied`) cobrem o caso de cam off/on, onde o Meet deixa elementos órfãos no DOM.
- HD Simulcast hint (off-screen 1920×1080) induz Meet a pedir tracks de alta resolução.
- Hardening anti-throttle: override de Page Visibility API + heartbeat rAF + flags Chrome documentadas.
- Posicionamento bottom-anchored com `object-position: 50% 100%` pra base do conteúdo coincidir com base da janela do Chrome — útil pra captura externa em coordenadas absolutas.
- `scripts/build-zip.ps1` empacotador de release.
- `TECHNICAL_NOTES.md` com descobertas do DOM do Meet, decisões e workarounds.

**Calibração iterativa em 8 versões internas:**
- v0.0.1: esqueleto inspetor (apenas DOM dump pra calibrar contra Meet real)
- v0.0.2: implementação fase 2 (selection mode + split mode com originais)
- v0.0.3: clones via `srcObject` (resolveu invisibilidade dos vídeos por stacking context)
- v0.0.4: ancoragem `bottom: 0` em vez de `top: 0`
- v0.0.5: `object-position: 50% 100%` (conteúdo colado na base)
- v0.0.6: HD Simulcast hint (off-screen 1920×1080 nos originais)
- v0.0.7: auto-redetect SLIDES + clones permanentes no DOM (zero flicker)
- v0.0.8: filtro de cadáver + listeners de stream (cam off/on)
- v0.1.0: bumpa pra release oficial após validação dos edge cases #1, #2, #3, #4, #6

**Edge case #5 (mudar layout do Meet) ainda pendente** — não bloqueante, viraria hotfix v0.1.x se aparecer fricção.

**Decisões arquiteturais documentadas em `TECHNICAL_NOTES.md`.**

## Próxima versão planejada — v0.2.x

- Validar edge case #5 (mudar layout) e fechar bugs descobertos em produção real.
- Suporte a múltiplas câmeras (1 prof + 1 convidado em painel único).
- Layouts customizáveis (PIP, 30/70).
- Auto-detecção heurística de cam vs slides (sem precisar click manual).
- Ícone próprio (16/48/128 PNG).
