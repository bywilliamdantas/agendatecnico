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
- **Cadastro de equipe e motivos**: abas para gerenciar técnicos, auxiliares
  e os motivos (com cor) usados nos lançamentos.
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

## Estrutura dos arquivos

```
.
├── index.html   # estrutura da página
├── style.css    # todo o visual do painel
├── script.js    # toda a lógica (dados, filtros, agenda, backup)
└── README.md
```
