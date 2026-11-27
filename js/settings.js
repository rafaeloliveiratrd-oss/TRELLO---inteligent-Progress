import { renderChecklists, renderSummary } from './settings-view.js';
import { readCardProgress, saveIgnoredItems, sameIds, CONFLICT_MESSAGE } from './trello-data.js';
import { progressErrorMessage, ProgressDataError } from './progress.js';

const form = document.querySelector('#progress-form');
const checklistsElement = document.querySelector('#checklists');
const editor = document.querySelector('#editor');
const saveButton = document.querySelector('#save');
const reloadButton = document.querySelector('#reload');
const closeButton = document.querySelector('#close');
const message = document.querySelector('#message');
const discardDialog = document.querySelector('#discard-dialog');
let snapshot;
let baseline;
let ignored = new Set();
let filter = 'all';
let saving = false;
let loading = false;
let conflicted = false;
let requestId = 0;
let discardAction;
let t;

function isDirty() {
  return Boolean(baseline && !sameIds([...ignored], baseline.ignoredIds));
}

function hasConflict() {
  return Boolean(snapshot && baseline && !sameIds(snapshot.ignoredIds, baseline.ignoredIds));
}

function showMessage(text, isError = false) {
  message.textContent = text;
  message.dataset.error = String(isError);
}

function updateView() {
  const focusedId = document.activeElement?.dataset.itemId;
  renderChecklists(checklistsElement, snapshot.checklists, [...ignored], filter);
  renderSummary(snapshot.checklists, [...ignored]);
  document.querySelector('#card-name').textContent = snapshot.cardName;
  document.querySelector('#migration').hidden = !snapshot.legacyPreferences;
  editor.disabled = saving || loading;
  saveButton.disabled = saving || loading || conflicted || hasConflict();
  if (focusedId) {
    const button = [...checklistsElement.querySelectorAll('[data-item-id]')]
      .find(element => element.dataset.itemId === focusedId);
    (button || document.querySelector(`[data-filter="${filter}"]`)).focus({ preventScroll: true });
  }
}

async function load(discardDraft = false) {
  if (saving) return;
  const currentRequest = ++requestId;
  loading = true;
  editor.disabled = true;
  saveButton.disabled = true;
  checklistsElement.setAttribute('aria-busy', 'true');
  showMessage('Carregando…');
  try {
    const next = await readCardProgress(t);
    if (currentRequest !== requestId) return;
    if (baseline && next.cardId !== baseline.cardId && isDirty()) {
      throw new Error('O cartão em contexto mudou. Reabra a configuração.');
    }
    if (discardDraft || !isDirty()) {
      baseline = next;
      ignored = new Set(next.ignoredIds);
    }
    snapshot = next;
    conflicted = hasConflict();
    loading = false;
    updateView();
    showMessage(hasConflict() ? CONFLICT_MESSAGE : '', hasConflict());
  } catch (error) {
    if (currentRequest !== requestId) return;
    checklistsElement.textContent = 'Os itens não puderam ser carregados.';
    document.querySelector('#percentage').textContent = '—';
    document.querySelector('#counts').textContent = 'Progresso indisponível';
    document.querySelector('#progress-bar').hidden = true;
    for (const id of ['considered-count', 'completed-count', 'ignored-count']) {
      document.getElementById(id).textContent = '—';
    }
    showMessage(progressErrorMessage(error), true);
  } finally {
    if (currentRequest === requestId) {
      loading = false;
      checklistsElement.setAttribute('aria-busy', 'false');
    }
  }
}

async function runAction(action) {
  try {
    await action();
  } catch {
    showMessage('Não foi possível fechar a janela. Tente novamente.', true);
  }
}

function requestDiscard(action) {
  if (saving) return;
  if (!isDirty()) {
    void runAction(action);
    return;
  }
  discardAction = action;
  discardDialog.showModal();
}

document.querySelector('#keep-editing').addEventListener('click', () => {
  discardAction = undefined;
  discardDialog.close();
});
discardDialog.addEventListener('cancel', () => { discardAction = undefined; });
document.querySelector('#discard').addEventListener('click', () => {
  const action = discardAction;
  discardAction = undefined;
  discardDialog.close();
  if (action) void runAction(action);
});

checklistsElement.addEventListener('click', event => {
  const button = event.target.closest('button[data-item-id]');
  if (!button || editor.disabled) return;
  const id = button.dataset.itemId;
  if (ignored.has(id)) ignored.delete(id);
  else ignored.add(id);
  updateView();
  showMessage(hasConflict() ? CONFLICT_MESSAGE : isDirty() ? 'Alterações ainda não salvas.' : '', hasConflict());
});

for (const button of document.querySelectorAll('[data-filter]')) {
  button.addEventListener('click', () => {
    filter = button.dataset.filter;
    for (const option of document.querySelectorAll('[data-filter]')) {
      option.setAttribute('aria-pressed', String(option === button));
    }
    if (snapshot && !editor.disabled) updateView();
  });
}

reloadButton.addEventListener('click', () => requestDiscard(() => load(true)));
closeButton.addEventListener('click', () => requestDiscard(() => t.closeModal()));
window.addEventListener('beforeunload', event => {
  if (isDirty()) {
    event.preventDefault();
    event.returnValue = '';
  }
});

form.addEventListener('submit', async event => {
  event.preventDefault();
  if (saving || loading || saveButton.disabled || !snapshot) return;
  saving = true;
  ++requestId;
  editor.disabled = true;
  saveButton.disabled = true;
  reloadButton.disabled = true;
  closeButton.disabled = true;
  showMessage('Salvando…');
  try {
    snapshot = await saveIgnoredItems(t, [...ignored], baseline);
    baseline = snapshot;
    conflicted = false;
    ignored = new Set(snapshot.ignoredIds);
    showMessage('Configuração salva.');
  } catch (error) {
    if (error.message === CONFLICT_MESSAGE) {
      // Force a new read before the user can retry an obsolete draft.
      conflicted = true;
      showMessage(CONFLICT_MESSAGE, true);
    } else if (error instanceof ProgressDataError) {
      showMessage(progressErrorMessage(error), true);
    } else if (error.message?.includes('4096')) {
      showMessage('A configuração excede o limite de 4096 caracteres do Trello. Considere mais itens antes de salvar.', true);
    } else {
      showMessage('Não foi possível salvar. Verifique sua conexão e permissão para editar o cartão. Tente novamente.', true);
    }
  } finally {
    saving = false;
    reloadButton.disabled = false;
    closeButton.disabled = false;
    updateView();
  }
});

if (window.TrelloPowerUp) {
  t = window.TrelloPowerUp.iframe();
  t.render(() => load());
} else {
  checklistsElement.textContent = 'O SDK do Trello não foi carregado.';
  checklistsElement.setAttribute('aria-busy', 'false');
  reloadButton.disabled = true;
  closeButton.disabled = true;
  showMessage('Reabra a configuração pelo cartão do Trello.', true);
}
