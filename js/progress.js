/** Validate persisted settings before using or replacing them. */
export function normalizeIgnoredIds(value = []) {
  if (!Array.isArray(value) || value.some(id => typeof id !== 'string' || !id)) {
    throw new TypeError('Configuração de progresso inválida.');
  }
  return [...new Set(value)];
}

/** Calculate from checklist records with { id, checkItems: [{ state }] }. */
export function calculateProgress(checklists, ignoredIds = []) {
  if (!Array.isArray(checklists)) {
    throw new TypeError('Não foi possível ler as checklists.');
  }
  const ignored = new Set(normalizeIgnoredIds(ignoredIds));
  let total = 0;
  let completed = 0;
  for (const checklist of checklists) {
    if (!checklist || typeof checklist.id !== 'string' || !checklist.id) {
      throw new TypeError('Checklist sem identificação válida.');
    }
    if (ignored.has(checklist.id)) continue;
    if (!Array.isArray(checklist.checkItems)) {
      throw new TypeError('Não foi possível ler os itens da checklist.');
    }
    for (const item of checklist.checkItems) {
      if (!item || !['complete', 'incomplete'].includes(item.state)) {
        throw new TypeError('Item de checklist com estado inválido.');
      }
      total += 1;
      if (item.state === 'complete') completed += 1;
    }
  }
  return {
    completed,
    total,
    percentage: total === 0 ? null : Math.round(completed / total * 100),
  };
}
