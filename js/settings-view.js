import { calculateProgress } from './progress.js';

function inOriginalOrder(records) {
  if (records.every(record => Number.isFinite(record.pos))) {
    return [...records].sort((left, right) => left.pos - right.pos);
  }
  return [...records];
}

export function renderChecklists(container, checklists, ignoredIds, filter = 'all') {
  const ignored = new Set(ignoredIds);
  const fragment = document.createDocumentFragment();
  for (const checklist of inOriginalOrder(checklists)) {
    const visible = inOriginalOrder(checklist.checkItems).filter(item => {
      if (filter === 'included') return !ignored.has(item.id);
      if (filter === 'ignored') return ignored.has(item.id);
      return true;
    });
    if (visible.length === 0 && (filter !== 'all' || checklist.checkItems.length > 0)) continue;
    const section = document.createElement('section');
    section.className = 'checklist';
    const heading = document.createElement('h2');
    heading.textContent = checklist.name || 'Checklist sem nome';
    section.append(heading);
    const list = document.createElement('ul');
    for (const item of visible) {
      const excluded = ignored.has(item.id);
      const row = document.createElement('li');
      row.className = 'item';
      row.dataset.ignored = String(excluded);
      row.dataset.complete = String(item.state === 'complete');
      const info = document.createElement('div');
      info.className = 'item-info';
      const name = document.createElement('span');
      name.className = 'item-name';
      name.textContent = item.name || 'Item sem nome';
      const state = document.createElement('span');
      state.className = 'item-state';
      state.textContent = item.state === 'complete' ? 'Concluído no Trello' : 'Pendente no Trello';
      info.append(name, state);
      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'item-toggle';
      toggle.dataset.itemId = item.id;
      toggle.setAttribute('aria-pressed', String(excluded));
      toggle.setAttribute('aria-label', `${excluded ? 'Considerar' : 'Ignorar'} ${item.name || 'item'} no progresso`);
      toggle.textContent = excluded ? 'Ignorado' : 'Considerar';
      row.append(info, toggle);
      list.append(row);
    }
    section.append(list);
    if (checklist.checkItems.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'empty';
      empty.textContent = 'Esta checklist não possui itens.';
      section.append(empty);
    }
    fragment.append(section);
  }
  if (!fragment.childElementCount) {
    const empty = document.createElement('p');
    empty.className = 'empty';
    empty.textContent = filter === 'all' ? 'Este cartão não possui checklists.' : 'Nenhum item neste filtro.';
    fragment.append(empty);
  }
  container.replaceChildren(fragment);
}

export function renderSummary(checklists, ignoredIds) {
  const result = calculateProgress(checklists, ignoredIds);
  document.querySelector('#percentage').textContent = result.percentage === null ? '—' : `${result.percentage}%`;
  const bar = document.querySelector('#progress-bar');
  bar.hidden = result.percentage === null;
  bar.value = result.percentage ?? 0;
  let description = `${result.completed} de ${result.total} itens considerados concluídos`;
  if (result.status === 'empty') description = 'Sem itens no cartão';
  if (result.status === 'all-ignored') description = 'Sem itens considerados';
  document.querySelector('#counts').textContent = description;
  document.querySelector('#considered-count').textContent = result.total;
  document.querySelector('#completed-count').textContent = result.completed;
  document.querySelector('#ignored-count').textContent = result.ignored;
}
