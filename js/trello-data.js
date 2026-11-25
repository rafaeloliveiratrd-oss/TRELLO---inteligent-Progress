import { calculateProgress, normalizeIgnoredIds } from './progress.js';

export const SETTINGS_KEY = 'ignoredChecklistIds';

export function sameIds(left, right) {
  const first = [...left].sort();
  const second = [...right].sort();
  return JSON.stringify(first) === JSON.stringify(second);
}

export async function readCardProgress(t) {
  const [card, stored] = await Promise.all([
    t.card('checklists'),
    t.get('card', 'shared', SETTINGS_KEY, []),
  ]);
  const checklists = card?.checklists;
  // Validate all items, including ignored checklists shown in the editor.
  calculateProgress(checklists);
  const ignoredIds = normalizeIgnoredIds(stored);
  return { checklists, ignoredIds, progress: calculateProgress(checklists, ignoredIds) };
}

export async function saveIgnoredChecklists(t, ignoredIds, expectedIds) {
  const selected = normalizeIgnoredIds(ignoredIds);
  const latest = await readCardProgress(t);
  if (!sameIds(latest.ignoredIds, expectedIds)) {
    throw new Error('A configuração foi alterada por outro membro. Recarregue antes de salvar.');
  }
  const existing = new Set(latest.checklists.map(checklist => checklist.id));
  const retained = selected.filter(id => existing.has(id));
  // One shared write, awaited before reporting success. Removed IDs are pruned.
  await t.set('card', 'shared', SETTINGS_KEY, retained);
  return { ...latest, ignoredIds: retained,
    progress: calculateProgress(latest.checklists, retained) };
}
