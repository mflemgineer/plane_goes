/** "Boston (BOS)": a route end as the parent reads it. Saved Sightings before format 3 already hold this text. */
export function placeText(place: { code: string; city: string } | string): string {
  return typeof place === 'string' ? place : `${place.city} (${place.code})`;
}
