import test from 'node:test';
import assert from 'node:assert/strict';
import { readCardProgress, saveIgnoredChecklists, SETTINGS_KEY } from '../js/trello-data.js';
import { createCapabilities } from '../js/capabilities.js';

function mockTrello() {
  const calls = [];
  const state = {
    card: { checklists: [
      { id: 'a', name: 'Trabalho', checkItems: [{ state: 'complete' }, { state: 'incomplete' }] },
      { id: 'b', name: 'Lembretes', checkItems: [{ state: 'incomplete' }] },
    ] },
    stored: [],
  };
  const t = {
    async card(...args) { calls.push(['card', ...args]); return structuredClone(state.card); },
    async get(...args) { calls.push(['get', ...args]); return structuredClone(state.stored); },
    async set(...args) { calls.push(['set', ...args]); state.stored = structuredClone(args[3]); },
  };
  return { t, state, calls };
}

test('lê checkItems e state usando t.card, e preferências card/shared com padrão vazio', async () => {
  const { t, calls } = mockTrello();
  const result = await readCardProgress(t);
  assert.deepEqual(calls, [['card', 'checklists'], ['get', 'card', 'shared', SETTINGS_KEY, []]]);
  assert.deepEqual(result.progress, { completed: 1, total: 3, percentage: 33 });
});

test('salva somente IDs ignorados em uma gravação card/shared', async () => {
  const { t, calls, state } = mockTrello();
  const original = structuredClone(state.card);
  const result = await saveIgnoredChecklists(t, ['b', 'b', 'removida'], []);
  assert.deepEqual(calls.filter(call => call[0] === 'set'), [['set', 'card', 'shared', SETTINGS_KEY, ['b']]]);
  assert.deepEqual(result.progress, { completed: 1, total: 2, percentage: 50 });
  assert.deepEqual(state.card, original);
  assert.deepEqual((await readCardProgress(t)).ignoredIds, ['b']);
  await saveIgnoredChecklists(t, [], ['b']);
  assert.deepEqual(state.stored, []);
});

test('aguarda armazenamento e propaga falha de gravação', async () => {
  const { t } = mockTrello();
  let finish;
  t.set = () => new Promise(resolve => { finish = resolve; });
  let resolved = false;
  const saving = saveIgnoredChecklists(t, ['b'], []).then(() => { resolved = true; });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(resolved, false);
  finish();
  await saving;
  assert.equal(resolved, true);
  t.set = async () => { throw new Error('sem permissão'); };
  await assert.rejects(saveIgnoredChecklists(t, [], []), /sem permissão/);
});

test('configuração alterada por outro membro bloqueia gravação de edição antiga', async () => {
  const { t, state, calls } = mockTrello();
  state.stored = ['a'];
  await assert.rejects(saveIgnoredChecklists(t, ['b'], []), /outro membro/);
  assert.equal(calls.some(call => call[0] === 'set'), false);
});

test('falhas de leitura, configuração inválida e checkItems ausentes são erros', async () => {
  const { t, state } = mockTrello();
  t.get = async () => { throw new Error('sem conexão'); };
  await assert.rejects(readCardProgress(t), /sem conexão/);
  t.get = async () => 'inválido';
  await assert.rejects(readCardProgress(t), /Configuração/);
  t.get = async () => [];
  state.card = { checklists: [{ id: 'a' }] };
  await assert.rejects(readCardProgress(t), /itens/);
});

test('badge recalcula a cada chamada do ciclo Trello, incluindo mudanças nos itens e preferências', async () => {
  const { t, state } = mockTrello();
  const badges = createCapabilities()['card-badges'];
  assert.deepEqual(await badges(t), [{ text: '33%' }]);
  state.card.checklists[0].checkItems[1].state = 'complete';
  assert.deepEqual(await badges(t), [{ text: '67%' }]);
  state.stored = ['b'];
  assert.deepEqual(await badges(t), [{ text: '100%' }]);
  state.stored = ['a', 'b'];
  assert.deepEqual(await badges(t), [{ text: 'Sem itens', color: 'light-gray' }]);
  state.card = { checklists: [] };
  assert.equal((await badges(t))[0].text, 'Sem itens');
  state.card = {};
  assert.equal((await badges(t))[0].text, 'Progresso indisponível');
});

test('badge mostra exatamente 60% e distingue 0% de estado neutro', async () => {
  const { t, state } = mockTrello();
  state.card.checklists = [{ id: 'a', checkItems: Array.from({ length: 5 }, (_, i) => ({
    state: i < 3 ? 'complete' : 'incomplete',
  })) }];
  const badges = createCapabilities()['card-badges'];
  assert.deepEqual(await badges(t), [{ text: '60%' }]);
  state.card.checklists[0].checkItems.forEach(item => { item.state = 'incomplete'; });
  assert.deepEqual(await badges(t), [{ text: '0%' }]);
});

test('card-buttons abre popup com o contexto local do clique', async () => {
  const capabilities = createCapabilities();
  assert.deepEqual(Object.keys(capabilities).sort(), ['card-badges', 'card-buttons']);
  const [button] = capabilities['card-buttons']();
  assert.equal(button.text, 'Configurar progresso');
  assert.equal(button.condition, 'edit');
  let popup;
  await button.callback({ popup: async options => { popup = options; } });
  assert.deepEqual(popup, { title: 'Configurar progresso', url: './settings.html', height: 450 });
});
