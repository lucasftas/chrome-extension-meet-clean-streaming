# Changelog

Todas as mudanças notáveis deste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/),
e este projeto adere ao [Versionamento Semântico](https://semver.org/lang/pt-BR/).

## [Unreleased]

### Planned para v0.2+
- Layouts customizáveis (PIP, 30/70, multi-câmera).
- Captura/extração de áudio do Meet.
- Auto-detecção de qual stream é cam vs apresentação (heurística + override manual).
- Atalhos de teclado globais.
- Ícone próprio (16/48/128 PNG).
- Publicação na Chrome Web Store.

## [0.2.4] - 2026-04-29

### Added
- **`scripts/create-chrome-shortcut.ps1`** — gerador de atalho Windows pra Chrome pré-configurado com as 3 flags de hardening (`--disable-renderer-backgrounding`, `--disable-background-timer-throttling`, `--disable-backgrounding-occluded-windows`). Detecta automaticamente o caminho do Chrome em locations padrão (Program Files / Program Files x86 / LocalAppData). Aceita parâmetros `-OutputFolder` (default: Desktop do usuário) e `-Name` (default: `Chrome (Broadcast)`).
- README com nova subseção em "Quick start": comando rápido `.\scripts\create-chrome-shortcut.ps1` em vez de instruções manuais de criação de atalho.

### Notes
- Sem mudanças funcionais na extensão. ZIP `v0.2.4` é binariamente equivalente ao `v0.2.3`/`v0.2.2`.
- O script foi smoke-tested contra o Chrome instalado: detecção, criação e validação do `.lnk` resultante OK.

## [0.2.3] - 2026-04-29

### Changed
- **README reescrito** em formato voltado pra atrair contribuidores e stargazers no GitHub: tagline impactante, ASCII art comparativo (Meet sujo vs feeds limpos), badges de release/Manifest/zero-deps, lista de features destacada, quick start em 3 passos, "Architecture in 2 minutes" mostrando o coração técnico (clone via `srcObject`), roadmap como checklist e CTA final pra estrela. Em inglês (audiência de operadores broadcast/vMix/OBS é global).
- **CLAUDE.md sanitizado** — removidas referências literais a strings privadas (que apareciam como exemplos do que evitar e acabavam vazando o que tentavam proteger). Agora usa categorias genéricas; termos exatos a serem grepados ficam no `~/.claude/CLAUDE.md` global do dono. Reforço da regra "tratar repo como público em todo commit, sempre".

### Added
- **`JOURNEY.md`** — relato narrativo do desenvolvimento em uma sessão de iteração intensa. Cobre o problema original, a spec que não sobreviveu, 9 versões internas (`v0.0.1`–`v0.0.8`) com a descoberta de cada bug e fix, 7 releases públicas e os principais insights técnicos (stacking context, cadáveres do Meet, listeners de stream, auto-redetect com false positive). Material útil pra novos contribuidores entenderem o "porquê" das decisões.

### Notes
- **Sem mudanças funcionais na extensão** — o ZIP `v0.2.3` é tecnicamente idêntico em comportamento ao `v0.2.2`. Esta release marca a maturidade documental do projeto e preparação pra eventual publicação pública do repositório.
- Auditoria de privacidade pré-publicação: `git grep` com padrões sensíveis retorna zero matches. Histórico do git limpo. Arquivos internos (`OPERATIONS.md`, `Implementação-Meet-ISO.md`, `novas_implementacoes/`, `*.code-workspace`) movidos pra `.gitignore` mantendo cópias locais.

## [0.2.2] - 2026-04-29

### Fixed
- **Auto-redetect SLIDES marcava cam de outro participante quando o slide ia pra popup nativa.** Quando o operador clica em "Abrir em uma nova janela" do screenshare, o tile do slide na janela principal perde o `data-participant-id` (Meet o "transfere" pra popup). O `findTileByPid(slidesPid)` retorna null → auto-redetect dispara → único candidato com `videoWidth >= 1000` que sobra é cam HD de outro participante → falso positivo, slide pane mostra cam.

### Changed
- **Filtro heurístico anti-cam** em `findScreenshareCandidate`: descarta tiles cuja sub-árvore contém classe `iPFm3e` ou cujo `<video>` tem classe `Gv1mTb-PVLJEc` (observação empírica: cams têm essas classes, screenshares não). Classes minificadas do Meet podem mudar entre versões — se pararem de funcionar, atualizar com base em snapshot novo do DOM.
- **Supressão de auto-redetect quando popup do slide está aberta**: o content script da popup seta `chrome.storage.local.msb_popup_open_at = Date.now()` ao carregar (com heartbeat de 5s) e remove em `beforeunload`/`pagehide`. A janela principal lê essa flag (com cache local atualizado via `chrome.storage.onChanged`) e pula o auto-redetect enquanto popup está ativa. Quando popup fecha, slide volta normal.

## [0.2.1] - 2026-04-29

### Fixed
- **Popup nativa do Meet ficava preta** (regressão da v0.2.0). A regra CSS `body[data-msb-meet-popup] > *:not(video) { display: none }` era agressiva demais — escondia os `<div>` wrappers que continham o `<video>`, fazendo o vídeo desaparecer junto.

### Changed
- Substituído o cleanup baseado em "esconder filhos" pela mesma estratégia da janela principal: **clone via `srcObject`** num `<video>` novo direto em `document.body` da popup. Robusto contra stacking context e estrutura DOM aninhada do Meet.
- Overlay preto fullscreen na popup (igual à janela principal) cobre UI residual sem precisar escondê-la elemento por elemento.
- Adicionados listeners de `loadedmetadata` / `emptied` nos `<video>` da popup pra cobrir o caso do Meet criar o vídeo antes do `srcObject` estar atribuído.

## [0.2.0] - 2026-04-28

### Added
- **Modos de layout** — substituem o toggle ON/OFF por 4 modos exclusivos:
  - `off` — sem split, Meet normal
  - `split` — 2 panes 50/50 lado a lado (CAM esq + SLIDES dir) — comportamento da v0.1.x
  - `solo-cam` — apenas clone CAM em fullscreen
  - `solo-slides` — apenas clone SLIDES em fullscreen
- **Detecção da popup nativa do Meet** ("Abrir em uma nova janela" do screenshare) — content script com `match_about_blank: true` é injetado nessa janela e aplica CSS de limpeza (esconde UI residual, maximiza video em fullscreen). Pronto pra ser capturado pelo vMix como Window Capture independente.
- **Popup Design 3 (Live Dashboard)** — redesign visual estilo OBS/vMix:
  - Top bar com indicador `🔴 LIVE` pulsando quando modo != off
  - Stats inline com PID + resolução (ex: `.../131 · 1280x720`)
  - Grid 2×2 de modos com ícones grandes
  - Info card de detecção da popup do Meet
- **Ícone próprio** — design REC + Split (2 retângulos coloridos + bolinha vermelha) em 16/48/128 PNG, gerado via `scripts/build-icons.ps1` (System.Drawing).
- **Menu de contexto expandido** — agora oferece itens diretos pra trocar modo:
  - Modo Off / Split 50/50 / Solo CAM / Solo SLIDES
  - Mantém Marcar CAM/SLIDES no tile clickado e Limpar.
  - `documentUrlPatterns` removido pra cobrir popup `about:blank` do Meet.

### Changed
- `state.splitActive` (boolean) substituído por `state.mode` (string). Migração automática: storage com `msb_split_active=true` vira `mode='split'`.
- `body.msb-active` agora é aplicado em qualquer modo != 'off' (mantido pra compat). Novas classes `body.msb-mode-{off|split|solo-cam|solo-slides}` controlam layout específico dos clones.
- Comando `setMode { mode }` substitui (mas mantém atalho `toggleSplit` que faz off↔split).

### Why
- Operadores em produção real precisam alternar rapidamente entre apresentar só a câmera, só os slides, ou ambos lado a lado durante uma transmissão. Modos exclusivos cobrem isso.
- O Meet já oferece nativamente "Abrir em uma nova janela" pro screenshare; em vez de duplicar essa funcionalidade, a extensão agora limpa essa popup automaticamente, fazendo cada janela virar 1 input nativo do vMix sem precisar de Crop.

## [0.1.2] - 2026-04-28

### Added
- **Menu de contexto (clique direito)** com comandos da extensão diretamente no menu nativo do Chrome. Resolve o caso da popup window do Meet ("Abrir em janela separada") onde o ícone da extensão na toolbar não está visível.
- Itens do menu:
  - **Marcar CAM/SLIDES no tile clickado** — captura o `data-participant-id` direto do elemento sob o cursor (clique direito), sem precisar do fluxo de 2 cliques (botão no popup + click no tile).
  - **Ativar/Desativar Split** — toggle direto.
  - **Limpar seleções** — reset rápido.
- `extension/background.js` (service worker) registrando os menus em `chrome.runtime.onInstalled` e `onStartup`, com `documentUrlPatterns` restrito a `meet.google.com`.
- Permissão `contextMenus` adicionada ao manifest.
- Listener de `contextmenu` no content.js memoriza o último target pra ser usado em "Marcar X no tile clickado".

## [0.1.1] - 2026-04-28

### Added
- Avisos no popup quando split está ativo mas o tile correspondente não está no DOM (típico do layout "Em destaque" do Meet, que faz culling de tiles fora de destaque).
- Mensagem de orientação no aviso de CAM: sugere usar layouts Auto/Mosaico/Lado a lado, ou fixar/Spotlight a cam marcada.
- Mensagem de orientação no aviso de SLIDES: lembra do auto-redetect quando screenshare reinicia.

## [0.1.0] - 2026-04-28

### Added
- `extension/manifest.json` Manifest V3 com permissões mínimas (`activeTab`, `storage`, `scripting`, `clipboardWrite`, host `meet.google.com`).
- `extension/content.js` com `MutationObserver` + listeners de stream (`loadedmetadata`/`emptied`) pra detectar entrada/saída de mídia.
- `extension/style.css` com classes `msb-*` pra modo seleção (cursor crosshair + outline em hover) e modo split (overlay preto fullscreen + clones em fixed 50/50, bottom-anchored, `object-position: 50% 100%`).
- `extension/popup.html` + `extension/popup.js` com botões "Marcar CAM", "Marcar SLIDES", "Toggle Split", "Limpar seleções", "Atualizar" e seção de debug com inspetor de DOM.
- Seleção manual via click: capture de `data-participant-id` no ancestral do tile clicado, persistência em `chrome.storage.local`.
- **Clones via `srcObject`**: `<video>` novos criados em `document.body` recebem a `MediaStream` dos originais — escapam do stacking context do Meet sem custo de banda.
- **Auto-redetect SLIDES**: quando o `slidesPid` salvo não existe mais (screenshare reiniciado gera device novo), busca candidato com heurística (`videoWidth >= 1000`, área de tile >= 60.000px², PID diferente do `camPid`) e atualiza storage automaticamente. Sem intervenção do operador.
- **Filtro de cadáver**: `markLiveVideosInTile` só aplica `data-msb-role` em `<video>` com `srcObject` não-null, evitando confundir com elementos antigos que o Meet deixa no DOM ao desligar a câmera.
- **HD Simulcast hint**: força `<video>` originais a renderizar off-screen em 1920×1080 (`left: -10000px`), induzindo o Meet a pedir tracks de alta resolução do simulcast.
- **Hardening anti-throttle**: override de `document.hidden`/`document.visibilityState`, supressão de `visibilitychange` events, heartbeat de `requestAnimationFrame`. Flags Chrome documentadas no README como camada extra.
- **Estabilidade pra captura externa**: clones permanecem no DOM enquanto split ativo (mesmo sem stream — pane fica preto, sem flicker/reflow). Sem avisos textuais que poderiam vazar pro vMix Crop. Ancoragem `bottom: 0` mantém posição estável independente de barra de favoritos do Chrome.
- `scripts/build-zip.ps1` empacotador de release.
- `TECHNICAL_NOTES.md` documentando estrutura do DOM do Meet, decisões arquiteturais, workarounds e edge cases validados.

### Edge cases validados em sessão real
- #1 Refresh do Meet (F5) com split ativo
- #2 Screenshare para e volta a compartilhar
- #3 Câmera off/on
- #4 Sair e voltar na mesma sala
- #6 Múltiplos participantes (3+) com fix/spotlight em outras cams
