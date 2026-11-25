import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateProgress, normalizeIgnoredIds } from '../js/progress.js';

function checklist(id, completed, total) {
  return { id, checkItems: Array.from({ length: total }, (_, index) => ({
    state: index < completed ? 'complete' : 'incomplete',
  })) };
}

test('inclui todas por padrão e calcula pela quantidade de itens', () => {
  assert.deepEqual(calculateProgress([checklist('a', 1, 1), checklist('b', 2, 4)]), {
    completed: 3, total: 5, percentage: 60,
  });
});

test('ignora IDs selecionados, repetidos e de checklists removidas', () => {
  assert.deepEqual(calculateProgress([checklist('a', 1, 1), checklist('b', 0, 4)],
    ['b', 'b', 'removida']), { completed: 1, total: 1, percentage: 100 });
});

test('nova checklist entra automaticamente no cálculo', () => {
  assert.equal(calculateProgress([checklist('a', 0, 5), checklist('nova', 1, 1)], ['a']).percentage, 100);
});

test('estado neutro para cartão vazio, checklists vazias ou todas ignoradas', () => {
  for (const [lists, ignored] of [[[], []], [[checklist('a', 0, 0)], []],
    [[checklist('a', 1, 1)], ['a']]]) {
    assert.deepEqual(calculateProgress(lists, ignored), { completed: 0, total: 0, percentage: null });
  }
});

test('distingue 0%, 100% e arredondamento', () => {
  assert.equal(calculateProgress([checklist('a', 0, 3)]).percentage, 0);
  assert.equal(calculateProgress([checklist('a', 3, 3)]).percentage, 100);
  assert.equal(calculateProgress([checklist('a', 1, 3)]).percentage, 33);
  assert.equal(calculateProgress([checklist('a', 2, 3)]).percentage, 67);
});

test('não modifica dados nem configurações recebidas', () => {
  const data = [checklist('a', 1, 3), checklist('b', 2, 2)];
  const ignored = ['b', 'b'];
  const original = structuredClone({ data, ignored });
  calculateProgress(data, ignored);
  normalizeIgnoredIds(ignored);
  assert.deepEqual({ data, ignored }, original);
});

test('dados ausentes ou corrompidos produzem erro em vez de progresso enganoso', () => {
  for (const invalid of [undefined, null, {}, [null], [{ id: 'a' }],
    [{ id: 'a', checkItems: [{}] }], [{ id: 'a', checkItems: [{ state: 'unknown' }] }]]) {
    assert.throws(() => calculateProgress(invalid), TypeError);
  }
  for (const invalid of [null, {}, [''], [1], 'a']) {
    assert.throws(() => normalizeIgnoredIds(invalid), TypeError);
  }
});

test('limites do percentual para todas as combinações até 100 itens', () => {
  for (let total = 1; total <= 100; total += 1) {
    for (let completed = 0; completed <= total; completed += 1) {
      const result = calculateProgress([checklist('a', completed, total)]);
      assert.equal(result.percentage, Math.round(completed / total * 100));
      assert.ok(result.percentage >= 0 && result.percentage <= 100);
    }
  }
});
