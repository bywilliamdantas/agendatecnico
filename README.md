# Painel Semanal da Equipe

Painel para lançar e visualizar, semana a semana, os compromissos da equipe
(manutenção de veículo, consulta médica, falta, folga, etc.), com geração de
imagem pronta para enviar no WhatsApp.

## Funcionalidades

- **Navegação por semanas**: avance/retroceda semana a semana ou pule direto
  para qualquer data usando o campo de data ao lado da navegação — é possível
  lançar eventos em semanas futuras normalmente.
- **Filtros na agenda**: por tipo (técnicos/auxiliares), por motivo e por
  busca de nome. Um filtro extra ("Mostrar só quem tem lançamento nesta
  semana") esconde da tela quem não tem nada marcado na semana selecionada —
  útil para gerar a imagem só com quem realmente tem algo naquela semana.
- **Período por extenso**: cada lançamento mostra "Manhã", "Tarde" ou "Dia
  todo" em vez de ícone.
- **Geração de imagem**: botão "Gerar imagem para WhatsApp" tira um
  print da agenda da semana (respeitando os filtros aplicados) e baixa como
  PNG.
- **Dia de hoje destacado**: a coluna do dia atual aparece realçada na grade,
  com uma etiqueta "HOJE" no cabeçalho.
- **Filtros lembrados**: os filtros escolhidos ficam salvos e voltam do jeito
  que estavam ao reabrir o painel. Um botão "Limpar filtros" aparece sempre
  que algum filtro estiver ativo.
- **Aviso de lançamento duplicado**: ao salvar um evento para alguém que já
  tem outro lançamento no mesmo dia e período conflitante, o painel avisa e
  pede confirmação (dia todo conflita com qualquer período; manhã só com
  manhã; tarde só com tarde).
- **Confirmações informativas**: ao remover uma pessoa ou um motivo, o aviso
  informa quantos eventos serão afetados.
- **Supervisor por pessoa**: no cadastro dá para atribuir um supervisor a
  cada técnico ou auxiliar. O nome do supervisor passa a aparecer abaixo do
  nome da pessoa na agenda (no lugar de "Técnico"/"Auxiliar"), e há um filtro
  por supervisor.
- **Imagem do dia, de dias escolhidos ou da semana**: a barra "Dias exibidos"
  liga e desliga cada dia da semana. A agenda mostra só os dias marcados e o
  botão de gerar imagem segue essa seleção — dá para gerar a imagem de um
  único dia, de alguns dias ou da semana inteira. Os atalhos "Semana toda" e
  "Só hoje" fazem a seleção em um clique.
- **Coluna de nomes fixa**: na agenda, a coluna das pessoas fica travada à
  esquerda enquanto você rola os dias na horizontal, então dá para tirar um
  print direto da tela sem precisar gerar a imagem.
- **Cadastro de equipe e motivos**: abas para gerenciar técnicos, auxiliares
  e os motivos (com cor) usados nos lançamentos.
- **Lançar em vários dias de uma vez**: no modal de novo evento há uma
  seleção dos dias da semana — marque quantos quiser para repetir o mesmo
  motivo e período (útil para folga ou afastamento de vários dias).
- **Relatório mensal**: aba "Relatório" com a contagem de lançamentos por
  pessoa e por motivo no mês escolhido, incluindo totais e exportação em CSV
  (abre no Excel).
- **Modo cartão no celular**: em telas estreitas a agenda vira uma lista de
  cartões, um por pessoa, em vez da tabela com rolagem lateral.
- **Desfazer**: ao excluir um evento, uma pessoa ou um motivo — e também ao
  lançar vários dias de uma vez — aparece um botão "Desfazer" por alguns
  segundos.
- **Instalável (PWA)**: pode ser instalado como aplicativo no celular ou no
  computador e abre offline.
- **Backup manual**: botões "Exportar backup" e "Importar backup" no topo
  salvam/restauram todos os dados em um arquivo `.json`.

## Como os dados são salvos

Os dados ficam salvos no `localStorage` do navegador — ou seja, ficam
gravados no próprio aparelho/navegador que você está usando, sem precisar de
servidor ou login. Isso significa duas coisas importantes:

1. **Cada navegador/dispositivo tem seu próprio conjunto de dados.** Se você
   usar o painel no computador da oficina e no celular, eles não se
   sincronizam sozinhos.
2. **Limpar os dados de navegação do navegador apaga o painel.** Por isso,
   use o botão **Exportar backup** de vez em quando (ex.: toda semana) e
   guarde o arquivo `.json` em algum lugar seguro (e-mail, Drive, pendrive).
   Para restaurar em outro aparelho ou depois de uma limpeza acidental, use
   **Importar backup** e selecione esse arquivo.

> Se você estava testando uma versão anterior deste painel dentro do preview
> da Claude, ao abrir esta versão pela primeira vez no mesmo navegador ela
> tenta migrar automaticamente os dados antigos. Ainda assim, é recomendado
> exportar um backup antes de trocar de versão, por segurança.

## Publicar no GitHub Pages

1. Crie um repositório novo no GitHub e suba estes três arquivos
   (`index.html`, `style.css`, `script.js`) na raiz (o `README.md` também,
   se quiser).
2. No repositório, vá em **Settings → Pages**.
3. Em **Branch**, selecione a branch principal (`main`) e a pasta `/root`,
   depois clique em **Save**.
4. Em alguns minutos o GitHub mostra o link público (algo como
   `https://seu-usuario.github.io/nome-do-repositorio/`). Esse é o endereço
   que você pode acessar de qualquer computador ou celular.

Não é necessário nenhum processo de build — são arquivos estáticos comuns,
funcionam também abrindo o `index.html` direto no navegador ou hospedados em
qualquer outro serviço (Netlify, Vercel, servidor próprio, etc.).

## Instalar como aplicativo (PWA)

Depois de publicar no GitHub Pages (ou em qualquer endereço `https`), o
painel pode ser instalado como app:

- **Android (Chrome)**: abra o link, toque no menu (⋮) e escolha
  "Instalar aplicativo" / "Adicionar à tela inicial".
- **iPhone (Safari)**: abra o link, toque em Compartilhar e escolha
  "Adicionar à Tela de Início".
- **Computador (Chrome/Edge)**: aparece um ícone de instalar na barra de
  endereço.

Instalado, ele abre em tela cheia, sem a barra do navegador, e funciona sem
internet (os dados já ficam no próprio aparelho).

> **Ao publicar uma atualização**: abra o `sw.js` e mude o número da versão
> em `CACHE_NAME` (de `painel-equipe-v1` para `v2`, por exemplo). Sem isso,
> quem já tem o app instalado pode continuar vendo a versão antiga guardada
> em cache.

## Estrutura dos arquivos

```
.
├── index.html      # estrutura da página
├── style.css       # todo o visual do painel
├── script.js       # toda a lógica (dados, filtros, agenda, relatório, backup)
├── manifest.json   # configuração do app instalável (PWA)
├── sw.js           # service worker: cache para funcionar offline
├── icons/
│   ├── icon-192.png
│   └── icon-512.png
└── README.md
```
