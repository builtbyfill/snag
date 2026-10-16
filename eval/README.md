# Snag extraction eval

This measures how often Snag's extraction produces a ticket a developer would use **with at most one field edit**, and whether it ever **invents** an inferred field (steps or expected result) that nothing in the material supports.

## The eval set is synthetic

The screenshots come from the developer's own apps, with fake data only. Each client sentence was written by a real non-technical person (friends and family) role-playing a client, without being told what the problem was. These are role-played reports, not real client tickets. The developer writes the reference tickets, after the sentence exists. The runner prints how many cases have a real non-technical author (`nonTechnicalAuthor` in `cases.json`).

**Limitation:** real client reports may be messier than these: blurry photos, the wrong screen, mixed languages.

Images stay local in `eval/images/` (git-ignored). `cases.json` (sentences and reference tickets) and `verdicts.json` (manual overrides) are committed.

## Running it

```bash
npm run eval                    # every case, scored
npm run eval -- --only 001      # one case
npm run eval -- --review        # model output beside the reference for every non-matching field
npm run eval -- --runs 3        # repeat each case; reports per-field agreement (3× the cost)
```

Needs `ANTHROPIC_API_KEY` in `.env`. The model and the screenshot size come from `EXTRACTION_MODEL` and `EXTRACTION_MAX_EDGE`, so comparing models or image sizes is an env change. Each run writes `eval/results/<timestamp>.json` (git-ignored) with every attempt, the raw model text and token usage.

## How a case is scored

Seven fields, each `✓` (match), `✗` (edit) or `INVENTED`:

| Field | Match when |
| --- | --- |
| title | every `mustMention` keyword appears (case-insensitive substring) |
| location | the value contains one of the `accept` strings (case-insensitive) |
| actualResult | every `mustMention` keyword appears, or the model gave null and the reference says `nullable` |
| priority | equal |
| tags | at least one of `anyOf` |
| expectedResult | both null; or reference set and keywords appear; or model null and reference says `orNull` |
| stepsToReproduce | both null; or each keyword group is satisfied by one single step and there are no more than `maxSteps` steps |

A `mustMention` entry can be a list of synonyms, any one of which is enough: `[["details", "Podaci"], ["empty", "not filled"]]` needs one word from each list.

A reference of `null` on an inferred field means nothing in the material supports it. If the model fills it anyway, that field is **INVENTED**.

- **Accepted**: at most one field is not a match.
- **Invented**: any invented field fails the case, and one invented field anywhere fails the run's second success criterion, whatever the acceptance rate.
- **Failed extraction**: counts as seven edits.

Success bar (from the scope): at least 70% accepted and zero invented fields. Below 50% means the prompt strategy or the product has to change.

## Honest limits

Keyword matching stands in for "I would not edit this". It can pass a clumsy sentence that happens to contain the right words, and fail a good one phrased differently. Two tools keep it honest:

- `--review` prints the model's value beside the reference for each non-matching field.
- `verdicts.json` overrules a field verdict by hand, e.g. `{ "001": { "title": "match" } }`. Overrides are counted and reported separately (`*` in the table), so a published number states how many verdicts were manual.

## Confidence check

From ten extracted cases on, the runner compares the five lowest-confidence tickets with the five most-edited tickets. If they share at most one ticket, confidence leaves the Ask client rule and only the field rules remain. Otherwise the 0.6 threshold is tuned using the printed table (for each threshold: how many tickets get the badge, precision and recall).
