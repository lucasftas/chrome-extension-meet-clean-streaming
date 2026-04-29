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

### Privacidade — repositório PÚBLICO

⚠️ **Tratar este repositório como público em todo commit, sempre.** Mesmo se estiver privado no GitHub no momento, qualquer mudança pode virar pública a qualquer instante — não há janela "vou publicar depois, deixo passar agora". Toda decisão de versionamento assume audiência aberta.

**Categorias que NUNCA devem ser versionadas:**

- **Identidade do dono ou de empresas/marcas associadas a ele** — nomes comerciais, marcas pessoais, e-mails reais, redes sociais, telefones. Caso de uso e contexto sempre genéricos ("operadores de broadcast", "produtoras de conteúdo educacional"), nunca específicos.
- **Paths locais de máquina** (qualquer caminho absoluto começando com letra de drive seguida de `\` ou `/Users/`). Substituir por descrição genérica tipo `<pasta-de-streaming>` ou simplesmente "uma pasta na sua máquina".
- **IDs de salas/sessões de testes do Meet** — códigos como o que aparece após `meet.google.com/`, identificadores de space (`spaces/{...}`) ou device (`devices/{...}`). Sanitizar para placeholders genéricos como `meet.google.com/abc-defg-hij` e `spaces/<space>/devices/<device>` antes de incluir em docs/mocks.
- **JSONs de inspeção do DOM** (snapshots) com IDs reais — sanitizar PIDs e space IDs antes de versionar.
- **Logs de console** com PIDs reais — substituir por placeholders.
- **Screenshots** com URLs reais, nomes de pessoas ou conteúdo confidencial de slides visíveis. Borrar ou regerar antes de incluir.
- **Nomes de participantes** em testes — usar "professor", "convidado", "apresentador", "operador" em vez de nomes reais (mesmo placeholders que pareçam com pessoas reais devem ser evitados).

**Sempre escrever de forma genérica em mensagens de commit, descrições de PR, release notes** — descrever bugs/features sem expor contexto interno.

**Checklist obrigatório antes de commit/release que toca docs, mocks ou JSONs de exemplo:**

Rodar do raiz do repo:

```bash
# Padrões a verificar (lista de termos é gerenciada localmente, não versionada)
# Se algum match aparecer fora dos lugares esperados, sanitizar antes de commitar.
git grep -iE "<padrão1>|<padrão2>|<padrão3>"
```

Os termos exatos a procurar (nomes de empresa do dono, IDs de salas reais usadas em testes, paths absolutos da máquina) são pessoais e ficam no `~/.claude/CLAUDE.md` global do dono — não são versionados aqui.

**Resultado esperado:** zero matches (exceto links pro próprio repositório, que são corretos).

**Quando o usuário fornecer dados reais durante o desenvolvimento** (ex: cola JSON do DOM com PIDs reais, ou path absoluto da máquina dele), Claude deve:

1. Usar pra debug imediato (OK no chat / análise efêmera).
2. **Sanitizar** antes de incluir em qualquer arquivo versionado (.md, mock HTML, código, screenshot, JSON de exemplo).
3. Avisar proativamente se identificar dado sensível sendo incluído por engano em arquivo a ser commitado.

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
3. **Carregar não compactada** → selecionar a pasta `extension/` (NÃO a raiz do repo)
4. Acessar `meet.google.com/<sala>` e clicar no ícone da extensão

## Estrutura do projeto

```
chrome-extension-meet-clean-streaming/
├── extension/                 # Tudo que vai no ZIP da Load unpacked
│   ├── manifest.json          # Manifest V3
│   ├── content.js             # MutationObserver, DOM cleanup, split layout
│   ├── style.css              # Classes msb-* para layout split
│   ├── popup.html             # UI do popup da extensão
│   ├── popup.js               # Lógica do popup
│   └── icons/                 # 16/48/128 PNG (a criar)
├── scripts/
│   └── build-zip.ps1          # Empacotador para release (a criar)
├── README.md                  # Documentação pública
├── CLAUDE.md                  # Este arquivo
├── CHANGELOG.md               # Keep a Changelog
├── IMPLEMENTATIONS.md         # Histórico de implementações por versão
└── TECHNICAL_NOTES.md         # Notas técnicas, decisões arquiteturais e workarounds

# Arquivos LOCAIS (não versionados, ver .gitignore):
# - OPERATIONS.md              Log de processo de desenvolvimento (sessões internas)
# - Implementação-Meet-ISO.md  Spec original que evoluiu durante o desenvolvimento
# - novas_implementacoes/      Mocks interativos de design
# - *.code-workspace           Config local do VSCode
```

**Por que `extension/` separado?** Tudo que o Chrome carrega via Load unpacked fica num único diretório isolado, sem misturar com docs/scripts do repo. O `build-zip.ps1` empacota exatamente o conteúdo de `extension/` — sem filtros nem exclusões manuais.

## Build / Release

A "build" é apenas um ZIP do conteúdo de `extension/` (sem incluir a pasta `extension/` em si — Chrome Web Store espera `manifest.json` na raiz do ZIP):

```powershell
# scripts/build-zip.ps1 (a criar)
$version = (Get-Content extension/manifest.json | ConvertFrom-Json).version
Compress-Archive -Path extension/* -DestinationPath "dist/meet-split-for-broadcast-v$version.zip" -Force
```

ZIP é anexado ao GitHub Release no gatilho `filé`.

## Gatilho `filé`

Quando o usuário disser **"filé"**, seguir o fluxo global definido em `~/.claude/CLAUDE.md`:
1. Detectar branch + versão (incrementar patch da última release; primeiro release = `v0.1.0`)
2. Build do ZIP via `scripts/build-zip.ps1`
3. Commit + push
4. `gh release create vX.Y.Z --title "vX.Y.Z" --generate-notes --target main` + `--draft` se mudanças visuais não foram testadas
5. Anexar o ZIP build ao release: `gh release upload vX.Y.Z dist/meet-split-for-broadcast-vX.Y.Z.zip`
6. Atualizar `CHANGELOG.md` e `IMPLEMENTATIONS.md` (versionados). `OPERATIONS.md` é local — atualizar opcionalmente como log pessoal.
7. Commit + push dos `.md`
