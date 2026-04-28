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
