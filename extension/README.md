# Extensão Chrome

Frontend da extensão Chrome Manifest V3 para WhatsApp Web, construído com React, TypeScript, Vite e Tailwind CSS.

## Requisitos

- Node.js 20+
- npm ou pnpm
- Backend local rodando em `http://localhost:3000` ou outra URL configurada no popup

## Instalação

```bash
cd extension
npm install
```

## Desenvolvimento

```bash
npm run build
```

Para rebuild contínuo:

```bash
npm run dev
```

O output será gerado em `extension/dist`.

## Carregar no Chrome

1. Abra `chrome://extensions`
2. Ative `Developer mode`
3. Clique em `Load unpacked`
4. Selecione a pasta `extension/dist`

## Fluxo de uso

1. Clique no popup da extensão
2. Configure a URL do backend
3. Faça login com email e senha
4. Abra `https://web.whatsapp.com`
5. Entre em uma conversa com número detectável
6. A sidebar será injetada à direita automaticamente

## Estrutura

- `src/background`: service worker, autenticação e chamadas ao backend
- `src/content`: content script, detecção de conversa, sidebar React e componentes
- `src/popup`: popup de login e configuração
- `src/shared`: tipos, mapeadores, storage e utilitários

## Observações

- O token JWT é armazenado em `chrome.storage.local`
- A extensão usa `MutationObserver` para reagir a mudanças do WhatsApp Web
- A inserção de template no composer não envia a mensagem automaticamente
