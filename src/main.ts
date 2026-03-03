import { Game } from './Game';

/**
 * Wait until #card-host has been laid out by the browser before reading its
 * dimensions (clientWidth / clientHeight). This is needed because the Pixi
 * canvas must be sized to the card-host area, which is only known after the
 * CSS flex layout has been computed for the first time.
 */
function init(): void {
  const cardHost = document.getElementById('card-host');
  if (!cardHost) throw new Error('Missing #card-host element');

  if (cardHost.clientHeight === 0) {
    // Layout hasn't been computed yet — defer by one animation frame.
    requestAnimationFrame(init);
    return;
  }

  new Game(cardHost);
}

init();
