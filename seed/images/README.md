# Seed screenshots (synthetic)

These three images are not real client screenshots. They show a fictional dental clinic's booking app, "Vedra Dental", with invented names and phone numbers. The app was built for the seed in `seed/demo-page/index.html`, and `scripts/capture-seed.mjs` rendered it as a 390 × 844 phone screen at 2x.

| File | The bug it shows | Seed ticket |
| --- | --- | --- |
| `synthetic-booking-details.png` | The name field is filled in, yet it says "Upišite ime i prezime." | Extracted, In progress, with a follow-up |
| `synthetic-booking-calendar.png` | A whole week reads "Nema slobodnih termina" | Extracted, Ask client |
| `synthetic-booking-payment.png` | The total reads "NaN KM" | Couldn't read the screenshot |

To change them, edit the demo page and run `node scripts/capture-seed.mjs` (Chrome must be installed; `CHROME_PATH` points to it if it isn't in the default Windows location).
