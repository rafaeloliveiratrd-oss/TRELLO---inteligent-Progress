# Trello — Progresso Inteligente · MVP 1.1

Power-Up personalizado para escolher, individualmente, quais itens das checklists
contam no progresso de um cartão. Interface em português brasileiro, modal oficial
do Trello e hospedagem estática no GitHub Pages.

## Uso

1. Abra um cartão e clique em **Configurar progresso**.
2. Na modal **Progresso Inteligente**, confira o nome do cartão e o resumo.
3. Clique em **Considerar** para ignorar um item. O controle passa a **Ignorado**
   e a linha fica cinza. Clique novamente para voltar a considerar esse item.
4. Use **Todos**, **Considerados** e **Ignorados** para filtrar a visualização.
5. Confira a porcentagem, barra, itens considerados, concluídos e ignorados.
   A prévia muda imediatamente, antes da gravação.
6. Clique em **Salvar configuração** e aguarde a confirmação.

Os controles de seleção são independentes do estado de conclusão. O estado
**Concluído no Trello** ou **Pendente no Trello** é apresentado ao lado do nome.
A ordem segue as posições `pos` fornecidas pelo Trello. Quando as posições não
estão disponíveis para um conjunto, a ordem recebida daquele conjunto é mantida.
Nomes são inseridos com `textContent`, inclusive quando contêm HTML.

**Fechar** e **Recarregar** pedem confirmação quando há alterações não salvas.
O botão **Continuar editando** e Escape na confirmação preservam o rascunho.

## Cálculo e atualização

```text
Itens considerados concluídos / Total de itens considerados × 100
```

Todos os itens entram por padrão, inclusive itens novos. Itens ignorados são
excluídos do numerador e do denominador, mesmo quando concluídos. Os itens de
checklists diferentes são somados. O resultado é arredondado para o inteiro mais
próximo. Dois concluídos em três considerados resultam em **67%**.

Os filtros afetam apenas a visualização. Renomear um item mantém sua preferência,
pois ela é identificada por ID. O Power-Up não altera as checklists, seus itens,
nomes, posições, conclusão ou aparência na interface nativa do Trello.

A modal usa `t.render` para reler os dados e preservar rascunhos. O badge usa
`card-badges`, relendo os dados em cada chamada feita pelo Trello. A atualização
segue o ciclo oficial, sem temporizador ou promessa de latência fixa.

### Estados distintos

| Situação | Badge | Modal |
| --- | --- | --- |
| Há itens considerados | Por exemplo `67%` | Porcentagem, barra e contadores |
| Nenhum item considerado foi concluído | `0%` | 0% |
| Todos os considerados foram concluídos | `100%` | 100% |
| Cartão ou checklists realmente sem itens | `Sem itens` | `Sem itens no cartão` |
| Todos os itens existentes estão ignorados | `Sem itens considerados` | Mesmo texto e travessão |
| Resposta sem checklists/itens completos ou inconsistente com contadores | `Dados incompletos` | Erro e gravação desabilitada |
| IDs, estados ou configuração inválidos | `Dados inesperados` | Erro e gravação desabilitada |
| Falha de leitura/conexão/permissão | `Progresso indisponível` | Erro e opção de recarregar |

Em estados neutros ou de erro, a modal oculta a barra e usa um travessão na
porcentagem. A ausência de `checkItems` não é convertida em uma lista vazia.

## Armazenamento e migração do MVP 1.0

A chave atual é `ignoredCheckItemIds`, no escopo `card` e visibilidade `shared`.
A leitura usa `t.get('card', 'shared', 'ignoredCheckItemIds', [])`.
Somente os IDs dos itens ignorados são armazenados. Preferências são independentes
por cartão e compartilhadas entre seus usuários autorizados.

A chave antiga `ignoredChecklistIds` é lida somente para identificar configurações
anteriores e apresentar o aviso de migração. Suas exclusões não são transferidas
aos itens. Sem uma preferência individual já salva, todos os itens entram no cálculo.
Abrir a modal e consultar badges não provoca gravações.

Na primeira gravação explícita com configuração antiga ativa, uma única chamada
`t.set('card', 'shared', settings)` envia a nova chave e esvazia a lista antiga.
A retirada da preferência anterior somente é confirmada depois do sucesso dessa
operação. As outras chaves do Power-Up são preservadas pelo SDK. IDs de itens
excluídos são removidos da lista na próxima gravação.

Antes de gravar, o código relê os dados, verifica o cartão em contexto e compara
as preferências com a base da edição. Alterações compartilhadas observadas
bloqueiam a gravação e pedem para recarregar. Falhas preservam a seleção local
para nova tentativa.

## Diagnóstico do cartão `dadas`

O caso informado no quadro TESTE é coberto por testes com dados simulados.
Uma checklist com três de cinco concluídos e outra com um de dois resulta em
**4/7 = 57%**. Preferências antigas que ignoram as duas checklists não são
aplicadas aos itens na versão 1.1.

O leitor consulta `t.card('id', 'name', 'checklists', 'badges')` separadamente
no contexto de cada chamada. Valida todos os IDs e estados de `checkItems`,
inclusive os ignorados. Quando disponíveis, compara os totais recebidos com os
contadores oficiais `badges.checkItems` e `badges.checkItemsChecked`.
Um contador nativo positivo com arrays de itens vazios, ou outra divergência,
produz **Dados incompletos**. Os contadores não são usados para inferir estados
de itens individuais ausentes.

**Diagnóstico real pendente.** Em 27/11/2026, a leitura do quadro
`https://trello.com/b/2bgDZGFz/teste` foi bloqueada pelo proxy do ambiente com
HTTP 403 durante o CONNECT, antes de chegar ao Trello. Não houve inspeção
autenticada do cartão em produção. As diferenças entre modal e badge foram
exercitadas independentemente em testes simulados, sem presumir igualdade.
A causa exata do comportamento observado no Trello real ainda precisa de confirmação.

Para verificar o retorno real, use as ferramentas de desenvolvedor do navegador,
no contexto do iframe da modal, e avalie `window.TrelloPowerUp.iframe().card('id',
'name', 'checklists', 'badges')`. Para o badge, use um breakpoint dentro de
`card-badges` em `js/capabilities.js` e inspecione a resposta de `t.card` no contexto
`t` dessa chamada. Confira arrays, IDs, estados e contadores sem divulgar dados
privados. A documentação recomenda `t.card()` no contexto individual para obter
`checkItems`, pois a garantia não existe para a consulta coletiva `t.cards()`.

Se o SDK real omitir itens somente no badge, a seleção individual exige uma
fonte oficial que forneça seus estados nesse contexto. A API REST de leitura
é uma alternativa oficial a investigar com as permissões necessárias. O MVP
mantém a leitura nativa e informa a inconsistência enquanto ela existir.

## Arquivos

```text
index.html                  Conector
settings.html               Conteúdo da modal
css/settings.css            Interface responsiva
images/progress.svg         Ícone do botão
js/connector.js             Inicialização do SDK
js/capabilities.js          Botão e badge
js/progress.js              Cálculo, validação e estados
js/trello-data.js            Leitura, migração e gravação
js/settings.js              Estado da modal e interações
js/settings-view.js         Lista, filtros e resumo
tests/progress.test.js      Testes do cálculo
tests/trello.test.js        Testes do adaptador e capacidades
scripts/browser-smoke.mjs    Testes de interface no Chromium
package.json                Comandos e dependência de desenvolvimento
package-lock.json           Instalação reproduzível dos testes de interface
```

## Desenvolvimento e testes

Node.js 20 ou superior. Python 3 é usado pelo servidor de desenvolvimento.
A dependência `playwright-core` é usada somente nos testes de navegador. A
publicação no Pages serve HTML, CSS, JS e o ícone, sem build nem backend.

Execute os comandos abaixo em um terminal no diretório do projeto.

```sh
npm ci
npm test
npm run test:browser
npm start
```

O teste de navegador usa o Chromium existente em `/usr/bin/chromium`. Em outro
sistema, indique o executável pela variável `CHROMIUM_EXECUTABLE_PATH`.
O script intercepta os arquivos locais e simula o SDK. Os testes não acessam o
quadro TESTE e não modificam dados do Trello. Capturas de inspeção visual são
geradas na pasta temporária do sistema, fora do repositório.

`npm start` serve a raiz do projeto na porta 3000. O SDK precisa ser executado
no contexto do Trello para acessar um cartão real.

### Resultados em 27/11/2026

- **30 testes unitários e do adaptador passaram**. Incluem seleção individual,
  preservação dos dados, reabertura, várias checklists, ignorar concluídos e
  pendentes, itens novos, renomeados e excluídos, 0%, 100%, estados neutros,
  migração, erros, limite de armazenamento, conflitos, isolamento entre cartões
  e badge. Também verificam todas as combinações de concluídos e totais até 100.
- **9 testes no Chromium passaram**, com SDK simulado. Cobrem a modal e o
  conector, filtros, prévia, aparência dos ignorados, persistência simulada,
  teclado, confirmação de descarte, atualização de rascunho, respostas fora de
  ordem, falhas, conflitos, nomes com HTML e responsividade em 320, 480 e 1024 px.
- A validação em um cartão real e a propagação dos eventos do Trello seguem
  pendentes. Esses testes simulados não estabelecem o resultado real no quadro.

## Revisão e atualização no GitHub Pages

1. Abra o Pull Request da versão 1.1 e revise **Files changed**.
2. Após revisar os resultados e aceitar as limitações, faça o merge na `main`.
3. Em **Settings → Pages**, mantenha **Deploy from a branch**, `main`, `/ (root)`.
4. Acompanhe a publicação na aba **Actions** e confirme a URL informada em Pages.
5. Recarregue o quadro e reabra a modal para carregar os novos arquivos.
6. Mantenha somente `card-buttons` e `card-badges` habilitados no cadastro do
   Power-Up. A modal é uma função de UI dessas capacidades.

O conector permanece no endereço esperado
`https://rafaeloliveiratrd-oss.github.io/TRELLO---inteligent-Progress/index.html`.
O conteúdo da modal continua em `settings.html`, preservando a estrutura anterior.

Para um primeiro cadastro, acesse `https://trello.com/power-ups/admin`, crie o
Power-Up personalizado no Workspace autorizado, informe a URL HTTPS do conector
e habilite as duas capacidades. GitHub Pages em repositório público permite
hospedagem gratuita. Não há serviço externo pago, banco de dados ou backend.

O agente prepara a branch e o PR para revisão. Merge, publicação e gravações
no quadro de testes dependem da autorização do responsável.

## Roteiro manual no quadro TESTE

A execução dos passos que gravam plugin data deve ser autorizada pelo responsável.
O quadro indicado é `https://trello.com/b/2bgDZGFz/teste`.

1. Abra `dadas` e **Configurar progresso**. Confira nome, checklists e todos os
   itens na ordem original, com o progresso esperado de **57%** para quatro
   concluídos entre sete itens, caso esses dados permaneçam atuais.
2. Se houver configuração antiga, confira o aviso de migração e todos os itens
   inicialmente considerados. Abra e feche sem salvar para verificar a leitura.
3. Após autorizar uma gravação de teste, ignore um item pendente e um concluído.
   Confira o cálculo pela quantidade de itens considerados e os contadores.
4. Use os três filtros. A prévia deve permanecer igual ao trocar somente o filtro.
5. Salve, reabra e confira a seleção, o badge e a preferência compartilhada com
   outro membro autorizado. Confira que outro cartão manteve suas preferências.
6. Teste Fechar e Recarregar com rascunho, mantendo ou descartando alterações.
7. Confira teclado, nomes longos, janela estreita e muitas checklists.
8. Caso o quadro já contenha casos de 0%, 100%, ausência de itens e todos os
   itens ignorados, confira os indicadores correspondentes.
9. Para itens novos, renomeados e excluídos, use apenas um fixture separado cuja
   criação/alteração tenha sido previamente autorizada. Confirme preferência por
   ID, inclusão padrão e limpeza de IDs na próxima gravação.
10. Compare os retornos reais de modal e badge se houver **Dados incompletos**.
    Teste falhas de conexão e conflitos entre usuários com autorização.

## Limitações oficiais e operacionais

- O Trello controla a frequência das chamadas de atualização.
- O fechamento nativo da modal por X ou Escape fornece callback após o
  fechamento. A API documentada não oferece veto antes de fechar. A confirmação
  funciona nos botões Fechar e Recarregar da nossa interface. `beforeunload`
  é somente uma proteção adicional quando o navegador permitir, sem garantia
  de interceptar a remoção do iframe pelo Trello.
- Plugin data permite 4096 caracteres por escopo/visibilidade. A validação local
  verifica o payload da gravação, e o Trello verifica o total junto às outras
  chaves existentes. Erros preservam o rascunho. Se a confirmação de gravação for perdida, recarregue
  para verificar o estado efetivamente armazenado.
- A gravação compartilhada não é atômica. O código detecta mudanças já observadas,
  mas duas gravações simultâneas ainda podem se sobrepor. Prevalece a última.
- A rede do ambiente precisa permitir `trello.com` para a inspeção real e
  `api.github.com` para criação automatizada do PR. As inclusões foram salvas
  no rascunho de configuração, sem aplicação automática à instância.

## Referências oficiais consultadas

Consultadas em 27/11/2026. As páginas de referência do Power-Up informavam
atualização em 01/10/2026.

- Acesso aos dados e ressalva sobre `t.cards()`. https://developer.atlassian.com/cloud/trello/power-ups/client-library/accessing-trello-data/
- Modal, fechamento e callback. https://developer.atlassian.com/cloud/trello/power-ups/ui-functions/modal/
- Badge e ciclo suportado. https://developer.atlassian.com/cloud/trello/power-ups/capabilities/card-badges/
- Plugin data, limites e concorrência. https://developer.atlassian.com/cloud/trello/power-ups/client-library/getting-and-setting-data/
- Modelo dos contadores nativos do cartão. https://developer.atlassian.com/cloud/trello/rest/api-group-cards/
- Estados dos itens `complete` e `incomplete`. https://developer.atlassian.com/cloud/trello/rest/api-group-checklists/
