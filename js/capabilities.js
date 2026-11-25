import { readCardProgress } from './trello-data.js';

export function createCapabilities() {
  return {
    'card-buttons': () => [{
      text: 'Configurar progresso',
      icon: new URL('../images/progress.svg', import.meta.url).href,
      condition: 'edit',
      callback: t => t.popup({
        title: 'Configurar progresso',
        url: './settings.html',
        height: 450,
      }),
    }],
    'card-badges': async t => {
      try {
        const { progress } = await readCardProgress(t);
        if (progress.percentage === null) {
          return [{ text: 'Sem itens', color: 'light-gray' }];
        }
        return [{ text: `${progress.percentage}%` }];
      } catch {
        return [{ text: 'Progresso indisponível', color: 'light-gray' }];
      }
    },
  };
}
