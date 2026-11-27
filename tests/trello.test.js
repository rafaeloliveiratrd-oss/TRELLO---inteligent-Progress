import test from 'node:test';
import assert from 'node:assert/strict';
import { readCardProgress, saveIgnoredItems, SETTINGS_KEY, LEGACY_SETTINGS_KEY, CARD_FIELDS } from '../js/trello-data.js';
import { createCapabilities } from '../js/capabilities.js';

function mockTrello() {
  const cards = {
    a: { id: 'a', name: 'dadas', checklists: [
      { id: 'work', name: 'Checklist', checkItems: Array.from({ length: 5 }, (_, i) => ({ id: `w${i}`, name: `Tarefa ${i}`, state: i < 3 ? 'complete' : 'incomplete' })) },
      { id: 'notes', name: 'dasdsad', checkItems: [{ id: 'n0', state: 'complete' }, { id: 'n1', state: 'incomplete' }] },
    ], badges: { checkItems: 7, checkItemsChecked: 4 } },
    b: { id: 'b', name: 'Outro cartão', checklists: [], badges: { checkItems: 0, checkItemsChecked: 0 } },
  };
  const stored = { a: {}, b: {} };
  const state = { cardId: 'a', cards, stored, failRead: false, failWrite: false };
  const calls = [];
  const t = {
    async card(...fields) {
      calls.push(['card', ...fields]);
      if (state.failRead) throw new Error('sem conexão');
      return structuredClone(cards[state.cardId]);
    },
    async get(scope, visibility, key, fallback) {
      calls.push(['get', scope, visibility, key, fallback]);
      return structuredClone(stored[state.cardId][key] ?? fallback);
    },
    async set(scope, visibility, settings) {
      calls.push(['set', scope, visibility, settings]);
      if (state.failWrite) throw new Error('sem permissão');
      Object.assign(stored[state.cardId], settings);
    },
  };
  return { t, state, calls };
}

test('consulta o cartão no contexto individual e usa a nova chave card/shared', async () => {
  const { t, calls } = mockTrello();
  const snapshot = await readCardProgress(t);
  assert.deepEqual(calls[0], ['card', ...CARD_FIELDS]);
  assert.ok(calls.some(call => JSON.stringify(call) === JSON.stringify(['get', 'card', 'shared', SETTINGS_KEY, []])));
  assert.equal(snapshot.progress.percentage, 57);
  assert.equal(snapshot.cardName, 'dadas');
});

test('preferências antigas de checklist não são aplicadas aos itens e leitura não grava', async () => {
  const { t, state, calls } = mockTrello();
  state.stored.a[LEGACY_SETTINGS_KEY] = ['work', 'notes'];
  const snapshot = await readCardProgress(t);
  assert.equal(snapshot.progress.percentage, 57);
  assert.equal(snapshot.legacyPreferences, true);
  assert.deepEqual(snapshot.ignoredIds, []);
  assert.equal(calls.some(call => call[0] === 'set'), false);
});

test('migração é feita em uma única gravação explícita e preserva outras chaves', async () => {
  const { t, state, calls } = mockTrello();
  state.stored.a = { [LEGACY_SETTINGS_KEY]: ['work'], other: 'preservado' };
  const baseline = await readCardProgress(t);
  await saveIgnoredItems(t, ['w3'], baseline);
  assert.deepEqual(state.stored.a, { [SETTINGS_KEY]: ['w3'], [LEGACY_SETTINGS_KEY]: [], other: 'preservado' });
  assert.equal(calls.filter(call => call[0] === 'set').length, 1);
});

test('preferências são restauradas e não afetam outro cartão', async () => {
  const { t, state } = mockTrello();
  await saveIgnoredItems(t, ['w3', 'n1'], await readCardProgress(t));
  assert.deepEqual((await readCardProgress(t)).ignoredIds, ['w3', 'n1']);
  state.cardId = 'b';
  assert.deepEqual((await readCardProgress(t)).ignoredIds, []);
  await saveIgnoredItems(t, [], await readCardProgress(t));
  assert.deepEqual(state.stored.a[SETTINGS_KEY], ['w3', 'n1']);
});

test('grava IDs individuais, elimina IDs excluídos e preserva os dados nativos', async () => {
  const { t, state } = mockTrello();
  const original = structuredClone(state.cards);
  const result = await saveIgnoredItems(t, ['w4', 'w4', 'removido'], await readCardProgress(t));
  assert.deepEqual(result.ignoredIds, ['w4']);
  assert.deepEqual(state.cards, original);
});

test('renomear itens mantém seleção e novos itens são considerados', async () => {
  const { t, state } = mockTrello();
  state.stored.a[SETTINGS_KEY] = ['n0'];
  state.cards.a.checklists[1].checkItems[0].name = 'Renomeado';
  state.cards.a.checklists[1].checkItems.push({ id: 'new', state: 'incomplete' });
  state.cards.a.badges.checkItems = 8;
  const result = await readCardProgress(t);
  assert.equal(result.progress.ignored, 1);
  assert.equal(result.progress.total, 7);
});

test('mudança compartilhada observada bloqueia gravação obsoleta', async () => {
  const { t, state, calls } = mockTrello();
  const baseline = await readCardProgress(t);
  state.stored.a[SETTINGS_KEY] = ['n0'];
  await assert.rejects(saveIgnoredItems(t, ['w3'], baseline), /configuração compartilhada mudou/);
  assert.equal(calls.some(call => call[0] === 'set'), false);
});

test('mudança de cartão em contexto bloqueia gravação', async () => {
  const { t, state } = mockTrello();
  const baseline = await readCardProgress(t);
  state.cardId = 'b';
  await assert.rejects(saveIgnoredItems(t, ['w3'], baseline), /cartão em contexto/);
});

test('espera a gravação e propaga a falha sem aposentar a preferência antiga', async () => {
  const { t, state } = mockTrello();
  state.stored.a[LEGACY_SETTINGS_KEY] = ['work'];
  const baseline = await readCardProgress(t);
  state.failWrite = true;
  await assert.rejects(saveIgnoredItems(t, ['w3'], baseline), /sem permissão/);
  assert.deepEqual(state.stored.a[LEGACY_SETTINGS_KEY], ['work']);
  let finish;
  t.set = () => new Promise(resolve => { finish = resolve; });
  let resolved = false;
  const pending = saveIgnoredItems(t, [], baseline).then(() => { resolved = true; });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(resolved, false);
  finish();
  await pending;
  assert.equal(resolved, true);
});

test('limite de 4096 caracteres é validado antes de gravar', async () => {
  const { t, state, calls } = mockTrello();
  state.cards.a.checklists[0].checkItems[0].id = 'x'.repeat(4096);
  await assert.rejects(saveIgnoredItems(t, ['x'.repeat(4096)], await readCardProgress(t)), /4096/);
  assert.equal(calls.some(call => call[0] === 'set'), false);
});

test('falhas de leitura e configuração corrompida não viram estado neutro', async () => {
  const { t, state } = mockTrello();
  state.failRead = true;
  await assert.rejects(readCardProgress(t), /conexão/);
  state.failRead = false;
  state.stored.a[SETTINGS_KEY] = 'corrompido';
  await assert.rejects(readCardProgress(t), /inválida/);
});

test('contador nativo positivo com itens vazios é resposta incompleta', async () => {
  const { t, state } = mockTrello();
  state.cards.a.checklists = [];
  await assert.rejects(readCardProgress(t), error => error.code === 'incomplete');
});

test('conclusões inconsistentes com os contadores nativos são resposta incompleta', async () => {
  const { t, state } = mockTrello();
  state.cards.a.badges.checkItemsChecked = 5;
  await assert.rejects(readCardProgress(t), error => error.code === 'incomplete');
});

test('contadores ausentes são opcionais, dados nativos inválidos são erros', async () => {
  const { t, state } = mockTrello();
  delete state.cards.a.badges;
  assert.equal((await readCardProgress(t)).progress.percentage, 57);
  for (const invalid of [0, 'inválido', [], { checkItems: 'sete' }]) {
    state.cards.a.badges = invalid;
    await assert.rejects(readCardProgress(t), error => error.code === 'unexpected');
  }
});

test('badge distingue percentuais, vazio, todos ignorados, dados incompletos e falha de leitura', async () => {
  const { t, state } = mockTrello();
  const badge = createCapabilities()['card-badges'];
  assert.deepEqual(await badge(t), [{ text: '57%' }]);
  state.stored.a[SETTINGS_KEY] = state.cards.a.checklists.flatMap(list => list.checkItems.map(item => item.id));
  assert.equal((await badge(t))[0].text, 'Sem itens considerados');
  state.cardId = 'b';
  assert.equal((await badge(t))[0].text, 'Sem itens');
  state.cardId = 'a';
  delete state.cards.a.checklists[0].checkItems;
  assert.equal((await badge(t))[0].text, 'Dados incompletos');
  state.failRead = true;
  assert.equal((await badge(t))[0].text, 'Progresso indisponível');
});

test('cada chamada de badge relê os estados e as preferências no seu contexto', async () => {
  const { t, state } = mockTrello();
  const badge = createCapabilities()['card-badges'];
  state.stored.a[SETTINGS_KEY] = ['w3', 'w4', 'n1'];
  assert.equal((await badge(t))[0].text, '100%');
  state.cards.a.checklists[0].checkItems[0].state = 'incomplete';
  state.cards.a.badges.checkItemsChecked = 3;
  assert.equal((await badge(t))[0].text, '75%');
  state.stored.a[SETTINGS_KEY] = [];
  state.cards.a.checklists.flatMap(list => list.checkItems).forEach(item => { item.state = 'incomplete'; });
  state.cards.a.badges.checkItemsChecked = 0;
  assert.equal((await badge(t))[0].text, '0%');
});

test('modal válida e badge com dados parciais são avaliados independentemente', async () => {
  const modal = mockTrello();
  const badge = mockTrello();
  assert.equal((await readCardProgress(modal.t)).progress.percentage, 57);
  badge.state.cards.a.checklists[0].checkItems = [];
  assert.equal((await createCapabilities()['card-badges'](badge.t))[0].text, 'Dados incompletos');
});

test('card-buttons abre a modal oficial com contexto local', async () => {
  const capabilities = createCapabilities();
  assert.deepEqual(Object.keys(capabilities).sort(), ['card-badges', 'card-buttons']);
  const [button] = capabilities['card-buttons']();
  let options;
  await button.callback({ modal: async value => { options = value; } });
  assert.equal(button.condition, 'edit');
  assert.deepEqual(options, { title: 'Progresso Inteligente', url: './settings.html', height: 720, fullscreen: false });
});

test('resposta perdida após gravação exige releitura e não sobrescreve preferência no retry', async () => {
  const { t, state, calls } = mockTrello();
  const baseline = await readCardProgress(t);
  const originalSet = t.set;
  t.set = async (...args) => {
    await originalSet(...args);
    throw new Error('confirmação perdida');
  };
  await assert.rejects(saveIgnoredItems(t, ['w3'], baseline), /confirmação perdida/);
  assert.deepEqual(state.stored.a[SETTINGS_KEY], ['w3']);
  await assert.rejects(saveIgnoredItems(t, ['w4'], baseline), /configuração compartilhada mudou/);
  assert.equal(calls.filter(call => call[0] === 'set').length, 1);
  assert.deepEqual((await readCardProgress(t)).ignoredIds, ['w3']);
});
