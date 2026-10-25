# Eval screenshots 002–021

Twenty screens from the developer's own apps, running locally, captured with `eval/capture/capture.mjs` (headless Chrome over the DevTools protocol; no dependency). Case 001 came earlier by hand.

**Fictional data only.** Before every capture the script replaces names, phone numbers, e-mails, addresses and brand names on the page with invented ones and hides logos (`eval/capture/scrub.mjs`), then scans the visible text and refuses the capture if anything real-looking is left. The apps' code was not changed: every problem is injected in the browser (a style, a DOM edit, or a failed or hanging request), and the user mistakes are the apps' own validation. The app names below are the fictional ones that appear on the screens.

| Case | App | Viewport | The injected problem | Category |
| --- | --- | --- | --- | --- |
| 002 | Northwind Clinic | 390×844 | The "Odaberi" button sits on top of the service description, cutting off the text under it. | Visual bug |
| 003 | Safeguard Services | 1440×900 | The hero heading overlaps the paragraph under it. | Visual bug |
| 004 | Pinewood Guesthouse | 390×844 | The room cards are squeezed into three columns on a phone, with prices and names wrapping into single letters. | Visual bug |
| 005 | Safeguard Services | 390×844 | The hero photo is missing; a broken-image placeholder shows in its place. | Visual bug |
| 006 | Brightsmile Dental | 1440×900 | The day list is in pale grey text on white, unreadable. | Visual bug |
| 007 | Pinewood Guesthouse | 1440×900 | A two-night stay at 55 BAM a night shows a total of 55 BAM. | Functional bug |
| 008 | Northwind Clinic | 390×844 | The slot step offers a Sunday, when the clinic is closed. | Functional bug |
| 009 | Brightsmile Dental | 390×844 | The first doctor's day list says "Nema termina." although the header counts 6 appointments. | Functional bug |
| 010 | Pinewood Guesthouse | 1440×900 | The same reservation appears twice in the list. | Functional bug |
| 011 | Brightsmile Dental | 1440×900 | The "Slobodno" filter is selected but the list still shows every appointment. | Functional bug |
| 012 | Pinewood Guesthouse | 390×844 | The rooms page answers with a 500 error page. | Error state |
| 013 | Safeguard Services | 390×844 | Sending the contact form fails with a network error; the form shows the "cannot send" message. | Error state |
| 014 | Safeguard Services | 390×844 | A correctly filled e-mail field shows "Unesite ispravnu e-mail adresu." | Error state |
| 015 | Safeguard Services | 1440×900 | The contact form stays on "Slanje upita…" for ever; the request never completes. | Error state |
| 016 | Safeguard Services | 1440×900 | The contact form was sent with the required fields empty; the app shows its own validation message. | User mistake (not a bug) |
| 017 | Northwind Clinic | 390×844 | The phone number was typed as "abc 12"; the app refuses it. | User mistake (not a bug) |
| 018 | Pinewood Guesthouse | 390×844 | The departure date is before the arrival date; the app asks for a later departure. | User mistake (not a bug) |
| 019 | Brightsmile Dental | 1440×900 | Nothing is wrong on the screen (the 7-day schedule). | Unclear (the screen looks normal) |
| 020 | Pinewood Guesthouse | 1440×900 | Nothing is wrong on the screen (the home page). | Unclear (the screen looks normal) |
| 021 | Northwind Clinic | 1440×900 | Nothing is wrong on the screen (the booking panel, service step). | Unclear (the screen looks normal) |

Counts: 5 visual, 5 functional, 4 error states, 3 user mistakes, 3 unclear; 10 phone and 10 desktop screens. Four apps: a clinic booking page, a safety company website, a guesthouse booking site with its admin, and a dental scheduler. The ERP was skipped: it needs PHP on the host, which this machine doesn't have.

The client sentences and reference tickets in `eval/cases.json` are written by hand afterwards (`sentence`, `author`, `nonTechnicalAuthor`, `reference`); the entries start empty. Images stay in `eval/images/` (git-ignored). To recapture, start the four apps on ports 4001–4004 and run `node eval/capture/capture.mjs`; `--sheet` only rebuilds `eval/images/contact-sheet.png`.
