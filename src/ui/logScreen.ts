/** Renders the Log screen: Walks newest first, each with its name and plane count. */
import type { Walk } from '../log';

export function renderWalks(list: HTMLElement, walks: Walk[], spotter: string | null): void {
  list.replaceChildren();
  if (walks.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'walk walk-empty';
    empty.textContent = `No planes yet. Go spot one${spotter ? `, ${spotter}` : ''}! ✈️`;
    list.append(empty);
    return;
  }
  for (const walk of walks) {
    const item = document.createElement('li');
    item.className = 'walk';
    const name = document.createElement('span');
    name.className = 'walk-name';
    name.textContent = walk.name;
    const count = document.createElement('span');
    count.className = 'walk-count';
    count.textContent = `${walk.planeCount} ${walk.planeCount === 1 ? 'plane' : 'planes'}`;
    item.append(name, count);
    list.append(item);
  }
}
