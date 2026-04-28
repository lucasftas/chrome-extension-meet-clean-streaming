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
