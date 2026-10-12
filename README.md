# 📝 Preenchimento Automático de Formulários

> 📦 **Projeto antigo** (2025), publicado agora como parte do meu histórico de estudos. Hoje existe uma versão mais nova e privada.

Aplicação **React + Express** que lê os dados de condutores de uma planilha do **Google Sheets** e gera, para cada linha, o **formulário de indicação de condutor** em PDF já preenchido (São Bernardo do Campo e Guarulhos). Também tem um início de automação do cadastro de usuário no portal da prefeitura com Puppeteer.

Antes, cada formulário era preenchido à mão. Com a ferramenta, a planilha inteira vira PDFs com um clique.

## Como funciona

- **Front (React + Vite + Tailwind):** escolhe a cidade, inicia o processo e mostra uma barra de progresso
- **Back (Express):**
  - `GET /api/sheet/:sheetId?city=` lê a aba da cidade no Google Sheets
  - `POST /api/fill-form` escreve os dados por cima do modelo PDF (`pdf-lib`) e salva como `<NOME> - <AIT>.pdf`
  - `POST /api/register-user` abre o portal com Puppeteer e preenche o CPF (protótipo)

## Tecnologias

React · Vite · Tailwind CSS · Node.js · Express · pdf-lib · Puppeteer · Google Sheets API

## Como rodar

```bash
npm install
cp .env.example .env   # e preencha os valores
```

Coloque a chave da *service account* do Google em `credentials.json` e os modelos de PDF na raiz (`sbc_form.pdf`, `guarulhos_form.pdf`). Nenhum desses arquivos vai para o Git, exceto o modelo público em branco de Guarulhos.

```bash
node server.js   # API na porta 3000
npm run dev      # front
```

## O que eu faria diferente hoje

- Tirar as coordenadas do PDF do código e colocar num arquivo de configuração por cidade
- Validar os dados da planilha antes de gerar o PDF
- Mover a URL da API para variável de ambiente
