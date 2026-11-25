# Trello Progresso Inteligente — MVP 1.0

Power-Up personalizado para escolher quais checklists contam no progresso de um
cartão. Os arquivos HTML, CSS e JavaScript podem ser hospedados gratuitamente no
GitHub Pages em um repositório público.

## Como funciona

1. Abra um cartão e clique em **Configurar progresso**.
2. Deixe marcadas as checklists que devem contar no cálculo. Todas entram por
   padrão, inclusive checklists criadas depois da configuração inicial.
3. Clique em **Salvar configuração**. A seleção é compartilhada com quem pode
   acessar o cartão. O popup permanece aberto e confirma a gravação.
4. O badge na frente do cartão apresenta a porcentagem, como `60%`.

O cálculo soma os itens concluídos de todas as checklists incluídas, divide pelo
total de itens dessas checklists e multiplica por 100. A apresentação usa o
inteiro mais próximo. Por exemplo, três itens concluídos em cinco considerados
resultam em `60%`. Checklists com quantidades diferentes de itens têm seu peso
proporcional ao número de itens.

Quando o total considerado é zero, o badge mostra **Sem itens** e o popup mostra
**— / Nenhum item considerado**. Quando existem itens e nenhum foi concluído,
o resultado é `0%`. Falhas de leitura apresentam **Progresso indisponível**.

O Power-Up consulta `t.card('checklists')`, lê os itens em `checkItems` e considera
concluído apenas o estado `complete`. O estado `incomplete` representa um item
pendente. Dados ausentes ou estados desconhecidos geram erro de leitura.

Os IDs ignorados são armazenados na chave `ignoredChecklistIds` com
`t.set('card', 'shared', 'ignoredChecklistIds', ids)` e recuperados com
`t.get('card', 'shared', 'ignoredChecklistIds', [])`. IDs de checklists removidas
são descartados na próxima gravação. Nomes e itens das checklists são preservados.

Os badges são recalculados em cada chamada de `card-badges` pelo Trello. O popup
atualiza os dados por `t.render`, preservando seleções ainda não salvas. A atualização
segue o ciclo nativo do Trello, sem temporizador ou promessa de latência fixa.

## Arquivos

```text
index.html                 Conector registrado no Trello
settings.html              Popup de configuração
css/settings.css           Estilos responsivos em português brasileiro
images/progress.svg        Ícone monocromático do botão
js/connector.js            Inicialização do SDK oficial
js/capabilities.js         card-buttons e card-badges
js/trello-data.js           Leitura e armazenamento compartilhado
js/progress.js             Cálculo puro e validação
js/settings.js             Controlador do popup e tratamento de erros
js/settings-view.js        Renderização segura com APIs DOM
tests/progress.test.js     Testes do cálculo e casos extremos
tests/trello.test.js       Testes das capacidades e do contrato com o SDK
package.json               Comandos de desenvolvimento
```

## Desenvolvimento e testes locais

Use Node.js 20 ou superior. O servidor estático usa Python 3. O projeto não tem
dependências npm nem etapa de compilação.

```sh
npm test
npm start
```

`npm start` serve a raiz do projeto na porta 3000. O conector e o popup utilizam
o SDK oficial carregado de `https://p.trellocdn.com/power-up.min.js`. A página
do popup precisa do contexto fornecido pelo Trello para ler e gravar os dados.
Um servidor local isolado permite verificar os arquivos estáticos. Para testar
o Power-Up instalado, utilize a hospedagem HTTPS e um quadro de testes autorizado.

### Verificação executada em 25/11/2026

- **16 testes automatizados passaram** com `npm test`. Cobrem cálculo ponderado,
  exclusões, checklists novas e removidas, IDs repetidos, ausência de itens,
  0%, 100%, arredondamento, entradas inválidas e preservação dos dados recebidos.
  Também verificam todas as combinações de concluídos e totais de 1 a 100 itens.
- Os testes do adaptador usam um SDK simulado e conferem os argumentos de
  `t.card`, `t.get`, `t.set`, a espera pela gravação, falhas de leitura e escrita,
  alterações compartilhadas, atualização dos badges e abertura do popup.
- Um teste local em Chromium, usando Playwright temporariamente fora do projeto
  e SDK simulado, passou. Exercitou seleção, prévia de `60%`, leitura de seleção
  salva simulada, `t.render`, preservação de rascunho, checklist nova, estado
  neutro, falha de gravação e nova tentativa, falha de leitura e recuperação,
  conflito entre membros, nomes com HTML e largura de 320 px. O conector foi
  inicializado e suas duas capacidades foram exercitadas. Não houve erros JS.
- A documentação oficial e o SDK responderam HTTP 200 após a liberação dos
  domínios na rede do ambiente. A sintaxe de todos os módulos foi verificada.

O SDK simulado valida o contrato utilizado pelo código. O retorno real de um
cartão, os eventos de atualização, permissões e a propagação entre membros
permanecem sujeitos à validação manual abaixo.

## Publicar no GitHub Pages

1. Revise e envie os arquivos deste projeto para a branch `main` do repositório
   `rafaeloliveiratrd-oss/TRELLO---inteligent-Progress`.
2. No GitHub, acesse **Settings → Pages**.
3. Em **Build and deployment**, selecione **Deploy from a branch**.
4. Escolha `main`, a pasta `/ (root)` e salve.
5. Aguarde a publicação e confirme a URL HTTPS informada pelo GitHub Pages.
6. Verifique que `index.html`, `settings.html`, `css/settings.css`,
   `js/connector.js` e `images/progress.svg` respondem com sucesso.

A URL esperada do conector é
`https://rafaeloliveiratrd-oss.github.io/TRELLO---inteligent-Progress/index.html`.
Confirme a URL efetiva no painel do GitHub. Todos os recursos locais usam caminhos
relativos para funcionar no subdiretório do repositório.

## Registrar no Trello para uso personalizado

1. Acesse `https://trello.com/power-ups/admin` com uma conta autorizada a
   administrar Power-Ups no Workspace escolhido.
2. Crie um Power-Up com o nome **Progresso Inteligente** e preencha os campos
   obrigatórios do formulário, incluindo informações de contato solicitadas.
3. Informe a URL HTTPS de `index.html` no campo **Iframe connector URL**.
4. Ative somente as capacidades **card-buttons** e **card-badges**.
5. Salve o cadastro e adicione o Power-Up personalizado a um quadro de testes
   no Workspace correspondente.
6. Execute a validação manual antes de adotá-lo nos quadros de trabalho.

O MVP utiliza as funcionalidades nativas do SDK. O fluxo de instalação não pede
chave de API, token REST ou autorização OAuth. O cadastro personalizado permanece
restrito à disponibilidade configurada no Trello, sem publicação no marketplace.

A publicação no GitHub Pages, o cadastro no Trello e a instalação em um quadro
ficaram a cargo do responsável pelo projeto. Essas ações não foram executadas
pelo agente.

## Validação manual necessária no Trello

Use um quadro de testes autorizado e registre o resultado de cada caso.

- Confirme o botão **Configurar progresso**, a abertura do popup e todas as
  checklists marcadas no primeiro acesso.
- Crie uma checklist com três itens concluídos em cinco e outra de lembretes.
  Exclua a de lembretes e confirme `60%` na prévia e no badge após salvar.
- Se precisar inspecionar a resposta do SDK, use o depurador no contexto do
  popup e avalie `await window.TrelloPowerUp.iframe().card('checklists')`.
  Confirme o objeto `checklists`, os arrays `checkItems` e os estados `complete`
  e `incomplete`, sem copiar dados privados para logs compartilhados.
- Reabra o popup e confira a seleção salva. Confira a mesma seleção com outro
  membro autorizado do quadro.
- Conclua e reabra itens, adicione e remova checklists e confira a atualização
  do badge no ciclo do Trello, inclusive com o cartão fechado na lista.
- Confira `0%`, `100%`, cartão sem checklists, checklists vazias e todas
  desmarcadas. Os três últimos casos devem mostrar o estado neutro.
- Teste nomes longos, caracteres especiais, teclado e janela estreita.
- Simule indisponibilidade de rede e acesso sem permissão de edição. Uma falha
  de gravação deve manter a seleção no popup e permitir nova tentativa.
- Teste uma alteração de configuração por outro membro enquanto o popup está
  aberto. Quando a alteração é observada, o popup deve pedir para recarregar.
- Confira visualmente que o funcionamento das checklists e da barra nativa
  de progresso foi preservado.

## Limitações conhecidas

- O Trello controla quando chama novamente as capacidades e `t.render`. O MVP
  utiliza esse ciclo e a leitura sob demanda ao abrir ou recarregar o popup.
- O limite de plugin data é de **4096 caracteres por escopo/visibilidade**,
  compartilhado entre as chaves do próprio Power-Up naquele par. Uma lista
  grande de IDs pode excedê-lo. O erro de gravação é apresentado ao usuário.
- A gravação compartilhada do Trello não é atômica. O código relê os dados e
  detecta alterações observadas antes de salvar, mas gravações simultâneas
  ainda podem se sobrepor. Nessa situação, prevalece a última gravação.
- Quem pode editar o cartão pode salvar essa configuração compartilhada.
  O botão usa a condição `edit`, e eventuais recusas de armazenamento são tratadas.
- O SDK depende de acesso a `p.trellocdn.com`. A verificação local com mocks
  precisa ser complementada por um teste instalado no Trello.

## Documentação oficial consultada

Consultada em 25/11/2026. As páginas de referência do Power-Up consultadas
informavam atualização em 01/10/2026.

- [Acesso aos dados](https://developer.atlassian.com/cloud/trello/power-ups/client-library/accessing-trello-data/)
  inclui `checklists` entre os campos permitidos de `t.card()`. A ressalva sobre
  `checkItems` não garantidos é referente a `t.cards()`, e a página recomenda
  `t.card()` no contexto individual do cartão para obter os itens.
- [Modelo de checklist e itens](https://developer.atlassian.com/cloud/trello/rest/api-group-checklists/)
  documenta os estados `complete` e `incomplete`. Essa referência foi usada para
  confirmar o modelo de dados, e o MVP consulta os dados somente pelo SDK.
- [card-buttons](https://developer.atlassian.com/cloud/trello/power-ups/capabilities/card-buttons/)
- [card-badges](https://developer.atlassian.com/cloud/trello/power-ups/capabilities/card-badges/)
- [Plugin data com t.get e t.set](https://developer.atlassian.com/cloud/trello/power-ups/client-library/getting-and-setting-data/)
- [Atualização com t.render](https://developer.atlassian.com/cloud/trello/power-ups/client-library/t-render/)
- [Popup e fechamento](https://developer.atlassian.com/cloud/trello/power-ups/ui-functions/popup/)
- [Ajuste de altura com t.sizeTo](https://developer.atlassian.com/cloud/trello/power-ups/ui-functions/t-sizeto/)
