export type GameState = 'intro' | 'betting' | 'running' | 'revealing' | 'result' | 'gameover';

type StateListener = (state: GameState, prev: GameState) => void;

export class GameStateMachine {
  private _state: GameState = 'intro';
  private listeners: StateListener[] = [];

  get state(): GameState {
    return this._state;
  }

  transition(to: GameState): void {
    const prev = this._state;
    if (prev === to) return;
    this._state = to;
    for (const fn of this.listeners) {
      fn(to, prev);
    }
  }

  onStateChange(fn: StateListener): void {
    this.listeners.push(fn);
  }

  is(...states: GameState[]): boolean {
    return states.includes(this._state);
  }
}
