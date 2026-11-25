import { calculateProgress } from './progress.js';

/** Render text using DOM APIs so checklist names never become HTML. */
export function renderChecklists(container, checklists, ignoredIds) {
  const ignored = new Set(ignoredIds);
  const fragment = document.createDocumentFragment();
  if (checklists.length === 0) {
    const empty = document.createElement('p');
    empty.textContent = 'Este cartão ainda não possui checklists.';
    fragment.append(empty);
  }
  for (const checklist of checklists) {
    const label = document.createElement('label');
    label.className = 'checklist';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.value = checklist.id;
    input.checked = !ignored.has(checklist.id);
    const text = document.createElement('span');
    text.textContent = checklist.name || 'Checklist sem nome';
    const counts = document.createElement('small');
    const progress = calculateProgress([checklist]);
    counts.textContent = `${progress.completed} de ${progress.total} itens concluídos`;
    text.append(counts);
    label.append(input, text);
    fragment.append(label);
  }
  container.replaceChildren(fragment);
}

export function renderSummary(checklists, ignoredIds) {
  const result = calculateProgress(checklists, ignoredIds);
  document.querySelector('#percentage').textContent = result.percentage === null
    ? '—' : `${result.percentage}%`;
  document.querySelector('#counts').textContent = result.total === 0
    ? 'Nenhum item considerado'
    : `${result.completed} de ${result.total} itens concluídos`;
}
