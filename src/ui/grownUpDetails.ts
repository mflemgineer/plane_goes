/** Renders Grown-up Details as short lines under the Kid Line. */
import type { GrownUpDetails } from '../engine';

export function grownUpDetailLines(details: GrownUpDetails): string[] {
  const lines = [details.airline ? `${details.airline} · Flight ${details.callsign}` : `Flight ${details.callsign}`];
  if (details.origin) lines.push(`From ${details.origin}`);
  if (details.destination) lines.push(`To ${details.destination}`);
  if (details.aircraftType) lines.push(`Aircraft ${details.aircraftType}`);
  if (details.altitudeFt !== undefined) lines.push(`${details.altitudeFt.toLocaleString('en-US')} ft`);
  if (details.minutesToLanding !== undefined) {
    lines.push(details.minutesToLanding < 1 ? 'Landing any moment' : `Lands in about ${details.minutesToLanding} min`);
  }
  return lines;
}

export function renderGrownUpDetails(into: HTMLElement, details: GrownUpDetails): void {
  into.replaceChildren(
    ...grownUpDetailLines(details).map((text) => {
      const line = document.createElement('span');
      line.className = 'details-line';
      line.textContent = text;
      return line;
    }),
  );
}
