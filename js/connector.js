import { createCapabilities } from './capabilities.js';

const status = document.querySelector('#connector-status');
if (window.TrelloPowerUp) {
  window.TrelloPowerUp.initialize(createCapabilities());
  status.textContent = 'Conector do Power-Up carregado. Use “Configurar progresso” em um cartão do Trello.';
} else {
  status.textContent = 'Não foi possível carregar o SDK do Trello. Verifique sua conexão e recarregue.';
}
