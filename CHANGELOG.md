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
