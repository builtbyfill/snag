// Shape of eval/capture/rules.local.mjs (git-ignored, because it lists the real names the scrubber
// replaces). Copy this file to rules.local.mjs and fill in your own apps.
const PHONE = String.raw`(\+?\s?387[\s/.-]*\d{2}[\s/.-]*\d{3}[\s/.-]*\d{3,4})|(0\d{2}[\s/.-]?\d{3}[\s/.-]?\d{3,4})`;
const EMAIL = String.raw`[\w.+-]+@[\w-]+(\.[\w-]+)+`;
export const FAKE_PHONE = '061 000 000';

export const apps = {
  example: {
    email: 'info@example-app.example',
    name: 'Example App', // the fictional name that appears on the screens
    base: 'http://localhost:4001',
    rules: [
      // [regex source, flags, replacement], applied to every text node, placeholder and value
      ['Real Business Name', 'g', 'Example App'],
      ['Real Street 1', 'g', 'Lipova 12'],
      ['Real Person', 'g', 'Ana Kovač'],
      [PHONE, 'g', FAKE_PHONE],
      [EMAIL, 'g', 'info@example-app.example'],
    ],
    hideImages: ['logo'], // substrings of decoded image URLs to hide
    forbidden: ['Real Business', 'Real Street', 'Real Person'], // the capture is refused if any is still visible
  },
};
