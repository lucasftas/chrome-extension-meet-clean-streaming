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

## Próxima versão planejada — v0.1.0 (MVP)

- Implementação dos 4 pilares do MVP: split-screen, seleção por click, toggle pelo popup, hardening anti-pause + flags documentadas.
