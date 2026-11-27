/** A malformed SDK response must never be presented as an empty card. */
export class ProgressDataError extends TypeError {
  constructor(message, code = 'unexpected') {
    super(message);
    this.name = 'ProgressDataError';
    this.code = code;
  }
}

export function normalizeIgnoredIds(value = []) {
  if (!Array.isArray(value) || value.some(id => typeof id !== 'string' || !id)) {
    throw new ProgressDataError('Configuração de itens ignorados inválida.');
  }
  return [...new Set(value)];
}

/** Count items across all checklists, without modifying their original records. */
export function calculateProgress(checklists, ignoredIds = []) {
  if (!Array.isArray(checklists)) {
    throw new ProgressDataError('O Trello não forneceu as checklists completas.',
      checklists == null ? 'incomplete' : 'unexpected');
  }
  const ignored = new Set(normalizeIgnoredIds(ignoredIds));
  const checklistIds = new Set();
  const itemIds = new Set();
  let completed = 0;
  let total = 0;
  let ignoredCount = 0;
  let allCompleted = 0;
  for (const checklist of checklists) {
    if (!checklist || typeof checklist.id !== 'string' || !checklist.id || checklistIds.has(checklist.id)) {
      throw new ProgressDataError('Checklist sem identificação única válida.');
    }
    checklistIds.add(checklist.id);
    if (!Array.isArray(checklist.checkItems)) {
      throw new ProgressDataError('O Trello não forneceu todos os itens das checklists.',
        checklist.checkItems == null ? 'incomplete' : 'unexpected');
    }
    for (const item of checklist.checkItems) {
      if (!item || typeof item.id !== 'string' || !item.id || itemIds.has(item.id)) {
        throw new ProgressDataError('Item sem identificação única válida.');
      }
      itemIds.add(item.id);
      if (!['complete', 'incomplete'].includes(item.state)) {
        throw new ProgressDataError('Item de checklist com estado inesperado.');
      }
      if (item.state === 'complete') allCompleted += 1;
      if (ignored.has(item.id)) {
        ignoredCount += 1;
        continue;
      }
      total += 1;
      if (item.state === 'complete') completed += 1;
    }
  }
  return {
    completed,
    total,
    ignored: ignoredCount,
    totalItems: itemIds.size,
    allCompleted,
    percentage: total === 0 ? null : Math.round(completed / total * 100),
    status: itemIds.size === 0 ? 'empty' : total === 0 ? 'all-ignored' : 'active',
  };
}

export function progressErrorMessage(error) {
  if (error instanceof ProgressDataError) {
    if (error.code === 'incomplete') return 'Dados incompletos do Trello. Tente recarregar.';
    return 'Dados inesperados do Trello ou da configuração. Tente recarregar.';
  }
  return 'Não foi possível ler os dados do cartão. Verifique sua conexão e tente recarregar.';
}
