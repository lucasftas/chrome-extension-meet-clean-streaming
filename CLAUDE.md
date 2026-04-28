# CLAUDE.md — Meet Split for Broadcast

Instruções específicas deste projeto para o Claude Code. Complementa as configurações globais do usuário (`~/.claude/CLAUDE.md`).

## Visão geral

Extensão Chrome (Manifest V3) que injeta manipulação de DOM no Google Meet para apresentar dois feeds de vídeo lado a lado em uma única janela limpa, capturável como dois ISO inputs por softwares de broadcast (vMix, OBS, Wirecast) via Desktop Capture + Crop.

**Stack:**
- Chrome Extension Manifest V3 (vanilla JS, sem framework, sem build step)
- HTML/CSS para popup
- `chrome.storage.local` para persistir referências de seleção durante a sessão
- `chrome.runtime` para mensageria popup ↔ content script

**Sem servidor, sem build, sem dependências runtime.** Apenas arquivos estáticos carregados pelo Chrome.

## Regras do projeto

### Privacidade — projeto será publicado

Este projeto **vai virar público** (GitHub público + possivelmente Chrome Web Store) quando ficar robusto. Por isso:

- **NÃO** incluir nomes de empresas, marcas pessoais, e-mails do dono ou referências a contextos privados em qualquer artefato versionado (código, docs, manifest, ícones, screenshots, mensagens de commit, release notes).
- Caso de uso descrito sempre de forma **genérica** — "operadores de broadcast", "produtoras educacionais", "eventos online" — sem citar empresa específica.
- Issues e PRs públicos no futuro: descrever bugs/features sem expor contexto interno.

### Convenções de código

- **JavaScript:** vanilla ES2020+, sem TypeScript no MVP. Indentação 2 espaços. Aspas simples. `const` por padrão, `let` quando precisa reatribuir.
- **CSS:** classes com prefixo `msb-` (Meet Split for Broadcast) para evitar colisão com classes do Meet.
- **HTML:** semântica simples no popup, sem framework.
- **Encoding:** UTF-8 sem BOM em `.js`, `.json`, `.html`, `.css`. Acentos em comentários OK (UTF-8).
- **Nomes:** identificadores em inglês (variáveis, funções, classes). Comentários em português OK quando explicam contexto não-óbvio.

### Manifest V3

- Permissões mínimas. MVP precisa de: `activeTab`, `storage`, `scripting`. **NÃO** pedir `<all_urls>` — usar `host_permissions: ["https://meet.google.com/*"]`.
- `content_scripts` com `matches: ["https://meet.google.com/*"]` e `run_at: "document_idle"`.
- Service worker (`background.js`) só se realmente necessário (ex: hotkeys via `commands` API). MVP não precisa.

### DOM manipulation no Meet

- O Meet é React e recria nodes constantemente — **sempre** usar `MutationObserver`, nunca query única no `DOMContentLoaded`.
- Identificar vídeos por click do usuário, não por heurística frágil de classes (que mudam).
- Persistir referência selecionada via atributo `data-msb-role="cam"` ou `"slides"` no elemento — sobrevive a re-renders melhor que ponteiros JS.

### Hardening anti-throttle

- JS keep-alive: loop com `requestAnimationFrame` que toca um `<canvas>` invisível, força o renderer a manter a página ativa.
- Override de `Page Visibility API` no content script para sinalizar `visibilityState = 'visible'` mesmo quando minimizado.
- Documentar no README as flags Chrome (`--disable-renderer-backgrounding`, `--disable-background-timer-throttling`, `--disable-backgrounding-occluded-windows`) como camada extra para o operador aplicar.

## Padrão de commits

Português + prefixo convencional + co-author Claude:

```
feat: implementa modo split-screen 50/50

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

Prefixos: `feat`, `fix`, `docs`, `refactor`, `style`, `test`, `chore`, `build`.

## Como rodar (alpha)

1. Abrir `chrome://extensions/`
2. Ativar **Modo de programador**
3. **Carregar não compactada** → selecionar a pasta do repositório
4. Acessar `meet.google.com/<sala>` e clicar no ícone da extensão

## Estrutura do projeto

```
chrome-extension-meet-clean-streaming/
├── manifest.json              # Manifest V3 (a criar)
├── content.js                 # MutationObserver, DOM cleanup, split layout (a criar)
├── style.css                  # Classes msb-* para layout split (a criar)
├── popup.html                 # UI do popup da extensão (a criar)
├── popup.js                   # Lógica do popup (a criar)
├── icons/                     # 16/48/128 PNG (a criar)
├── scripts/
│   └── build-zip.ps1          # Empacotador para release (a criar)
├── README.md                  # Documentação pública
├── CLAUDE.md                  # Este arquivo
├── CHANGELOG.md               # Keep a Changelog
├── IMPLEMENTATIONS.md         # Histórico de implementações por versão
├── OPERATIONS.md              # Log de operações por sessão
└── Implementação-Meet-ISO.md  # Spec original (referência histórica)
```

## Build / Release

A "build" é apenas um ZIP da pasta raiz (excluindo `.git`, `.md`, `scripts/`, `Implementação-Meet-ISO.md`):

```powershell
# scripts/build-zip.ps1 (a criar)
$version = (Get-Content manifest.json | ConvertFrom-Json).version
Compress-Archive -Path manifest.json,content.js,style.css,popup.html,popup.js,icons -DestinationPath "dist/meet-split-for-broadcast-v$version.zip" -Force
```

ZIP é anexado ao GitHub Release no gatilho `filé`.

## Gatilho `filé`

Quando o usuário disser **"filé"**, seguir o fluxo global definido em `~/.claude/CLAUDE.md`:
1. Detectar branch + versão (incrementar patch da última release; primeiro release = `v0.1.0`)
2. Build do ZIP via `scripts/build-zip.ps1`
3. Commit + push
4. `gh release create vX.Y.Z --title "vX.Y.Z" --generate-notes --target main` + `--draft` se mudanças visuais não foram testadas
5. Anexar o ZIP build ao release: `gh release upload vX.Y.Z dist/meet-split-for-broadcast-vX.Y.Z.zip`
6. Atualizar `CHANGELOG.md`, `IMPLEMENTATIONS.md`, `OPERATIONS.md`
7. Commit + push dos `.md`
