# Changelog

Todas as mudanças notáveis deste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/),
e este projeto adere ao [Versionamento Semântico](https://semver.org/lang/pt-BR/).

## [Unreleased]

### Added
- Estrutura inicial do repositório (README alpha, CLAUDE.md do projeto, .gitignore, índices de docs).
- Spec técnica de referência preservada em `Implementação-Meet-ISO.md`.

### Planned para v0.1.0
- `manifest.json` Manifest V3 com permissões mínimas.
- `content.js` com `MutationObserver` e lógica de DOM cleanup.
- Modo split-screen 50/50 (CAM esquerda + SLIDES direita).
- Popup com botões "Marcar CAM", "Marcar SLIDES", "Toggle Split".
- Seleção manual via click no vídeo desejado.
- Keep-alive contra throttling de aba inativa.
- Documentação de flags Chrome de hardening no README.
- Ícone próprio (16/48/128 PNG).
- Script `build-zip.ps1` para empacotar release.
