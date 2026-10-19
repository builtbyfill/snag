---
target: dashboard
total_score: 27
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
target_identity: "file:C:\\Users\\Korisnik\\Projects\\snag\\app\\(admin)\\dashboard"
timestamp: 2026-10-18T19-40-18Z
slug: app-admin-dashboard
closed: true
---
Method: dual-agent (A: design review; B: detector + screenshot evidence)

| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of system status | 3 | Counts, reading state, polling work; copy confirmation far from its button |
| 2 | Match with the real world | 3 | 0.41 unexplained; speaker label is the project name |
| 3 | User control and freedom | 3 | Esc, Cancel, Show all, URL tabs; nav sheet has no visible close |
| 4 | Consistency and standards | 2 | Done as view/tab/status; Inbox twice; header lines misaligned |
| 5 | Error prevention | 3 | Keys ignored while typing; name field maxLength 120 vs 60 rule |
| 6 | Recognition rather than recall | 3 | Key legend visible; tabs have no counts |
| 7 | Flexibility and efficiency | 3 | j/k/Enter/c/Esc, URL state, diacritic search; no key to switch client or focus search |
| 8 | Aesthetic and minimalist design | 3 | Restrained; 400px screenshots dominate; empty chat shows four tabs |
| 9 | Error recovery | 2 | Failed card has no next step |
| 10 | Help and documentation | 2 | Ask client tooltip-only; confidence unexplained |
| Total | | 27/40 | Acceptable, top of band |

Design specificity: category-standard ChatGPT shell by brief; Snag voice in the thread (Snag mark answers, SN-n and confidence in Plex Mono, glyph+word states, dashed reading card, red only on failure). Missed: observed/inferred honesty barely visible on the card. Detector: 0 findings (dashboard dir, priority-bars.tsx); TSX regex-only. Overlay skipped: login-gated, test code kept out of agent context.

Priority issues
- [P1] Whole page scrolls (second scrollbar): sr-only spans escape the scroll containers; document 1373px at 1440x900; root scrollbar light. Fix: relative on scroll containers in thread.tsx and clients-column.tsx. /impeccable polish
- [P1] Screenshots crowd out tickets (400px tall, ~1 report per viewport). Fix: cap thumbnail at 240px tall in report-message.tsx. /impeccable layout
- [P1] Failed card is a dead end (repeats sentence, opens placeholder). Fix: next step instead of excerpt; slice 9 card becomes article + stretched link for Retry. /impeccable harden
- [P2] Header lines misaligned (nav none, thread at 92px), Inbox twice, copy feedback detached and covering the key legend. Fix: tabs in the 52px title row from 1024px, nav header line, sr-only column heading at xl, header button copied state. /impeccable polish
- [P3] Count pill invisible on selected/hover row; nav sheet 384px not 260; empty chat shows tabs; phone list marks auto-chosen client; Ask client hint tooltip-only. /impeccable polish

Persona red flags
- Alex: no client-switch key, no / for search; j/k scrolls past 400px images.
- Sam: Ask client hint tooltip-only; ~40-word card names; count pill vanishes on open row.
- Filip: empty projects above real work in Inbox; "3" doesn't say how many are untouched; SN-3 no next step.

Minor: name maxLength 120 vs 60; sheet backdrop blur is the only glass effect; 0.41 would read better beside Ask client.

Questions: Do projects with no reports belong above real work? Should the ticket card lead from 1280px with the screenshot beside it?
