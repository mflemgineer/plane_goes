/** About screen: data attribution (adsb.lol ODbL, adsbdb, hexdb) in a modal dialog. */
export function setUpAbout(): void {
  const dialog = document.querySelector<HTMLDialogElement>('#about');
  if (!dialog) return;

  // One About button per screen that has one (the Spot screen and the first-run screens).
  for (const open of document.querySelectorAll<HTMLButtonElement>('.about-open')) {
    open.addEventListener('click', () => dialog.showModal());
  }
  // Tapping the dimmed backdrop (outside the panel) closes it too.
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
}
