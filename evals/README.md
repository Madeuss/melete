# Evals

Compares how close different models get to a human score when evaluating the same answers.
It runs the current `evaluateAnswer` prompt (see `src/interview/prompts/`) on every fixture.

## Run

```bash
cp evals/providers.example.json evals/providers.json   # gitignored
export OPENAI_API_KEY=...                               # keys only via env vars
yarn evals
yarn evals --only strong-star,off-topic                 # a subset
```

Output per provider:

| Column | Meaning |
| --- | --- |
| valid | answers that came back in the right format (after retries) |
| MAE | mean absolute error over the 5 scores (STAR + clarity), 0 is perfect |
| ±tol | share of scores within the fixture's tolerance (default ±1) |
| answered | how often `answeredTheQuestion` matched |
| invented# | fixtures where `improvedAnswer` had numbers that aren't in the transcript or story |
| avg ms | average latency, including retries |

Full results go to `evals/results/` (gitignored).

## Fixtures

`fixtures/answers.json` holds example answers with the expected scores. Each one targets a
case: a complete STAR answer, a generic one, a missing result, an off-topic answer, filler-heavy
speech, a technical answer, Portuguese, and a story without numbers (to catch invented facts).
The expected scores are one reviewer's judgment — adjust them if you disagree.

`yarn test` validates the fixture file and the scoring function without calling any provider.
