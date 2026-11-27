import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateProgress, normalizeIgnoredIds, ProgressDataError } from '../js/progress.js';

function checklist(id, completed, total) {
  return { id, name: id, checkItems: Array.from({ length: total }, (_, index) => ({
    id: `${id}-${index}`, name: `Item ${index}`, state: index < completed ? 'complete' : 'incomplete',
  })) };
}

test('considera todos os itens por padrão e calcula o caso dadas como 57%', () => {
  const result = calculateProgress([checklist('a', 3, 5), checklist('b', 1, 2)]);
  assert.equal(result.percentage, 57);
  assert.equal(result.total, 7);
  assert.equal(result.completed, 4);
});

test('exemplo 2 de 3 = 67%, excluindo individualmente um concluído e um pendente', () => {
  const data = [checklist('a', 3, 5)];
  const result = calculateProgress(data, ['a-2', 'a-4']);
  assert.equal(result.percentage, 67);
  assert.equal(result.completed, 2);
  assert.equal(result.total, 3);
  assert.equal(result.ignored, 2);
});

test('ignorar um item não exclui os demais da mesma checklist', () => {
  const result = calculateProgress([checklist('a', 1, 3)], ['a-2']);
  assert.equal(result.total, 2);
  assert.equal(result.percentage, 50);
});

test('IDs repetidos ou de itens excluídos não alteram contagens', () => {
  const result = calculateProgress([checklist('a', 1, 2)], ['a-1', 'a-1', 'removido']);
  assert.equal(result.total, 1);
  assert.equal(result.ignored, 1);
  assert.equal(result.percentage, 100);
});

test('novos itens entram automaticamente e renomear não muda a seleção', () => {
  const data = [checklist('a', 1, 2)];
  data[0].checkItems[1].name = 'Nome alterado';
  data[0].checkItems.push({ id: 'novo', name: 'Novo item', state: 'incomplete' });
  const result = calculateProgress(data, ['a-1']);
  assert.equal(result.total, 2);
  assert.equal(result.percentage, 50);
});

test('distingue cartão vazio, checklist vazia e todos os itens ignorados', () => {
  assert.equal(calculateProgress([]).status, 'empty');
  assert.equal(calculateProgress([checklist('a', 0, 0)]).status, 'empty');
  const ignored = calculateProgress([checklist('a', 1, 1)], ['a-0']);
  assert.equal(ignored.status, 'all-ignored');
  assert.equal(ignored.percentage, null);
  assert.equal(ignored.completed, 0);
  assert.equal(ignored.total, 0);
});

test('distingue 0%, 100% e arredondamento consistente', () => {
  for (const [completed, total, expected] of [[0, 3, 0], [3, 3, 100], [1, 3, 33], [2, 3, 67]]) {
    assert.equal(calculateProgress([checklist('a', completed, total)]).percentage, expected);
  }
});

test('não modifica nomes, ordem, posição, conclusão nem preferências', () => {
  const data = [checklist('a', 1, 3), checklist('b', 2, 2)];
  data[0].checkItems[0].pos = 123;
  const ignored = ['a-1', 'b-0'];
  const original = structuredClone({ data, ignored });
  calculateProgress(data, ignored);
  normalizeIgnoredIds(ignored);
  assert.deepEqual({ data, ignored }, original);
});

test('checkItems ausentes e dados inesperados geram erros distintos', () => {
  assert.throws(() => calculateProgress([{ id: 'a' }]), error => error.code === 'incomplete');
  for (const invalid of [undefined, null, {}, [null],
    [{ id: 'a', checkItems: [{}] }],
    [{ id: 'a', checkItems: [{ id: 'item', state: 'unknown' }] }]]) {
    assert.throws(() => calculateProgress(invalid), ProgressDataError);
  }
  for (const invalid of [null, {}, [''], [1], 'a']) {
    assert.throws(() => normalizeIgnoredIds(invalid), TypeError);
  }
});

test('valida os dados até de itens ignorados e rejeita IDs duplicados', () => {
  assert.throws(() => calculateProgress([{ id: 'a', checkItems: [{ id: 'x', state: 'bad' }] }], ['x']), /estado/);
  const data = [checklist('a', 1, 1), checklist('b', 1, 1)];
  data[1].checkItems[0].id = 'a-0';
  assert.throws(() => calculateProgress(data), /única/);
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
