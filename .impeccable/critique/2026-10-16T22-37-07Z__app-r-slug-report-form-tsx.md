---
target: client report page /r/[slug]
total_score: 27
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
target_identity: "file:C:\\Users\\Korisnik\\Projects\\snag\\app\\r\\[slug]\\report-form.tsx"
target_fingerprint: "sha256:efc26533f4560ab68d1c88bf55f35edbd2cafd57f0f4c0a9962267fef202ddbf"
target_path: "C:\\Users\\Korisnik\\Projects\\snag\\app\\r\\[slug]\\report-form.tsx"
timestamp: 2026-10-16T22-37-07Z
slug: app-r-slug-report-form-tsx
---
Method: dual-agent (A: design review · B: detector + browser evidence), isolated subagents.

## Design health: 27/40 (Acceptable)
| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of system status | 2 | No upload progress; reopening the link shows a blank form |
| 2 | Match system / real world | 3 | "Prijavite problem" sounds bureaucratic; English project name reads as the booking app |
| 3 | User control and freedom | 2 | Fake "Zamijeni" chip, no remove, nothing correctable after Send |
| 4 | Consistency and standards | 3 | Error state on textarea only; focus rings off-spec |
| 5 | Error prevention | 3 | Photos over 5 MB rejected instead of downscaled |
| 6 | Recognition rather than recall | 3 | Example placeholder vanishes on first keystroke |
| 7 | Flexibility and efficiency | 3 | Paste works but isn't mentioned |
| 8 | Aesthetic and minimalist | 3 | Duplicate title/subtitle; near-borderless dropzone |
| 9 | Error recovery | 3 | 5 MB / smaller-image messages are dead ends; rate limit gives no time |
| 10 | Help and documentation | 2 | No WhatsApp fallback on failure; no screenshot help |

## Design specificity
Copy is Snag's own; the composition is a generic shadcn upload form. Detector: 0 source findings; 1 live finding (placeholder 3.1:1, mobile + desktop), confirmed independently by the review; deliberate but fails WCAG 1.4.3 under the AA commitment. Review-only findings: input borders 1.2:1 (1.4.11), screen-reader semantics, focus ring overridden by shadcn outline-none.

## Priority issues
1. [P1] Large camera photos dead-end at 5 MB. Fix: client-side downscale (~2560 px, JPEG ~0.85). /impeccable harden
2. [P1] Screen-reader semantics: role=presentation button, English input label, unlinked error, double alert, html lang=en. Fix: real labelled attach button, one linked alert, lang=bs per route group root layout. /impeccable audit
3. [P2] No human before Send. Fix: chat header with developer name; name in reply. /impeccable clarify
4. [P2] Input borders ~1.2:1. Fix: input-border token >= 3:1. /impeccable polish
5. [P2] Sending looks like failing (50% fade, Send text ~2.3:1). Fix: lock without fading, aria-busy, reassurance after ~3 s. /impeccable harden

## Persona red flags
Amra (receptionist): 5 MB dead end photographing the monitor; half-English header; text lost on reload; can't check later. Casey: dropzone in top third; 26px "send another" link; pinned bar 28% with keyboard open. Sam: unlabelled role=presentation button; English input label; unlinked error; double alert; Send focus ~2.3:1 (outline-none override). Jordan: "Clinic booking" reads as the app; no screenshot help.

## Minor observations
Placeholder to ~#6B7380 (4.8:1); duplicate title/subtitle; "we" voice vs PRD; rate-limit wording; global focus-ring override.

## Questions to consider
What does she worry about before Send? Should a report work without a screenshot? Could the ending promise a name and a channel?
