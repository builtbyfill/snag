# Snag

Snag turns a client's screenshot and one sentence into a structured, reviewed ticket for the developer who maintains their app. This glossary fixes the words used in code, docs and UI copy.

## Language

### People

**Developer**:
The person who maintains the app and reads tickets. In the hackathon build this is one person holding the access code.
_Avoid_: admin, user, owner (the data has an owner slot for later; the role today is "developer")

**Client**:
The non-technical person who sends a report through a report link. Clients have no account and never see tickets.
_Avoid_: user, reporter, customer, end user

### Things

**Project**:
One client app the developer maintains. Each project has exactly one report link.
_Avoid_: app, workspace, site

**Report link**:
The public, unguessable URL a client opens to send a report. Identified by its slug.
_Avoid_: form link, public link, share link

**Report**:
What the client sends: one screenshot plus one client sentence. A report becomes a ticket the moment it is saved.
_Avoid_: submission, feedback, bug report (a report is not yet a ticket)

**Follow-up**:
Text the client adds later to a report they already sent, from the same device and in the report's chat. Text only: a new screenshot means a new report. It never changes the ticket's fields or status.
_Avoid_: reply, comment, message (nothing is sent back to the client)

**Client sentence**:
The client's own words, stored verbatim in their language, never translated or edited.
_Avoid_: description, message, comment

**Screenshot**:
The one image attached to a report. Stored as the ticket's attachment.
_Avoid_: image, photo, upload (upload is the act, screenshot is the thing)

**Ticket**:
The developer's working record of a report: the client's source material plus the ticket fields, status and extraction state. The developer edits ticket fields freely.
_Avoid_: issue (that is the GitHub destination), item, bug

**Ticket fields**:
Title, Where it happened, What's wrong, Priority, Tags, Expected result, Steps to reproduce. Written in English.
_Avoid_: properties, attributes, metadata

### Extraction

**Extraction**:
One attempt by the model to read a screenshot and client sentence into ticket fields. A ticket can have several extractions (automatic retries, manual Retry). The latest successful one filled the ticket.
_Avoid_: analysis, generation, AI run, inference (inference is reserved for inferred fields)

**Extraction state**:
Where a ticket stands with respect to extraction: `pending`, `extracted`, or `extraction_failed`. Independent of status.
_Avoid_: processing status, AI status

**Observed field**:
A ticket field the model fills from what the screenshot and sentence actually show: Title, Where it happened, What's wrong, Priority, Tags.
_Avoid_: fact, extracted field, certain field

**Inferred field**:
A ticket field the model fills by reasoning beyond what is directly shown: Expected result, Steps to reproduce. Shown to the developer as "suggested". An inferred field is either absent or carries evidence.
_Avoid_: guessed field, generated field, prediction

**Evidence**:
The model's short pointer to what in the screenshot or sentence supports an inferred field. Shown as "Based on: …". No evidence means the field stays empty.
_Avoid_: reasoning, explanation, justification, rationale

**Confidence**:
One number from 0 to 1 the model reports for the whole extraction. Stored and shown; its meaning is under evaluation.
_Avoid_: score, certainty, probability

**Ask client**:
A deterministic flag on an extracted ticket meaning the material is too thin to act on and the developer should ask the client one question. Advice, not an error.
_Avoid_: needs info, incomplete, low quality, warning

### Working the ticket

**Status**:
The developer's workflow position for a ticket: `new`, `in_progress`, `done`. Set by hand only.
_Avoid_: state (reserved for extraction state), stage, progress

**Priority**:
`low`, `medium`, `high`. Suggested by extraction, owned by the developer afterwards.
_Avoid_: severity, urgency, importance

**Markdown export**:
The ticket rendered in the agreed GitHub-Issues format, with empty fields omitted and inferred fields marked `_(suggested)_`.
_Avoid_: copy, share, GitHub export

### Evaluation

**Eval case**:
One screenshot and client sentence pair with a reference ticket, used to measure extraction quality. Synthetic: real bugs in the developer's own apps, sentences by real non-technical people.
_Avoid_: test case, sample, example, fixture

**Reference ticket**:
The hand-written correct ticket for an eval case, written after the client sentence exists.
_Avoid_: ground truth, gold label, expected output

**Accepted**:
An eval verdict: the extracted ticket needs at most one field edit to match the reference.
_Avoid_: passed, correct, success

**Invented**:
An inferred field the model filled where the reference says nothing supports it. One invented field fails the eval run regardless of the acceptance rate.
_Avoid_: hallucinated, wrong, false positive
