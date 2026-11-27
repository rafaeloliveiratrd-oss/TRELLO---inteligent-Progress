import { readCardProgress } from './trello-data.js';
import { ProgressDataError } from './progress.js';

export function createCapabilities() {
  return {
    'card-buttons': () => [{
      text: 'Configurar progresso',
      icon: new URL('../images/progress.svg', import.meta.url).href,
      condition: 'edit',
      callback: t => t.modal({
        title: 'Progresso Inteligente',
        url: './settings.html',
        height: 720,
        fullscreen: false,
      }),
    }],
    'card-badges': async t => {
      try {
        const { progress } = await readCardProgress(t);
        if (progress.status === 'empty') return [{ text: 'Sem itens', color: 'light-gray' }];
        if (progress.status === 'all-ignored') return [{ text: 'Sem itens considerados', color: 'light-gray' }];
        return [{ text: `${progress.percentage}%` }];
      } catch (error) {
        if (error instanceof ProgressDataError) {
          return [{ text: error.code === 'incomplete' ? 'Dados incompletos' : 'Dados inesperados', color: 'light-gray' }];
        }
        return [{ text: 'Progresso indisponível', color: 'light-gray' }];
      }
    },
  };
}
