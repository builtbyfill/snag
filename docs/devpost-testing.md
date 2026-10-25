# Testing instructions for judges

Paste into the Devpost "Testing instructions" field after deploying. Replace the three placeholders. The access code is the `DEMO_ACCESS_CODE` from the server's `.env`, never Filip's own code, and it never goes into the repository.

---

Snag turns a client's screenshot and one sentence into a structured bug ticket. There are two sides: the client's report page and the developer's dashboard. Both are loaded with four fictional clients and 16 example reports.

**1. Send a report as a client (best on a phone).** Open <CLIENT LINK>. Take a screenshot of any app or web page, add it with the image button, write one sentence about what went wrong, and press Send. No account is needed. Your report then shows its status on the same page.

**2. Watch it arrive as the developer.** Open <APP URL>/login and enter the access code <ACCESS CODE>. Your report appears in the dashboard within a few seconds, first as "Reading the screenshot…", then as a ticket card.

**3. Things to try in the dashboard:**
- Open a ticket. "From the screenshot" holds what the model saw. "Suggested by AI" holds what it inferred, each with a "Based on:" line, or "Not enough in the screenshot to tell".
- Click any field to edit it. It saves when you leave it and is marked Edited.
- Press Copy as Markdown for a GitHub issue body.
- Find an Ask client card: the model wasn't confident enough to act.
- Find the failed card in Pinewood Guesthouse and press Retry. It reads the screenshot for real, so once someone has retried it, it stays a normal ticket.
- Use j and k to move between cards, Enter to open one, and c to copy it, after clicking into the chat.

Limits: one screenshot per report, at most 10 reports an hour from one address, and the demo data is shared by everyone who has the code.
