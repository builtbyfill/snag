---
target: client report page redesign
total_score: 25
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
target_identity: "file:C:\\Users\\Korisnik\\Projects\\snag\\app\\(client)\\r\\[slug]\\client-portal.tsx"
target_fingerprint: "sha256:1ca77cb03802d98f4661141338f4de2b1be3f78ced7881681aab5f6571132784"
target_path: "C:\\Users\\Korisnik\\Projects\\snag\\app\\(client)\\r\\[slug]\\client-portal.tsx"
timestamp: 2026-10-16T23-31-21Z
slug: app-client-r-slug-client-portal-tsx
---
# Critique: client report page (monochrome portal redesign), 2026-10-17

Method: dual-agent (A: design review on the live production build at :3005, 375x812 and 1280x800; B: `impeccable detect` CLI plus in-browser detector).

## Design specificity verdict
The frame looks like piz-erp: graphite bar, the workspace inset into graphite, date tiles, uppercase labels, thin borders, no hue. The two moments that matter most look generic: "we got it" (confirmation) and "how far is it" (status). The thread idea from the PRD (her screenshot becomes her message and later shows its progress) is down to a 13px pill and one grey line.

## Heuristics (0-4)
| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of system status | 2 | Confirmation is a 13px grey timestamp plus a pill, with nothing announced; on phones status is behind an icon |
| 2 | Match with real world | 3 | "Write at least 10 characters" makes people count; "Marked as done" is passive |
| 3 | User control and freedom | 3 | Remove drops focus to body |
| 4 | Consistency and standards | 2 | "In progress" group holds rows that say "Received"; the "New report" back button means both back and new; two selection styles; sheet opens on the left while its trigger is on the right |
| 5 | Error prevention | 2 | A chip on its own passes the 10-character rule |
| 6 | Recognition rather than recall | 2 | Truncated rows; the bare "3" count in the header |
| 7 | Flexibility and efficiency | 3 | Paste, drop, chips, draft kept |
| 8 | Aesthetic and minimalist | 3 | About 370px of cards before the task on phones; "no account" said twice |
| 9 | Error recovery | 2 | Errors are shown in the footer, away from their fields; invalid looks the same as focused |
| 10 | Help and documentation | 3 | Contact card has nothing to act on when no name or email is set |
| | **Total** | **25/40** | |

## Detector (B)
CLI: 0 findings. In the browser: 3 `nested-cards` at 1280px on the first visit only (welcome cards inside the bordered workspace frame); 0 at 375px and on returning visits. No color or contrast findings.

## Priority issues
- [P1] Confirmation is only metadata and screen readers hear nothing: focus falls to body and the live region unmounts with the form. Fix: a status headline at title size, a persistent role=status region, focus on the timeline heading.
- [P1] On phones a returning client can't see status: the page opens on a blank form and the reports are behind an icon with a bare count. Fix: on phones, open on the report list when history exists.
- [P2] Errors sit away from their fields, and invalid looks like focus. Fix: the screenshot error inside the screenshot area, the sentence error under the field, its own invalid look.
- [P2] A chip on its own is a sendable report. Fix: chips leave room for detail and the client checks for detail beyond the chip; reword the error so nobody has to count characters.
- [P3] On a first visit on phones, reading comes before doing; copy is repeated; the Contact card is empty without env values; h3 comes before h1.

## Persona red flags
Jordan (first-timer): the "3" icon means nothing to him, the "New report" back button reads as create, a bare chip is sendable. Casey (one-handed phone): the sheet trigger and its close are on the top edge, and the sheet opens from the opposite side. Sam (screen reader): nothing is announced on send, focus is lost on Remove and on send, "Start with" is read twice, aria-current="page" is used for a selection inside the page. Amra (receptionist): cards before the form, counting characters, the error far from the screenshot area, a tiny grey success state, a blank form the next day.

## Minor observations
Send floats on tall phones (the form needs min-h-full). Chips and the "New report" row use the line-medium edge (1.6:1). The sheet keeps shadcn's shadow and blur. Two selection styles. Mixed date formats ("17 OCT" vs "15.10. 01:25"). Status and time are each shown twice in the timeline. A single step leaves a dangling rule. The paste hint says Ctrl+V on Mac. The not-found heading reads awkwardly. Docs still say Bosnian.

## Questions for the owner
1. "Usually replies the same day" promises a reply this page never shows.
2. The thread vs the Open/Done list.
3. How "done" can feel like an ending without color.
