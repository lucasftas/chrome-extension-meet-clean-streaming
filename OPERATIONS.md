# Operations Log

Registro de operações e solicitações por sessão. Cada entrada agrupa as ações realizadas em uma data específica.

## 2026-04-28 — Captura da ideia (gatilho `bora`)

- [x] Leitura da spec preexistente (`Implementação-Meet-ISO.md`).
- [x] Entrevista em 4 rodadas via `AskUserQuestion` (proposta, fluxo, ajustes na spec, escopo MVP/branding).
- [x] Decisões arquiteturais capturadas: janela única split (em vez de duas), controle via popup (sem PowerShell), seleção por click, hardening duplo.
- [x] Regra global de privacidade adicionada ao `~/.claude/CLAUDE.md` (não vincular projetos potencialmente públicos à empresa do dono).
- [x] `README.md` alpha gerado e validado.
- [x] Estrutura base criada: `.gitignore`, `CLAUDE.md` do projeto, `CHANGELOG.md`, `IMPLEMENTATIONS.md`, `OPERATIONS.md`.
- [x] Repositório criado no GitHub como privado.
- [x] Primeiro commit + push.

## 2026-04-28 — Implementação MVP iterativa + release v0.1.0 (gatilho `filé`)

- [x] Subpasta `extension/` criada e arquivos da extensão movidos pra lá (separa o que vai no ZIP da Load unpacked dos docs do repo).
- [x] Calibração contra DOM real do Meet via inspetor (snapshot JSON dos `<video>` e ancestrais), descoberta do `data-participant-id` como âncora estável.
- [x] Implementação fase 2 → fase 8 em ciclos curtos com testes em sala real do Meet:
  - v0.0.2: selection mode + split mode (vídeos invisíveis — stacking context).
  - v0.0.3: clones via `srcObject` em `document.body` resolveu visibilidade.
  - v0.0.4: ancoragem `bottom: 0`.
  - v0.0.5: `object-position: 50% 100%`.
  - v0.0.6: HD Simulcast hint via off-screen 1920×1080.
  - v0.0.7: auto-redetect SLIDES + clones permanentes (zero flicker pro vMix).
  - v0.0.8: filtro de cadáver + listeners de stream (cam off/on).
- [x] Edge cases validados em sessão real: #1 (F5), #2 (screenshare para/volta), #3 (cam off/on), #4 (sair/voltar sala), #6 (3+ participantes).
- [x] Edge case #5 (mudar layout do Meet) pendente — não bloqueante.
- [x] `TECHNICAL_NOTES.md` consolidando descobertas do DOM, decisões e workarounds.
- [x] `scripts/build-zip.ps1` empacotador de release.
- [x] Bump manifest pra v0.1.0, build do ZIP (10.72 KB).
- [x] Commit + push da implementação MVP.
- [x] `gh release create v0.1.0 --generate-notes --target main` + upload do ZIP anexado.
- [x] Atualização de CHANGELOG, IMPLEMENTATIONS, OPERATIONS.
- [x] Validação edge case #5 (mudar layout do Meet) — ⚠️ funciona com fricção: layouts Auto/Mosaico/Lado a lado OK, **"Em destaque" remove a cam do DOM** se não for o tile destacado. Limitação documentada em `TECHNICAL_NOTES.md` (5.5) e em recomendações de uso no `README.md`.
- [x] Confirmação de que o HD Simulcast hint não vence layout pequeno (seção 5.6 em `TECHNICAL_NOTES.md`) — Spotlight da cam marcada é a única alavanca confiável pra HD.
- [x] Hotfix v0.1.1 — avisos no popup quando tile da CAM/SLIDES sumiu do DOM (cobertura UX do edge case "Em destaque").
- [x] Build v0.1.1 + commit + release + docs.
- [x] Validação end-to-end com vMix Desktop Capture.
- [x] Atalho `Chrome (vMix).lnk` criado em `D:\Editor - Lucas\~ Streaming\` com as 3 flags de hardening pré-aplicadas.
- [x] Diagnóstico: occluded/background = OK com flags; minimize ainda pausa (decisão Windows/Chrome). Workaround: deixar occluded (não minimizar).
- [x] Teste de Browser Input nativo do vMix com CSS injection — descartado (CEF perde sessão Google a cada Update + sem JS, não há split).
- [x] Validação de Window Capture Method — `WindowsGraphicsCapture` é o melhor (WGC moderno, suporta GPU-rendered + occlusion). GDI falha com Chrome. DWM intermediário.
- [x] Atualização de README e TECHNICAL_NOTES com seção 7 (vMix setup completa) e seção "Recomendações de uso em produção".
- [x] Feature v0.1.2 — menu de contexto (clique direito) com comandos da extensão. Cobre o caso da popup window do Meet ("Abrir em janela separada") onde não há ícone da extensão na toolbar. Captura PID direto do tile clickado, sem fluxo de 2 cliques.
- [x] Build v0.1.2 + commit + release + docs.
- [x] Mock interativo `novas_implementacoes/multi-window-modes/mock-modes.html` criado com 6 ícones propostos + 4 designs de popup + 5 cenários de modos.
- [x] Decisões de design v0.2.0 validadas com usuário: ícone E (REC + Split), Design 3 (Live Dashboard), 4 modos exclusivos (Off/Split/Solo CAM/Solo SLIDES), popup nativa do Meet usada (não Document PiP custom).
- [x] Implementação v0.2.0:
  - `content.js` refatorado: `state.mode` substitui `splitActive`, bifurcação main/popup, comando `setMode`.
  - `style.css` reescrito com regras por modo + cleanup popup.
  - `manifest.json`: `match_about_blank: true` + `all_frames: true`, `default_icon`, version 0.2.0.
  - `popup.html` + `popup.js` redesenhados (Design 3 Live Dashboard com badge LIVE pulsando).
  - `background.js` com 4 itens de menu pra trocar modo direto.
  - `scripts/build-icons.ps1` gerando PNGs do design E em 16/48/128.
- [x] Build v0.2.0 (15.65 KB) + commit + release + docs.
- [x] Hotfix v0.2.1 — popup nativa do Meet ficava preta. Causa: regra CSS `body[data-msb-meet-popup] > *:not(video) { display:none }` escondia `<div>` wrapper junto com `<video>` dentro. Solução: clone via srcObject (mesma estratégia da janela principal) + overlay preto. Build + commit + release.
- [x] Hotfix v0.2.2 — auto-redetect SLIDES marcava cam de outro participante quando slide ia pra popup nativa. Causa: tile do slide na janela principal perde `data-participant-id` ao abrir popup; único candidato HD que sobra com PID é cam HD de outro participante. Solução: (1) filtro heurístico anti-cam (classes `iPFm3e` e `Gv1mTb-PVLJEc`), (2) supressão de auto-redetect via flag `msb_popup_open_at` em `chrome.storage.local` setada pela popup. Build + commit + release.
