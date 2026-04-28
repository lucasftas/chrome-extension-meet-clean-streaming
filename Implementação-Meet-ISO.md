# **Implementação: Google Meet ISO para vMix**

Este guia detalha a criação de uma extensão para Google Chrome e a automação necessária para extrair sinais limpos (câmara e slides) do Google Meet de forma isolada, permitindo a sua ingestão no vMix como "Clean Feeds".

## **Visão Geral da Arquitetura**

A solução baseia-se em duas componentes principais:

1. **Extensão Chrome (DOM Manipulator):** Atua no Client-Side, manipulando o Document Object Model (DOM) para forçar as tags \<video\> a ocuparem 100% da viewport e ocultar todos os elementos de controlo da interface do Google Meet.  
2. **Script de Automação (PowerShell):** Inicia duas instâncias independentes do Chrome, em perfis isolados, injetando parâmetros na URL que instruem a extensão sobre que sinal deve ser isolado em cada janela.

MAPA MENTAL ASCII: ISOLADOR DE SINAIS (GOOGLE MEET \-\> VMIX)

ISOLADOR DE SINAIS (GOOGLE MEET \-\> VMIX)  
│  
├── EXTENSÃO CHROME (DOM MANIPULATOR)  
│   ├── manifest.json (Permissões e Escopo)  
│   ├── content.js (Lógica de MutationObserver)  
│   └── style.css (Injeção de Layout Fullscreen)  
│  
├── AMBIENTE DE EXECUÇÃO  
│   ├── Instância A: Perfil "Cam" (Fixa Professor)  
│   └── Instância B: Perfil "Slides" (Fixa Apresentação)  
│  
└── INGESTÃO VMIX  
    ├── Desktop Capture (Window Mode)  
    └── Crop/Luma Key (Ajustes Finais)

## **1\. Estrutura da Extensão Chrome**

Crie uma pasta (por exemplo, meet-iso-cleaner) e adicione os três ficheiros seguintes:

### **1.1 manifest.json**

Define o escopo da extensão, garantindo que esta apenas seja injetada no domínio do Google Meet e usando o Manifest V3.

{  
  "manifest\_version": 3,  
  "name": "Meet ISO Cleaner para vMix",  
  "version": "1.0",  
  "description": "Isola feeds de vídeo no Google Meet para transmissão profissional.",  
  "content\_scripts": \[  
    {  
      "matches": \["\[https://meet.google.com/\](https://meet.google.com/)\*"\],  
      "js": \["content.js"\],  
      "css": \["style.css"\],  
      "run\_at": "document\_idle"  
    }  
  \]  
}

### **1.2 style.css**

Injeta as regras visuais brutas. A classe .vMix-Isolate-Active força o vídeo a ignorar a estrutura da página e assumir o tamanho total da janela (100vw/100vh), mantendo o object-fit: contain para não distorcer a imagem.

.vMix-Isolate-Active {  
    position: fixed \!important;  
    top: 0 \!important;  
    left: 0 \!important;  
    width: 100vw \!important;  
    height: 100vh \!important;  
    z-index: 99999 \!important;  
    background: \#000 \!important;  
    object-fit: contain \!important;  
}

.vMix-Hide-UI {  
    display: none \!important;  
    opacity: 0 \!important;  
    pointer-events: none \!important;  
}

### **1.3 content.js**

Este é o cérebro da operação. Devido à natureza dinâmica do React utilizado pelo Google, não podemos executar a limpeza apenas uma vez. Usamos um MutationObserver para monitorizar a recriação das tags de vídeo. A função lê o parâmetro da URL (?vMixMode=) para decidir que elemento isolar.

(function() {  
    const observer \= new MutationObserver(() \=\> {  
        // Verifica que modo foi solicitado via URL  
        const urlParams \= new URLSearchParams(window.location.search);  
        const mode \= urlParams.get('vMixMode');  
        if (\!mode) return;

        // Itera sobre todos os vídeos da página  
        document.querySelectorAll('video').forEach(v \=\> {  
            // Estratégia de identificação: as apresentações geralmente têm object-fit diferente  
            // ou estão dentro de containers com atributos específicos de apresentação.  
            const isPresentation \= v.style.objectFit \=== 'contain' || v.closest('\[data-is-presentation="true"\]');  
              
            if ((mode \=== 'slides' && isPresentation) || (mode \=== 'cam' && \!isPresentation)) {  
                v.classList.add('vMix-Isolate-Active');  
                document.body.style.overflow \= 'hidden'; // Evita barras de scroll  
            } else {  
                v.classList.add('vMix-Hide-UI');  
            }  
        });

        // Tenta esconder agressivamente a UI residual  
        document.querySelectorAll('div\[role="button"\], div\[role="navigation"\], span').forEach(el \=\> {  
            // Apenas esconde se não for um pai do vídeo isolado  
            if (\!el.contains(document.querySelector('.vMix-Isolate-Active'))) {  
                el.classList.add('vMix-Hide-UI');  
            }  
        });  
    });

    // Inicia o observador atrelado ao corpo da página  
    observer.observe(document.body, { childList: true, subtree: true });  
})();

## **2\. Instalação da Extensão**

1. Abra o Google Chrome e navegue até chrome://extensions/.  
2. Ative o **Modo de programador** no canto superior direito.  
3. Clique em **Carregar não compactada** e selecione a pasta meet-iso-cleaner.

## **3\. Script de Automação (PowerShell)**

Para garantir que o Google Meet não pausa os vídeos (comportamento padrão quando abas estão inativas), é crucial abrir duas janelas em perfis do Chrome distintos e no modo "App" (sem barra de endereços).

O script PowerShell abaixo efetua o lançamento automático, injetando os parâmetros ?vMixMode=cam e ?vMixMode=slides.

### **Como utilizar**

Crie um ficheiro chamado Launch-Meet-ISO.ps1 e cole o código abaixo. Altere as coordenadas em \--window-position se os seus monitores virtuais exigirem um posicionamento diferente.

param(\[string\]$Url); Start-Process "chrome.exe" \-ArgumentList "--new-window","--app=$Url?vMixMode=cam","--window-position=0,0","--window-size=1920,1080","--user-data-dir=$env:TEMP\\m\_cam"; Start-Process "chrome.exe" \-ArgumentList "--new-window","--app=$Url?vMixMode=slides","--window-position=1920,0","--window-size=1920,1080","--user-data-dir=$env:TEMP\\m\_slides"

## **4\. Ingestão no vMix**

1. Execute o ficheiro .ps1 passando o link do Meet corporativo. As duas janelas abrir-se-ão isoladas e em ecrã inteiro.  
2. No vMix, clique em **Add Input** \-\> **Local Desktop Capture**.  
3. Selecione a janela correspondente ao Chrome do Professor (Cam).  
4. Repita o processo e adicione outro input para a janela do Chrome da Apresentação (Slides).  
5. Se a extensão deixar algum rebordo residual (1px ou 2px) devido às bordas das janelas do Windows, utilize o painel **Position** do input no vMix para aplicar um ligeiro *Crop*.