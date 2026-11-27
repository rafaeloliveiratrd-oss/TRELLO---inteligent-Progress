import { calculateProgress, normalizeIgnoredIds, ProgressDataError } from './progress.js';

export const SETTINGS_KEY = 'ignoredCheckItemIds';
export const LEGACY_SETTINGS_KEY = 'ignoredChecklistIds';
export const CONFLICT_MESSAGE = 'A configuração compartilhada mudou. Recarregue antes de salvar.';
export const CARD_FIELDS = ['id', 'name', 'checklists', 'badges'];

export function sameIds(left, right) {
  const first = [...left].sort();
  const second = [...right].sort();
  return JSON.stringify(first) === JSON.stringify(second);
}

function validateNativeCounts(badges, progress) {
  if (badges === undefined || badges === null) return;
  if (typeof badges !== 'object' || Array.isArray(badges)) {
    throw new ProgressDataError('Contadores nativos inesperados.');
  }
  for (const [field, observed] of [['checkItems', progress.totalItems], ['checkItemsChecked', progress.allCompleted]]) {
    if (badges[field] === undefined) continue;
    if (!Number.isInteger(badges[field]) || badges[field] < 0) {
      throw new ProgressDataError('Contadores nativos inesperados.');
    }
    if (badges[field] !== observed) {
      throw new ProgressDataError('Os itens recebidos divergem dos contadores nativos do cartão.', 'incomplete');
    }
  }
}

export async function readCardProgress(t) {
  const [card, stored, legacy] = await Promise.all([
    t.card(...CARD_FIELDS),
    t.get('card', 'shared', SETTINGS_KEY, []),
    t.get('card', 'shared', LEGACY_SETTINGS_KEY, []),
  ]);
  if (!card || typeof card.id !== 'string' || !card.id) {
    throw new ProgressDataError('O Trello não identificou o cartão atual.', 'incomplete');
  }
  const ignoredIds = normalizeIgnoredIds(stored);
  const progress = calculateProgress(card.checklists, ignoredIds);
  validateNativeCounts(card.badges, progress);
  return {
    cardId: card.id,
    cardName: card.name || 'Cartão sem nome',
    checklists: card.checklists,
    ignoredIds,
    progress,
    legacyPreferences: Array.isArray(legacy) && legacy.length > 0,
  };
}

export async function saveIgnoredItems(t, ignoredIds, expected) {
  const selected = normalizeIgnoredIds(ignoredIds);
  const latest = await readCardProgress(t);
  if (latest.cardId !== expected.cardId) throw new Error('O cartão em contexto mudou. Reabra a configuração.');
  if (!sameIds(latest.ignoredIds, expected.ignoredIds)) throw new Error(CONFLICT_MESSAGE);
  const existing = new Set(latest.checklists.flatMap(checklist => checklist.checkItems.map(item => item.id)));
  const retained = selected.filter(id => existing.has(id));
  const settings = { [SETTINGS_KEY]: retained };
  // Retire whole-checklist preferences only after an explicit, successful save.
  if (latest.legacyPreferences) settings[LEGACY_SETTINGS_KEY] = [];
  if (JSON.stringify(settings).length > 4096) {
    throw new Error('A configuração excede o limite de 4096 caracteres do Trello. Considere mais itens antes de salvar.');
  }
  await t.set('card', 'shared', settings);
  return { ...latest, ignoredIds: retained, legacyPreferences: false,
    progress: calculateProgress(latest.checklists, retained) };
}
