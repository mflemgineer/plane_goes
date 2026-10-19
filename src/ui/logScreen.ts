/**
 * The Log screen: Walks newest first, each with its Spotter credit and summary. Tapping a Walk
 * opens it to show each Sighting's Kid Line, time and Grown-up Details, with a delete button.
 * Clearing the whole log asks for confirmation first.
 */
import type { SightingLog, StoredSighting, Walk } from '../log';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Grown-up Details as they were at the time of a saved Sighting. */
export function savedDetailLines(sighting: StoredSighting): string[] {
  const ac = sighting.aircraft;
  if (!ac) return sighting.verdict.kind === 'mystery' ? ['No flight data for this one'] : [];
  const lines: string[] = [];
  const flight = `Flight ${ac.callsign ?? ac.hex}`;
  lines.push(ac.airline ? `${ac.airline} · ${flight}` : flight);
  if (ac.aircraftType) lines.push(`Aircraft ${ac.aircraftType}`);
  if (ac.origin) lines.push(`From ${ac.origin}`);
  if (ac.destination) lines.push(`To ${ac.destination}`);
  if (ac.altitudeFt !== undefined) lines.push(`${ac.altitudeFt.toLocaleString('en-US')} ft`);
  if (ac.minutesToLanding !== undefined) {
    lines.push(ac.minutesToLanding < 1 ? 'Was about to land' : `Was about ${ac.minutesToLanding} min from landing`);
  }
  return lines;
}

function timeOf(ms: number): string {
  return new Date(ms).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export function createLogScreen(log: SightingLog, elements: {
  list: HTMLUListElement;
  clearButton: HTMLButtonElement;
  clearConfirm: HTMLElement;
  clearYes: HTMLButtonElement;
  clearNo: HTMLButtonElement;
}, { onCleared = () => {} }: { onCleared?: () => void } = {}) {
  const { list, clearButton, clearConfirm, clearYes, clearNo } = elements;
  /** Walks the parent has opened, by Walk ID; kept while the app is open. */
  const open = new Set<string>();

  function sightingItem(sighting: StoredSighting): HTMLLIElement {
    const item = el('li', 'sighting');
    item.append(el('span', 'sighting-time', timeOf(sighting.time)), el('p', 'sighting-kid-line', sighting.kidLine));
    const details = el('p', 'sighting-details');
    details.append(...savedDetailLines(sighting).map((line) => el('span', 'details-line', line)));
    const remove = el('button', 'text-button sighting-delete', '🗑 Delete');
    remove.type = 'button';
    remove.setAttribute('aria-label', `Delete the ${timeOf(sighting.time)} Sighting`);
    remove.addEventListener('click', () => {
      safely(() => log.deleteSighting(sighting.id));
      render();
    });
    item.append(details, remove);
    return item;
  }

  function walkItem(walk: Walk): HTMLLIElement {
    const item = el('li', 'walk');
    const toggle = el('button', 'walk-open');
    toggle.type = 'button';
    const expanded = open.has(walk.id);
    toggle.setAttribute('aria-expanded', String(expanded));
    const head = el('span', 'walk-head');
    head.append(el('span', 'walk-name', walk.name), el('span', 'walk-count', `${walk.planeCount} ✈️`));
    toggle.append(head, el('span', 'walk-credit', walk.credit), el('span', 'walk-summary', walk.summary));
    toggle.addEventListener('click', () => {
      if (open.has(walk.id)) open.delete(walk.id);
      else open.add(walk.id);
      render();
    });
    item.append(toggle);
    if (expanded) {
      const sightings = el('ol', 'sightings');
      sightings.append(...walk.sightings.map(sightingItem));
      item.append(sightings);
    }
    return item;
  }

  function render(): void {
    let walks: Walk[] = [];
    safely(() => {
      walks = log.listWalks();
    });
    list.replaceChildren();
    clearConfirm.hidden = true;
    clearButton.hidden = walks.length === 0;
    if (walks.length === 0) {
      const spotter = log.getSpotterName();
      list.append(el('li', 'walk walk-empty', `No planes yet. Go spot one${spotter ? `, ${spotter}` : ''}! ✈️`));
      return;
    }
    list.append(...walks.map(walkItem));
  }

  clearButton.addEventListener('click', () => {
    clearConfirm.hidden = false;
    clearButton.hidden = true;
    clearNo.focus();
  });
  clearNo.addEventListener('click', render);
  clearYes.addEventListener('click', () => {
    safely(() => log.clear());
    safely(onCleared);
    open.clear();
    render();
  });

  return { render };
}

/** Storage can be blocked or unreadable; the Log screen must still work. */
function safely(action: () => void): void {
  try {
    action();
  } catch {
    // Nothing more to do: show what we can.
  }
}
