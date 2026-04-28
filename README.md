# Meet Split for Broadcast

Extensão Chrome que transforma uma sessão do Google Meet em duas regiões de vídeo limpas e isoladas — câmera de um lado, apresentação/slides do outro — prontas para serem capturadas como ISO feeds em softwares de broadcast como vMix, OBS ou Wirecast.

> **Status:** 🚧 Alpha — ideia em captura

---

## Visão / Proposta

O Google Meet é hoje a forma mais prática de ter convidados remotos em uma transmissão ao vivo, mas a interface dele foi desenhada para reuniões — não para broadcast. Mesmo em "modo apresentação", a janela vem com nomes de participantes, contornos, controles, ícones de microfone e elementos de UI que aparecem por cima do vídeo no momento errado.

**Meet Split for Broadcast** injeta uma camada de manipulação de DOM no Meet que:

1. Esconde toda a UI do Meet (botões, headers, tiles inativos, elementos de controle).
2. Apresenta apenas dois vídeos em uma única janela dividida ao meio: **CAM** à esquerda, **SLIDES** à direita.
3. Permite ao operador escolher manualmente, com um clique, qual stream do Meet vira CAM e qual vira SLIDES.
4. Mantém o Chrome renderizando os dois vídeos mesmo quando a janela está minimizada/fora de foco (hardening contra throttling de aba inativa).

O software de broadcast captura essa janela inteira via Desktop Capture e usa **Crop** para extrair cada metade como um input independente — efetivamente fornecendo dois ISO feeds limpos do Meet.

## Problema que resolve

Operadores de transmissão ao vivo que precisam ter um convidado/professor remoto via Google Meet sofrem hoje com:

- Janela do Meet "suja" — UI sobrepondo o vídeo no meio da live.
- Ausência de ISO feeds — o Meet entrega tudo num mosaico, não em fontes separadas.
- Limitações de mosaico fixo — quem está em destaque oscila conforme o algoritmo do Meet.
- Throttling de aba inativa — Chrome pausa renderização quando a janela perde foco, derrubando o feed do vMix.

A solução de mercado mais comum hoje é usar dois computadores ou recorrer a NDI gateways pagos. Esta extensão resolve o caso comum (1 câmera + 1 apresentação) sem hardware adicional, em uma única máquina.

## Usuário-alvo

Operadores de transmissão ao vivo, produtoras de conteúdo educacional, organizadores de eventos online (palestras, lives, webinars híbridos) que:

- Usam vMix, OBS, Wirecast ou similar como switcher principal.
- Precisam compor uma cena com câmera de convidado remoto + apresentação de slides desse mesmo convidado.
- O convidado/professor está num Google Meet (não tem como exigir que ele use NDI ou ferramentas profissionais).

## Fluxo principal

1. Operador entra na sala do Meet pelo Chrome com a extensão instalada.
2. Convidado/professor entra na mesma sala e compartilha tela.
3. Operador clica no ícone da extensão na barra do Chrome → abre popup.
4. Clica em **"Marcar CAM"** → cursor entra em modo de seleção, operador clica no tile do professor.
5. Clica em **"Marcar SLIDES"** → cursor entra em modo de seleção, operador clica na tela compartilhada.
6. Clica em **"Ativar Split"** → a página do Meet inteira fica preta, exibindo apenas os dois vídeos selecionados lado a lado em 50/50.
7. No software de broadcast, adiciona a janela do Chrome como Desktop Capture e cria dois inputs com Crop:
   - Input "CAM" → metade esquerda da janela
   - Input "SLIDES" → metade direita da janela
8. Durante a transmissão, se algo der errado, o operador clica em **"Desativar"** no popup e a janela volta ao Meet original.

## Inputs

- URL de uma sala do Google Meet (`meet.google.com/xxx-xxxx-xxx`).
- Cliques do operador para identificar qual stream é CAM e qual é SLIDES.
- Toggle ON/OFF via popup da extensão.

## Outputs

- Janela do Chrome renderizando split-screen 50/50 com dois feeds limpos, prontos para Desktop Capture.
- Janela permanece renderizando mesmo minimizada/fora de foco (com flags de hardening aplicadas).

## Stack e arquitetura

- **Chrome Extension Manifest V3** — `manifest.json`, `content.js`, `style.css`, `popup.html`, `popup.js`, `background.js`.
- **DOM Manipulation via MutationObserver** — necessário porque o Meet recria as `<video>` tags dinamicamente (React).
- **Mensageria** entre popup e content script via `chrome.runtime.sendMessage` para comandos (Marcar CAM, Marcar SLIDES, Toggle).
- **Storage** em `chrome.storage.local` para persistir as referências aos vídeos selecionados durante a sessão.
- **Hardening anti-throttle**:
  - JS keep-alive na content script (`requestAnimationFrame` contínuo + override de `Page Visibility API`).
  - Documentação no README com flags de inicialização do Chrome (`--disable-renderer-backgrounding`, `--disable-background-timer-throttling`, `--disable-backgrounding-occluded-windows`).

```
+------------------------------------------------------+
|  Chrome (com extensão Meet Split for Broadcast)      |
|                                                      |
|  +------------------+    +------------------------+  |
|  |   Popup UI       |--->|   Content Script       |  |
|  | [Marcar CAM]     |    |   - MutationObserver   |  |
|  | [Marcar SLIDES]  |    |   - DOM cleanup        |  |
|  | [Toggle Split]   |    |   - Split layout CSS   |  |
|  +------------------+    |   - Keep-alive loop    |  |
|                          +------------------------+  |
|                                    |                 |
|                                    v                 |
|                          +------------------------+  |
|                          |   Janela renderizada   |  |
|                          |   [CAM] | [SLIDES]     |  |
|                          +------------------------+  |
+------------------------------------------------------+
                                    |
                                    | Desktop Capture
                                    v
                          +------------------------+
                          |  vMix / OBS / Wirecast |
                          |  Input 1 (Crop esq)    |
                          |  Input 2 (Crop dir)    |
                          +------------------------+
```

## Integrações externas

- **Google Meet** (consumidor — manipulação de DOM only, sem API).
- **Software de broadcast** (consumidor passivo via Desktop Capture do SO — sem integração direta).
- **Chrome Storage API** (persistência local).

Nenhuma chamada de rede, nenhum servidor, nenhuma API externa.

## Escopo do MVP (v0.1.0)

- ✅ Modo split-screen (CAM esquerda + SLIDES direita, fixo 50/50).
- ✅ Seleção manual via click no popup → click no vídeo desejado.
- ✅ Toggle ON/OFF pelo popup.
- ✅ Hardening anti-pause: keep-alive embutido na extensão + seção no README com flags Chrome.
- ✅ Manifest V3, ícone próprio (16/48/128 PNG).
- ✅ Distribuição via ZIP versionado em GitHub Release (load unpacked).

## Fora de escopo (MVP)

- ❌ Suporte a Zoom, Microsoft Teams, Jitsi.
- ❌ Suporte a Edge, Firefox, Safari.
- ❌ Publicação na Chrome Web Store (fica para quando o projeto estiver robusto).

## Backlog futuro (v0.2+)

- Layouts customizáveis (PIP, 30/70, multi-câmera).
- Captura/extração de áudio do Meet.
- Auto-detecção de qual stream é cam vs apresentação (heurística + override manual).
- Suporte a múltiplas câmeras (1 professor + 1 convidado em painel único).
- Atalhos de teclado globais.
- Publicação na Chrome Web Store.

## Referências

- [Implementação técnica original](Implementação-Meet-ISO.md) — spec inicial que deu origem ao projeto.
- [Chrome Extension Manifest V3](https://developer.chrome.com/docs/extensions/mv3/intro/)
- [vMix Desktop Capture](https://www.vmix.com/help26/DesktopCapture.html) — guia de captura de janela.
- [Page Visibility API workarounds](https://developer.chrome.com/blog/background_tabs/) — referência de throttling de abas inativas.

## Como instalar

1. Clone o repositório (ou baixe o ZIP da [última release](https://github.com/lucasftas/chrome-extension-meet-clean-streaming/releases)).
2. Abra `chrome://extensions/` no Chrome.
3. Ative **Modo de programador** (canto superior direito).
4. Clique em **Carregar não compactada** → selecione a pasta **`extension/`** dentro do repositório (não a raiz).
5. (Opcional, recomendado) Inicie o Chrome com flags de hardening:
   ```
   chrome.exe --disable-renderer-backgrounding --disable-background-timer-throttling --disable-backgrounding-occluded-windows
   ```
6. Acesse uma sala do Google Meet e clique no ícone da extensão.

## Recomendações de uso em produção

Pra evitar surpresas durante uma transmissão ao vivo:

- **Layout do Meet:** use **Auto**, **Mosaico** ou **Lado a lado**. **Evite "Em destaque"** — o Meet faz culling de tiles fora de destaque e a cam pode sumir do split. Se for necessário usar "Em destaque", **fixe/Spotlight a cam que está marcada na extensão**.
- **Resolução HD da cam:** peça ao convidado pra ativar **Configurações → Vídeo → Resolução de envio: HD (720p)**. Sem isso, o teto é o que ele envia.
- **Antes de cada nova sala:** clique em **Limpar seleções** no popup (PIDs persistem no storage e podem ficar stale entre sessões).
- **Inicie o Chrome com as flags de hardening** acima — evita o Chrome pausar mídia se a janela perder foco.
