import { Game } from './Game';

const container = document.getElementById('game-container');
if (!container) throw new Error('Missing #game-container');

new Game(container);
