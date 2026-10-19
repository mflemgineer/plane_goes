/** About screen: data attribution (adsb.lol ODbL, adsbdb, hexdb) in a modal dialog. */
export function setUpAbout(): void {
  const dialog = document.querySelector<HTMLDialogElement>('#about');
  const open = document.querySelector<HTMLButtonElement>('#about-open');
  if (!dialog || !open) return;

  open.addEventListener('click', () => dialog.showModal());
  // Tapping the dimmed backdrop (outside the panel) closes it too.
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
}
