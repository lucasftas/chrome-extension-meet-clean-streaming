# Notas Técnicas — Meet Split for Broadcast

Este documento captura descobertas e decisões arquiteturais feitas durante o desenvolvimento da extensão. Existe pra preservar o "porquê" de escolhas que parecem estranhas no código quando isoladas, e pra ajudar futuros mantenedores a entender as armadilhas do Google Meet.

---

## 1. Modelo mental — o que a extensão precisa fazer

O Google Meet renderiza vídeos (cam + screenshare) dentro de tiles cheios de UI sobreposta — botões, nomes, ícones, headers. Pra usar como ISO source num switcher de broadcast (vMix, OBS, Wirecast), precisamos:

1. **Identificar** quais `<video>` são CAM e quais são SLIDES.
2. **Renderizar** ambos em fullscreen, lado a lado, sem nenhuma UI do Meet visível.
3. **Sobreviver** a re-renders do React do Meet, screenshare reiniciando, cam ligando/desligando, mudanças de layout.
4. **Não vazar** nada visualmente esquisito durante transições (vMix está capturando a janela ao vivo).

A solução de mercado tradicional usa 2 instâncias do Chrome com perfis isolados, cada uma renderizando 1 feed. Isso custa 2× banda + 2× contas Google. Esta extensão resolve com **1 conexão Meet + 2 `<video>` clones** num split-screen.

---

## 2. Anatomia do DOM do Meet

### 2.1 Tag `<video>`

- Classe minificada `Gv1mTb-aTv5jf` aparece em **toda** `<video>` (cam, screenshare, miniatura) — não diferencia.
- Atributos `autoplay`, `playsinline`, `muted` setados.
- `data-uid` é mutável: o Meet recria com uid novo a cada re-render. **Não confiar como identificador estável.**
- O Meet aplica `style="width: ...; height: ..."` inline nos `<video>` — precisa de `!important` em CSS pra sobrescrever.

### 2.2 Hierarquia do tile

A partir do `<video>`, subindo a árvore (depth = 0 até ~8):

```
0 <video class="Gv1mTb-aTv5jf">
1 <div class="p2hjYe TPpRNe" data-ssrc="..."> // overflow:hidden, dimensoes do tile renderizado
2 <div class="LBDzPb">
3 <div class="koV58 Zi94Db S7urwe" data-resolution-cap="0" data-layout="roi-crop" data-context="1">
4 <div class="CNjCjf [iPFm3e]"> // iPFm3e parece marcar cam (presente em cam, ausente em screenshare)
5 <div class="FKJK2b">
6 <div class="oZRSLe" data-participant-id="spaces/{space}/devices/{device}"> // ANCORA ESTAVEL
7 <div class="dkjMxf [iPFm3e] MVbbRb">
8 <main class="axUSnc cZXVke P9KVBf">
```

### 2.3 Identificação estável (`data-participant-id`)

- Formato: `spaces/{spaceId}/devices/{deviceId}`.
- Aparece no ancestral 6 (`oZRSLe`), também duplicado em `data-requested-participant-id` e `data-tile-media-id`.
- **Estável durante a sessão** pra cam de cada participante.
- **Muda** quando:
  - Participante sai e volta na sala (nova sessão = novo deviceId)
  - Screenshare é interrompido e reiniciado (cada start = novo deviceId)
- Pra screenshare, isso significa que persistir o PID em `chrome.storage.local` é frágil — daí o auto-redetect (seção 3.2).

### 2.4 Cadáveres

Quando um participante desliga a câmera, o Meet **não remove o `<video>`** do DOM. Em vez disso:

1. Adiciona `style="...; display: none;"` no `<video>` antigo
2. Seta `srcObject = null`
3. Pausa (`paused = true`)
4. Quando a cam volta, **cria um `<video>` novo no mesmo tile** (sem remover o antigo)

Resultado: você pode ter 2 `<video>` no mesmo tile, ambos com `data-uid` igual (Meet reusa). Sem filtragem, qualquer lógica que itere `<video>` pode pegar o cadáver. **Sempre filtrar por `srcObject !== null`** ao decidir qual é o vídeo "vivo".

---

## 3. Decisões arquiteturais

### 3.1 Clone via `srcObject` (em vez de promover o original)

**Problema:** `position: fixed` aplicado direto no `<video>` original do Meet **não funciona** — o vídeo fica invisível (ou atrás do overlay), mesmo com `z-index: 2147483647`. Causa: algum ancestral cria stacking context (provavelmente `transform`, `filter` ou `will-change` no CSS computado, não capturável via `style` attribute).

**Solução:** criar um `<video>` novo direto em `document.body` (fora de qualquer hierarquia do Meet) e atribuir `srcObject` da MediaStream do original. Same stream, same memory, zero custo de banda. Renderiza limpo em `position: fixed` porque está no contexto raiz.

```js
const clone = document.createElement('video');
clone.autoplay = true;
clone.playsInline = true;
clone.muted = true;
clone.srcObject = original.srcObject; // mesma MediaStream
document.body.appendChild(clone);
```

### 3.2 Auto-redetect só pra SLIDES (não pra CAM)

**Por que SLIDES tem auto-redetect:** PID do screenshare muda a cada start/stop. Sem auto-detecção, operador precisaria re-marcar SLIDES a cada interrupção do convidado. Em produção ao vivo, isso é inaceitável.

**Heurística do auto-redetect:**
1. `findTileByPid(slidesPid)` retorna null → PID stale
2. Procurar tiles com `data-participant-id` diferente do `camPid`
3. Filtrar: tile com `<video>` cujo `videoWidth >= 1000` (descarta cams 360p/720p)
4. Filtrar: tile com `getBoundingClientRect()` > 300×200 (descarta miniaturas como self-view)
5. Em caso de empate, escolher o de maior área visual

**Por que CAM NÃO tem auto-redetect:** definir "qual `<video>` é cam" sem PID exato é ambíguo — qualquer participante pode ter cam ligada. Heurística faria escolha errada com frequência. Operador re-marca CAM manualmente quando muda de sala/sessão.

### 3.3 Bottom-anchored em vez de top-anchored

Os clones usam `bottom: 0; height: 100vh` em vez de `top: 0; height: 100vh`. Visualmente igual em viewport "limpa", mas:

- **Top-anchor:** se o Chrome ganha barra de favoritos, viewport encolhe, top dos boxes se mantém colado no topo — **bottom dos boxes sobe** em coordenadas absolutas da janela.
- **Bottom-anchor:** bottom dos boxes ancora na base da viewport (= base da janela do Chrome). Estável independente de barras superiores.

Importante pra ferramentas externas que fazem crop em coordenadas absolutas (vMix Crop em pixels do bottom-left do desktop, recorte de tela, etc) — o conteúdo do vídeo sempre estará na mesma região.

### 3.4 `object-position: 50% 100%`

`object-fit: contain` mantém aspect ratio com letterbox. Default `object-position: 50% 50%` centraliza, dividindo letterbox entre cima e baixo.

`50% 100%` cola conteúdo do vídeo na **base** do pane. Resultado: todo o letterbox preto fica em cima, e a base do conteúdo do vídeo coincide exatamente com a base da janela. Cliente externo pode fazer crop dos últimos N pixels a partir do bottom e sempre pegará vídeo, nunca preto.

### 3.5 Clones permanecem no DOM enquanto split ativo

`syncClones` **nunca remove** os clones do DOM enquanto `splitActive=true`, mesmo se o `<video>` original sumir. Em vez disso, atualiza `srcObject` (pode virar `null` → pane fica preto, mas elemento permanece). Garante:

- Sem flicker / reflow durante transições (ex: screenshare parando e voltando)
- vMix Desktop Capture + Crop não percebe nada além do conteúdo dos panes mudando
- Posição absoluta dos panes (50/50, bottom-anchored) é constante

---

## 4. Workarounds aplicados

### 4.1 MutationObserver + listeners de stream

`MutationObserver` com `childList: true, subtree: true` detecta `<video>` aparecendo/sumindo do DOM. **Não detecta** mudança de `srcObject` (é property JS, não atributo).

Cenário problemático:
1. Meet cria `<video>` novo (mutation dispara → `applyMarks` roda)
2. Naquele tick, `<video>` ainda não tem `srcObject` → `markLiveVideosInTile` ignora (filtro de cadáver)
3. Meet atribui `srcObject` no tick seguinte → MutationObserver não dispara
4. `applyMarks` nunca roda de novo → pane fica preto pra sempre

**Solução:** a cada `<video>` novo detectado pelo observer, attachar listeners:
- `loadedmetadata` → stream chegou (videoWidth/Height passa a ser != 0) → re-apply
- `emptied` → srcObject foi anulado → re-apply

Idempotente via flag `_msbListened` no próprio elemento.

### 4.2 HD Simulcast hint

O Meet usa Simulcast — envia múltiplas resoluções da mesma câmera simultaneamente. O receiver escolhe qual track decodificar baseado no **bounding rect do `<video>` renderizado**: tile pequeno (1016×572) → pede 360p, tile grande (1920×1080) → pede 720p+.

Como o clone está separado do mecanismo de decisão do Meet, induzir HD requer mexer no `<video>` ORIGINAL. Truque:

```css
body.msb-active video[data-msb-role] {
  position: fixed !important;
  left: -10000px !important;
  top: 0 !important;
  width: 1920px !important;
  height: 1080px !important;
  z-index: -1 !important;
  opacity: 1 !important;
  /* renderizado off-screen mas decodificando em alta res */
}
```

**Limitações:** o truque ajuda mas não é determinante. O Meet pondera múltiplos sinais — `data-resolution-cap`, layout escolhido, banda, simulcast disponível. **Spotlight/Pin do tile no Meet** tem mais peso — se o operador fixar a cam que está marcada como CAM na extensão, vem em HD.

### 4.3 Page Visibility API override (anti-throttle)

Chrome reduz prioridade de aba inativa: `requestAnimationFrame` para, timers degradam, Meet pode pausar mídia. Workarounds aplicados:

```js
Object.defineProperty(document, 'hidden', { get: () => false, configurable: true });
Object.defineProperty(document, 'visibilityState', { get: () => 'visible', configurable: true });

document.addEventListener('visibilitychange', e => {
  e.stopImmediatePropagation();
}, true);

function tick() { requestAnimationFrame(tick); }
requestAnimationFrame(tick);
```

Combina:
- Engana Meet/JS que checam `document.hidden`
- Bloqueia eventos `visibilitychange` antes deles propagarem
- Heartbeat de rAF mantém o renderer ativo

Pra robustez extra, README documenta flags Chrome (`--disable-renderer-backgrounding`, `--disable-background-timer-throttling`, `--disable-backgrounding-occluded-windows`) que o operador pode aplicar.

### 4.4 Filtro de cadáver (`srcObject` não-null)

Em todo lugar que itera `<video>` pra decidir o que marcar/clonar, **filtrar por `srcObject !== null`**. Sem isso, o cadáver deixado pelo Meet quando cam off é confundido com o vídeo vivo, e o clone fica sem stream.

```js
function markLiveVideosInTile(tile, role) {
  if (!tile) return;
  tile.querySelectorAll('video:not([data-msb-clone])').forEach(v => {
    if (v.srcObject) v.setAttribute('data-msb-role', role);
  });
}
```

`syncClones` também é defensivo: usa `querySelectorAll` e escolhe o primeiro com srcObject não-null, mesmo se múltiplos `<video>` tiverem `data-msb-role`.

### 4.5 Clipboard pra `navigator.clipboard.writeText`

`clipboard.writeText` chamado a partir do content script falha com `Document is not focused` quando o foco está no popup. Solução: content script retorna o JSON serializado, popup faz a cópia (foco está nele).

Fallback: se mesmo no popup falhar, mostra textarea visível com `Ctrl+A; Ctrl+C` manual.

---

## 5. Limites e fricções aceitas

### 5.1 Resolução tem teto no remetente

Se o convidado está com "Resolução de envio: SD 360p" nas configs do Meet dele, **nenhum truque do receptor consegue subir além disso**. O simulcast só envia o que foi encodado. Operador deve verificar config do remetente em produção.

### 5.2 PIDs entre sessões diferentes da mesma sala

Se você sair e voltar na mesma URL do Meet, PIDs mudam (nova sessão de device). Storage tem PIDs antigos. Auto-redetect cuida do SLIDES (heurística por screenshare grande). CAM precisa ser re-marcada manualmente. **Recomendação:** "Limpar seleções" no popup ao iniciar uma nova sessão.

### 5.3 Não suporta 2 conexões Meet simultâneas

Mesma conta Google + mesma sala = uma aba kicka a outra. Pra ter 2 instâncias renderizando feeds isolados, precisa de 2 perfis Chrome diferentes (= 2 contas Google = 2 participantes). Esta extensão evita esse problema porque **uma única conexão Meet alimenta os 2 clones via `srcObject`**, mas o operador deve estar ciente de que abrir múltiplas abas do Meet quebra o fluxo.

### 5.4 Auto-redetect SLIDES pode pegar cam HD de outro participante

Se na sala houver outro participante com cam em 1280×720+ E o SLIDES não estiver ativo, `findScreenshareCandidate` pode escolher essa cam HD em vez do screenshare correto. Mitigação: `videoWidth >= 1000` filtra a maioria dos casos, mas não 100%. Se acontecer em produção, operador re-marca SLIDES manualmente (storage atualiza).

### 5.5 Layout "Em destaque" do Meet remove tiles do DOM

Quando o operador (ou o convidado) escolhe layout "Em destaque" no Meet, o algoritmo de culling do Meet **remove do DOM os `<video>` de participantes que não estão em destaque nem na barra lateral**. Se a cam marcada como CAM na extensão não é o tile destacado, ela some — sem tile no DOM, sem `data-participant-id` correspondente, `applyMarks` não acha nada e o clone cam fica preto.

Não é remediável via JS (não dá pra forçar o Meet a manter o `<video>` no DOM contra a vontade do algoritmo dele). Mitigação: orientar o operador a usar layouts **"Auto", "Mosaico" ou "Lado a lado"** durante a transmissão, OU fixar/Spotlight a cam que está marcada na extensão.

### 5.6 HD Simulcast hint não vence layout pequeno

O truque off-screen 1920×1080 (seção 4.2) ajuda mas não é determinante. Se o layout escolhido pelo Meet renderiza o tile da cam em tamanho pequeno (ex: 669×377 em layout "Lado a lado" com vários tiles), o Meet decide resolução baseado nesse tamanho original, e o nosso `<video>` em 1920×1080 off-screen **é ignorado**. Resultado: cam continua chegando em 360p mesmo com o truque ativo.

Spotlight/Pin no Meet é a alavanca mais confiável pra HD da cam — promove o tile a destaque, o Meet pede 720p+ do simulcast. Sem isso, qualquer layout com tile pequeno trava em SD.

---

## 6. Edge cases — status

### Validados (✅)

| # | Cenário | Solução |
|---|---|---|
| 1 | Refresh do Meet (F5) com split ativo | Estado em `chrome.storage.local` persiste; MutationObserver detecta `<video>` novos após reload e re-aplica marks/clones |
| 2 | Screenshare para e volta | Auto-redetect (seção 3.2) |
| 3 | Câmera off/on | Filtro de cadáver (4.4) + listeners de stream (4.1) |
| 4 | Sair e voltar na mesma sala | PIDs mudam (nova sessão); operador "Limpa seleções" + re-marca CAM. Auto-redetect cobre SLIDES quando screenshare voltar |
| 6 | 3+ participantes | Marcação por PID exato — outros tiles ignorados, mesmo se outro participante for fixado/spotlight no Meet |

### Funciona com fricção (⚠️)

| # | Cenário | Limitação |
|---|---|---|
| 5 | Mudar layout (galeria/lado a lado/destaque/mosaico) | Auto, Mosaico e Lado a lado funcionam normalmente. **"Em destaque" (Spotlight) quebra a cam** se a cam marcada não for o tile destacado — o Meet faz culling agressivo e remove o `<video>` da cam não-destacada do DOM. Mitigação: o operador deve fixar/spotlight **a cam que está marcada na extensão**, ou usar layout "Lado a lado"/"Auto"/"Mosaico" durante a transmissão. |

---

## 7. Setup do vMix (ingestão)

### 7.1 Atalho do Chrome com flags

Sem as 3 flags de hardening, qualquer site congela quando o Chrome perde foco/é coberto. Atalho do Windows (`.lnk`) com:

```
Target: C:\Program Files\Google\Chrome\Application\chrome.exe
Arguments: --disable-renderer-backgrounding --disable-background-timer-throttling --disable-backgrounding-occluded-windows
```

⚠️ **Antes de abrir**, fechar TODAS as instâncias do Chrome (incluindo processos no Gerenciador de Tarefas). Senão o atalho abre nova janela na instância antiga sem flags. Validar em `chrome://version/` → "Linha de comando".

### 7.2 Window Capture Method — usar WindowsGraphicsCapture

No vMix Add Input → Desktop → Window Capture, há 4 métodos:

| Método | Comportamento |
|---|---|
| `Default` | vMix decide. Inconsistente. |
| `GDI` | API antiga. **Falha** com conteúdo GPU-acelerado (Chrome com WebRTC). Pode mostrar tela preta. |
| `WindowsGraphicsCapture` | ✅ **Recomendado.** API moderna (Win10 1803+). Captura GPU-rendered, sobrevive a occlusion. |
| `DWM` | Funciona, mas tem casos onde o Chrome (próprios buffers GPU) renderiza errado. |

### 7.3 Inputs com Crop

1. **Add Input** → **Desktop** → Source: **Window Capture** → janela do Chrome.
2. **Window Capture Method**: `WindowsGraphicsCapture`.
3. Crie 2 inputs com mesma janela:
   - "CAM": Crop Right = 50% (mostra esquerda)
   - "SLIDES": Crop Left = 50% (mostra direita)

### 7.4 Janela do Chrome — não minimize

- **Janela coberta (occluded)** por outra janela (ex: vMix em fullscreen) → flags cuidam, render continua.
- **Janela minimizada** (clique no `_`) → Chrome pausa render. Flag não vence isso (decisão do Windows + Chrome). Em produção, evite minimizar — deixe occluded.
- Pra panes 16:9 limpos, redimensione a janela pra **3840×1080** (2 panes 1920×1080 lado a lado). Em monitor menor, aceite letterbox.

### 7.5 Tentativa descartada — Browser Input do vMix

O Browser Input nativo do vMix (CEF) aceita CSS injection, mas:
- Cada Update recarrega a página → volta pra pre-join screen do Meet
- Sessão Google não persiste entre reloads
- `getUserMedia` pode ser bloqueado interativamente
- Sem JS pra clonar `srcObject`, não dá pra fazer split

A rota Chrome externo + extensão + Desktop Capture é a viável.

---

## 8. Glossário

- **PID (participant-id):** identificador estável de um device (cam OU screenshare) numa sessão do Meet. Formato `spaces/{space}/devices/{device}`.
- **Cadáver:** `<video>` antigo que o Meet deixa no DOM após cam off, com `display: none` e `srcObject = null`.
- **Stacking context:** contexto CSS criado por ancestrais com `transform`, `filter`, `will-change`, `opacity != 1`, etc — limita o `z-index` efetivo de descendentes.
- **Simulcast:** mecanismo do WebRTC onde o sender envia múltiplas resoluções da mesma fonte simultaneamente. Receiver escolhe qual decodificar.
- **MediaStream:** referência JS pra um fluxo de áudio/vídeo do WebRTC. Compartilhável entre `<video>` (clones via `srcObject = stream`).
- **Spotlight / Pin:** ação no Meet de fixar um participante em destaque. Promove o tile dele a tamanho grande, induzindo simulcast a entregar HD.
- **ROI Crop:** "Region of Interest" crop. Atributo `data-layout="roi-crop"` no Meet indica que o tile faz crop inteligente focando no rosto do participante.
