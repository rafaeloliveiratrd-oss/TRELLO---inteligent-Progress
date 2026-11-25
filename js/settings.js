import { renderChecklists, renderSummary } from './settings-view.js';
import { readCardProgress, saveIgnoredChecklists, sameIds } from './trello-data.js';

const form = document.querySelector('#progress-form');
const checklistsElement = document.querySelector('#checklists');
const saveButton = document.querySelector('#save');
const reloadButton = document.querySelector('#reload');
const message = document.querySelector('#message');
let snapshot;
let baseline = [];
let ignored = new Set();
let dirty = false;
let saving = false;
let requestId = 0;
let t;

function showMessage(text, isError = false) {
  message.textContent = text;
  message.dataset.error = String(isError);
}

function updateView() {
  renderChecklists(checklistsElement, snapshot.checklists, [...ignored]);
  renderSummary(snapshot.checklists, [...ignored]);
  checklistsElement.disabled = false;
  saveButton.disabled = false;
}

async function load() {
  if (saving) return;
  const currentRequest = ++requestId;
  saveButton.disabled = true;
  try {
    const next = await readCardProgress(t);
    if (currentRequest !== requestId) return;
    if (!dirty) {
      baseline = next.ignoredIds;
      ignored = new Set(baseline);
    }
    snapshot = next;
    updateView();
    if (!sameIds(next.ignoredIds, baseline)) {
      showMessage('A configuração foi alterada por outro membro. Recarregue antes de salvar.', true);
      saveButton.disabled = true;
    } else {
      showMessage('');
    }
  } catch {
    if (currentRequest !== requestId) return;
    checklistsElement.disabled = true;
    saveButton.disabled = true;
    document.querySelector('#loading')?.remove();
    document.querySelector('#percentage').textContent = '—';
    document.querySelector('#counts').textContent = 'Progresso indisponível';
    showMessage('Não foi possível ler as checklists ou a configuração. Tente recarregar.', true);
  }
  try {
    await t.sizeTo('#settings');
  } catch {
    // Resizing is cosmetic. The popup can still be used and scrolled.
  }
}

checklistsElement.addEventListener('change', event => {
  const input = event.target;
  if (input.type !== 'checkbox') return;
  if (input.checked) ignored.delete(input.value);
  else ignored.add(input.value);
  dirty = true;
  renderSummary(snapshot.checklists, [...ignored]);
});

reloadButton.addEventListener('click', () => {
  dirty = false;
  void load();
});

form.addEventListener('submit', async event => {
  event.preventDefault();
  if (saving || saveButton.disabled || !snapshot) return;
  saving = true;
  ++requestId;
  checklistsElement.disabled = true;
  saveButton.disabled = true;
  reloadButton.disabled = true;
  showMessage('Salvando…');
  try {
    snapshot = await saveIgnoredChecklists(t, [...ignored], baseline);
    baseline = snapshot.ignoredIds;
    ignored = new Set(baseline);
    dirty = false;
    updateView();
    showMessage('Configuração salva.');
  } catch (error) {
    checklistsElement.disabled = false;
    saveButton.disabled = false;
    const conflict = error.message?.startsWith('A configuração foi alterada');
    showMessage(conflict ? error.message
      : 'Não foi possível salvar. Verifique sua conexão e sua permissão para editar o cartão. Tente novamente.', true);
    if (conflict) saveButton.disabled = true;
  } finally {
    saving = false;
    reloadButton.disabled = false;
  }
});

if (window.TrelloPowerUp) {
  t = window.TrelloPowerUp.iframe();
  t.render(load);
} else {
  document.querySelector('#loading')?.remove();
  reloadButton.disabled = true;
  showMessage('Não foi possível carregar o SDK do Trello. Reabra a configuração pelo cartão.', true);
}
