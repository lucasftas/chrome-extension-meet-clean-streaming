# Journey — Building Meet Split for Broadcast

> Devblog narrativo de como esta extensão saiu do "talvez funcione" para "rodando em produção" em uma única tarde de iteração intensa, com colaboração entre o operador de broadcast (que conhece o problema na pele) e o Claude Code (que escreve o código). Sete releases públicas, nove versões internas, um problema de stacking context que quase derrubou tudo, e uma descoberta que mudou a arquitetura no meio do caminho.

---

## A dor que originou

Operadores de transmissão ao vivo que precisam ter um convidado remoto via Google Meet sofrem com um problema crônico: a interface do Meet foi desenhada para reuniões, não para broadcast. Mesmo no modo "apresentação", a janela vem com nomes de participantes, contornos amarelos, controles de microfone, ícones de mão levantada — e tudo aparece em cima do vídeo no momento errado, na frente da audiência da live.

A solução tradicional do mercado é **dois computadores**: um rodando Chrome com o Meet logado para a câmera, outro rodando Chrome com o Meet logado para os slides. Cada máquina vira uma fonte do switcher de broadcast. Funciona, mas custa duas máquinas, duas contas Google, duas conexões de banda, e uma configuração frágil onde a apresentação aparece duas vezes no Meet do convidado.

Há também os NDI gateways pagos. Funcionam bem, custam caro. Não cabe pra uso esporádico.

A pergunta que originou este projeto: **dá pra resolver isso com uma única instância do Chrome, sem hardware extra, sem segunda conta, sem assinatura de software profissional?**

A resposta acabou sendo sim — mas o caminho até lá teve mais reviravoltas do que parecia.

---

## A spec original (que não sobreviveu intacta)

A primeira versão do plano era direta: abrir **duas janelas Chrome em modo `--app`** com perfis isolados (`--user-data-dir`), cada uma navegando pro Meet com um query string diferente (`?vMixMode=cam` e `?vMixMode=slides`). Uma extensão Chrome leria esse parâmetro e usaria CSS para esconder a UI e maximizar o vídeo correspondente.

Tudo parecia razoável até a primeira pergunta de checagem: "espera, mas duas janelas no mesmo perfil Chrome no mesmo Meet — isso não vai gerar uma kicar a outra?". E sim, gera. O Meet é estritamente um-participante-por-conta-por-sala. Pra contornar, perfis isolados (= contas isoladas) ou hack frágil.

A primeira reviravolta veio cedo: **a entrevista inicial fez o operador notar que ele não precisa de duas janelas, ele precisa de duas regiões capturáveis**. O switcher de broadcast (vMix) já tem Crop nativo. Se a extensão renderizar **uma única janela com cam à esquerda e slides à direita**, o vMix faz Crop em cada metade e cria dois inputs. Uma conexão WebRTC, uma conta Google, uma janela. Resolvido — antes de escrever código.

Lição zero: questionar a spec antes de implementar costuma economizar 80% do trabalho.

---

## Iteração v0.0.1 — calibração às escuras

A primeira versão era uma extensão **sem nenhuma feature**. Apenas um inspetor de DOM: o popup tinha um único botão "Inspecionar DOM" que coletava todos os `<video>` da página, mais oito níveis de ancestrais, e copiava o JSON pra clipboard.

O motivo: ninguém sabia como o DOM real do Meet em 2026 estava estruturado. Classes CSS minificadas mudam, atributos vão e vêm. Tentar implementar selection mode + split em cima de um chute teria desperdiçado várias iterações. Calibrar primeiro contra o DOM verdadeiro economizou tempo.

O snapshot revelou o atributo crucial: **`data-participant-id`** no ancestral 6 (`div.oZRSLe`) — formato `spaces/{spaceId}/devices/{deviceId}`. Estável durante a sessão para a câmera de cada participante. Esse virou a âncora de toda a arquitetura.

Outro insight: classes minificadas como `iPFm3e`, `Gv1mTb-PVLJEc` apareciam consistentemente em tiles de cam mas não em screenshares. Heurística frágil em tese, mas útil como fallback de segurança em cenários degenerados (como veríamos depois).

---

## v0.0.2 — implementação ingênua

A primeira tentativa de implementação propriamente dita: selection mode (clique no popup → cursor crosshair → clique no tile do Meet → captura `data-participant-id`), persistência em `chrome.storage.local`, MutationObserver re-aplicando `data-msb-role="cam"` ou `"slides"` nos `<video>` correspondentes. Split mode com CSS `position: fixed; left: 0; width: 50vw; height: 100vh` no vídeo da cam, espelhado pra direita pro slide. Overlay preto pra cobrir a UI do Meet por trás. Z-index máximo (`2147483647`).

Pareceu funcionar nos testes locais. Foi pro Meet real.

**Tela toda preta.** Os vídeos não apareciam.

O JSON do snapshot mostrava: `data-msb-role` aplicado corretamente, posições calculadas certas (rect 0,0 → 1280×1305), `srcObject` ativo, `videoWidth` válido. Por toda lógica deveria estar funcionando. Mas estava preto.

---

## v0.0.3 — o problema de stacking context

A causa veio depois de algumas hipóteses descartadas. Algum ancestral dos `<video>` na hierarquia do Meet criava **stacking context** — provavelmente um `transform: translate3d(0,0,0)` ou `will-change` no CSS computado, otimização do React. Stacking context em CSS é um conceito sutil: quando um elemento o cria, todos os descendentes ficam "presos" dentro dele para fins de empilhamento, e seu `z-index` só compete dentro daquele contexto. Mesmo um `position: fixed` num descendente fica âncora ao ancestral transformado, não ao viewport.

Resultado: o `<video>` que eu mandava posicionar fixed em z-index máximo era na realidade renderizado dentro do "contexto" do tile original do Meet — abaixo do meu overlay preto que era filho direto do `<body>`.

A solução foi a primeira virada de jogo da arquitetura: **clonar via `srcObject`**. Em vez de tentar promover o `<video>` original (preso na hierarquia), a extensão cria um `<video>` novo direto em `document.body` (fora de qualquer stacking context) e atribui a ele a `MediaStream` do original. Mesma stream, sem custo extra de banda, posicionamento limpo.

```js
const clone = document.createElement('video');
clone.autoplay = true;
clone.playsInline = true;
clone.muted = true;
clone.srcObject = original.srcObject; // mesma MediaStream, sem duplicar
document.body.appendChild(clone);
```

Funcionou de primeira. Os dois feeds apareceram limpos, lado a lado, sem nada do Meet vazando. Esse é o coração técnico da extensão até hoje.

---

## v0.0.4 e v0.0.5 — refinamentos visuais

Duas iterações curtas guiadas pelo operador testando captura externa:

**v0.0.4 — bottom anchored.** A janela do Chrome muda de tamanho conforme você liga/desliga a barra de favoritos. Com `top: 0; height: 100vh`, o **bottom dos boxes sobe** em coordenadas absolutas quando a viewport encolhe. Trocando pra `bottom: 0; height: 100vh`, a base dos boxes fica fixa no bottom da janela do Chrome. Cliente externo que faz Crop em coordenadas absolutas (vMix com Crop em pixels do desktop) vai sempre achar o conteúdo na mesma região.

**v0.0.5 — `object-position: 50% 100%`.** Com `object-fit: contain`, vídeo de aspect 16:9 num pane portrait quase quadrado fica letterboxed verticalmente (preto em cima e embaixo). Default `50% 50%` centraliza, dividindo o letterbox. `50% 100%` cola o conteúdo do vídeo na **base** do pane — letterbox todo em cima, base do vídeo coincide com base da janela. Cliente externo pode capturar os últimos N pixels a partir do bottom e sempre tem vídeo, nunca preto. Pequena mudança, grande efeito em produção.

---

## v0.0.6 — o truque do simulcast

Outra questão recorrente: a câmera vinha em **640×360** (SD). O remetente estava enviando HD, mas o Meet só entregava 360p. Por quê?

Por causa do **Simulcast**: o Meet envia múltiplas resoluções da mesma cam simultaneamente, e o decoder escolhe qual decodificar baseado no tamanho do `<video>` renderizado. Tile pequeno → pede 360p. Tile grande → pede 720p+. O nosso clone era 1280×1305, mas o Meet **decide pelo `<video>` original**, não pelo clone. E o original ficava no tile pequeno do Meet.

A solução foi um truque visual: forçar o `<video>` original a ser renderizado em 1920×1080 **off-screen** (`left: -10000px`). O navegador continua decodificando porque o elemento está no DOM com tamanho declarado. O Simulcast do Meet vê o bounding rect grande e pede a track HD. O clone, que compartilha a mesma `MediaStream`, automaticamente recebe HD.

Funcionou parcialmente. Não vence layout muito pequeno na janela do Meet (Meet às vezes redimensiona dinamicamente). Spotlight/Pin no tile da cam marcada continua sendo a alavanca mais confiável pra forçar HD.

---

## v0.0.7 — auto-redetect SLIDES + zero flicker

Em produção real, o convidado pode parar de compartilhar tela e voltar a compartilhar — pra trocar de aplicativo, alternar slides, etc. Cada nova sessão de screenshare gera um **device ID diferente** no Meet (o `data-participant-id` muda). Sem tratamento, o `slidesPid` salvo vira stale e o pane direito fica preto pra sempre, exigindo o operador re-marcar SLIDES manualmente — durante a live.

Solução: **auto-redetect**. Quando `findTileByPid(slidesPid)` retorna null, a extensão busca um tile candidato com heurística:
- `data-participant-id` diferente do `camPid`
- Contém `<video>` com `videoWidth >= 1000` (descarta cams 360p/720p)
- Tile com `getBoundingClientRect()` > 300×200 (descarta miniaturas tipo self-view com 124×78)
- Em caso de empate, escolhe o de maior área visual

Quando encontra candidato, atualiza `slidesPid` no storage automaticamente. Operador não precisa mexer.

Outro refinamento crítico veio junto: durante a transição "screenshare parou e ainda não voltou", o pane direito ficava com flicker de elemento removido/recriado, o que aparecia como artefato no preview do vMix. Solução: **clones nunca saem do DOM enquanto split estiver ativo** — se o original some, o clone fica com `srcObject = null` (pane preto, mas elemento permanece). Quando a stream volta, atribui o novo `srcObject` ao clone existente. Sem reflow, sem flicker.

---

## v0.0.8 — cadáveres do Meet

Outro caso de produção: o operador desliga a câmera no Meet pra tomar um café e depois religa. O pane esquerdo ficava preto e não voltava sozinho.

Investigação revelou um comportamento curioso do Meet: quando uma câmera é desligada, o Meet **não remove** o `<video>` do DOM. Apenas adiciona `style="display: none"` e seta `srcObject = null`. Quando a câmera religa, o Meet **cria um `<video>` novo no mesmo tile** sem remover o antigo. Resultado: dois `<video>` coexistem no mesmo tile, ambos com `data-uid` igual (Meet reusa).

A função `markLiveVideosInTile` aplicava `data-msb-role` em todos os `<video>` do tile via `forEach`. Os dois ganhavam o role. O `syncClones` usava `document.querySelector(...)` que retorna o primeiro match — pegava o cadáver com `srcObject = null`. Clone ficava sem stream.

Solução em duas camadas:
1. **Filtro de cadáver:** `markLiveVideosInTile` só aplica `data-msb-role` em `<video>` que tem `srcObject` truthy.
2. **`syncClones` defensivo:** usa `querySelectorAll` e escolhe o primeiro com `srcObject` não-null, mesmo se múltiplos elementos tiverem o role.

Mais um detalhe descoberto na mesma iteração: `MutationObserver` com `childList: true, subtree: true` detecta nodes aparecendo no DOM, mas **não detecta mudança de `srcObject`** (é property JS, não atributo). Então quando o Meet criava o `<video>` novo sem srcObject ainda atribuído, o observer disparava, `applyMarks` rodava, ninguém era marcado, e quando o Meet atribuía srcObject no tick seguinte (property change), nada disparava. Pane ficava preto pra sempre.

Solução: a cada `<video>` novo detectado, attachar listeners de `loadedmetadata` (stream chegou) e `emptied` (srcObject foi anulado), que disparam re-apply nos momentos exatos.

---

## v0.1.0 — release MVP funcional

Com `v0.0.8` rodando estável em sessão real do Meet (cobrindo refresh, cam off/on, screenshare reset, sair/voltar sala, múltiplos participantes, mudança de layout), foi feita a primeira release pública: **v0.1.0**. Build do ZIP, GitHub Release com auto-generated notes, ZIP anexado, documentação atualizada.

O MVP cobria os 4 pilares planejados:
- Modo split-screen 50/50 com CAM esquerda + SLIDES direita
- Seleção manual via click (popup → click no tile)
- Toggle ON/OFF pelo popup
- Hardening anti-throttle: keep-alive na extensão + flags Chrome documentadas no README

E descobertas extras feitas no caminho:
- Auto-redetect SLIDES com heurística por área/resolução
- Filtro de cadáver e listeners de stream
- Bottom-anchored com object-position 50% 100%
- HD Simulcast hint via off-screen 1920×1080

---

## v0.1.1 — quando split não consegue mostrar

Validação do edge case "Em destaque" do Meet revelou: o algoritmo de culling do Meet **remove do DOM** os `<video>` de participantes que não estão em destaque nem na barra lateral. Se a cam marcada como CAM na extensão não é o tile destacado, ela some — sem tile no DOM, sem `data-participant-id` correspondente, `applyMarks` não acha nada e o clone cam fica preto.

Não é remediável via JS. Mitigação documentada (usar layouts Auto/Mosaico/Lado a lado, ou Spotlight a cam marcada), mas precisava de feedback visual: quando o split está ativo mas o tile sumiu, o operador precisa saber por quê — não pode ficar tentando "ativar split de novo" às cegas.

A `v0.1.1` adicionou **avisos no popup** quando split está ativo + slot marcado mas o tile correspondente não está no DOM. Aviso laranja explicando a causa provável (layout incompatível) e como mitigar (mudar layout, dar Spotlight). Sem vazar pro vMix Crop (não é texto sobreposto na janela, só no popup do operador).

---

## v0.1.2 — menu de contexto

Um insight de uso: o operador descobriu o recurso nativo "Abrir em uma nova janela" do Meet, que abre o screenshare como popup window do Chrome **sem barra de URL**. Sem barra, sem ícone da extensão na toolbar, sem como acessar comandos. Operador ficava preso.

Solução: **menu de contexto** via `chrome.contextMenus` API. Clique direito em qualquer lugar do Meet (incluindo popup window) mostra itens da extensão direto no menu nativo do Chrome — Marcar CAM/SLIDES no tile clickado, Toggle Split, Limpar.

Bonus de UX: o item "Marcar CAM no tile clickado" captura o `data-participant-id` direto do elemento sob o cursor (via `lastContextTarget` memorizado no event handler), eliminando o fluxo de 2 cliques (botão no popup + click no tile). Em produção: 1 ação, sem alternar janela.

---

## v0.2.0 — modos de layout + popup nativa + Design 3 + ícone

A maior release até aqui. Quatro mudanças combinadas:

**1. Modos exclusivos** — substitui o toggle binário por 4 estados: `off` / `split` / `solo-cam` / `solo-slides`. Operador pode mostrar só a câmera fullscreen (pré-show), só os slides fullscreen (palestra técnica sem rosto), ou ambos lado a lado (interview style). State machine refatorada com migração automática do storage antigo (`splitActive` → `mode`).

**2. Popup nativa do Meet** — em vez de implementar Document Picture-in-Picture custom, a extensão **usa o que o Meet já oferece** ("↗ Abrir em uma nova janela"). Detecta a popup `about:blank` via `match_about_blank: true` no manifest, injeta CSS de limpeza, maximiza o vídeo em fullscreen. Cada janela vira um input nativo do vMix sem precisar de Crop.

**3. Popup redesenhado (Design 3)** — Live Dashboard estilo OBS/vMix. Top bar com indicador `🔴 LIVE` pulsando quando modo ≠ off. Stats inline com PID + resolução real (`videoWidth × videoHeight`). Grid 2×2 de modos com ícones grandes. Antes do código novo, foi criado um interactive storyboard HTML com 4 designs alternativos pra escolher visualmente — economizou várias iterações.

**4. Ícone próprio** — design "REC + Split": dois retângulos coloridos (azul para cam, verde para slides) com bolinha vermelha de REC no topo, fundo preto rounded. Gerado proceduralmente via `scripts/build-icons.ps1` (PowerShell + System.Drawing) em 16/48/128 PNG. Sem dependência de Inkscape ou ImageMagick — qualquer máquina Windows reproduz com `.\build-icons.ps1`.

---

## v0.2.1 — popup ficava preta

Regressão da v0.2.0: a regra CSS `body[data-msb-meet-popup] > *:not(video) { display: none }` era **agressiva demais**. A estrutura do Meet é `body > div > div > ... > video` (vídeo aninhado em wrappers, não filho direto do body). A regra escondia os `<div>` pais — e como o `<video>` está dentro deles, sumia visualmente junto.

Solução: aplicar a mesma estratégia de clone via `srcObject` que já tinha resolvido o problema na janela principal (v0.0.3). Na popup, detectar `<video>` original mais "vivo", criar clone novo em `document.body`, atribuir stream. CSS posiciona clone em `position: fixed` fullscreen. Overlay preto via `::before` cobre UI residual sem precisar escondê-la elemento por elemento.

Mesma estratégia, mesma robustez. Funcionou na primeira tentativa.

---

## v0.2.2 — auto-redetect false positive

Cenário reportado em produção real: operador marca CAM e SLIDES, ativa split, funciona. Desliga split. Abre slide em janela separada (popup nativa do Meet). Reativa split na janela principal. **Slide pane mostra cam de outro participante em vez do screenshare.**

A causa, descoberta comparando dois JSONs do estado:
1. Quando o slide foi pra popup, o tile dele na janela principal **perdeu o `data-participant-id`** — o Meet aparentemente "transfere" o tile pra popup.
2. `findTileByPid(slidesPid antigo)` retornou null → auto-redetect disparou.
3. Auto-redetect procurou candidato com `videoWidth >= 1000`. O screenshare grande agora não tinha PID. A única candidata HD restante com PID era cam de outro participante na sala, em layout PIP em 1280×720.
4. Auto-redetect marcou ela como SLIDES. Falso positivo no critério.

Solução em duas camadas:

**Camada 1 — Filtro heurístico anti-cam.** Aproveitando as classes minificadas observadas nos snapshots: cams têm `iPFm3e` na sub-árvore do tile e `Gv1mTb-PVLJEc` no `<video>` quando em PIP/destaque. Screenshares não têm nenhuma das duas. `findScreenshareCandidate` agora descarta tiles que batem nesses padrões. Heurística empírica, anotada como dependência do DOM atual do Meet — pode quebrar em update futuro.

**Camada 2 — Supressão durante popup ativa.** O content script da popup escreve `chrome.storage.local.msb_popup_open_at = Date.now()` ao carregar (com heartbeat de 5s). Remove em `beforeunload`/`pagehide`. A janela principal mantém cache local da flag via `chrome.storage.onChanged` listener (sem precisar await em cada call). Quando popup ativa, auto-redetect retorna null — `slidesPid` permanece stale temporariamente, mas o slide volta sozinho quando o user fecha a popup (PID novo no DOM principal, auto-redetect dispara naquele momento).

---

## Métricas

Sete releases públicas (`v0.1.0` → `v0.2.2`), nove versões internas (`v0.0.1` → `v0.0.8` calibração). Aproximadamente 1.500 linhas de código distribuídas em:

```
extension/
├── manifest.json     ~30 linhas
├── content.js       ~600 linhas (lógica principal + popup detection + clones)
├── style.css        ~150 linhas (modos + popup cleanup)
├── popup.html       ~250 linhas (Design 3 com inline styles)
├── popup.js         ~250 linhas
├── background.js    ~80 linhas (menu de contexto)
└── icons/           3 PNGs procedurais
```

Sem nenhuma dependência runtime. Sem build step. Vanilla ES2020+. Manifest V3. Permissões mínimas (`activeTab`, `storage`, `scripting`, `clipboardWrite`, `contextMenus`, `host_permissions: meet.google.com`).

---

## O que vem depois

Backlog declarado no README:

- Layouts customizáveis (PIP, 30/70, multi-câmera).
- Captura/extração de áudio do Meet.
- Auto-detecção heurística de cam vs slides (sem precisar click manual).
- Suporte a múltiplas câmeras (1 professor + 1 convidado em painel único).
- Atalhos de teclado globais (`commands` API do Manifest V3).
- Suporte a Edge/Firefox.
- Publicação na Chrome Web Store.

E sobretudo: feedback de operadores reais usando em produção. Algumas heurísticas (como o filtro `iPFm3e` / `Gv1mTb-PVLJEc`) são frágeis contra updates do Google Meet e vão precisar de manutenção contínua. Issues e PRs são bem-vindos.

---

## Para quem quer contribuir

Ler o `TECHNICAL_NOTES.md` antes de mexer no código resolve 90% das dúvidas — ele documenta o "porquê" de decisões que parecem estranhas isoladas (clone via srcObject, bottom-anchored, filtro de cadáver, supressão de auto-redetect com flag de storage). Contém o mapa do DOM do Meet observado em snapshots reais.

Áreas onde a heurística é frágil e precisa de monitoramento:
- Classes minificadas do Meet (`iPFm3e`, `Gv1mTb-PVLJEc`, `oZRSLe`) podem mudar a qualquer release do Google.
- `match_about_blank: true` depende de comportamento atual do Document Picture-in-Picture do Chrome.
- Filtros heurísticos no auto-redetect SLIDES são empíricos.

Sempre que alguma dessas quebrar, atualizar com base em snapshot novo do DOM (`Inspecionar DOM` no popup → cole no chat com contexto).
