/*
 * Runs evaluateAnswer (current prompt version) over the fixtures on one or more providers
 * and prints how close each one gets to the expected scores.
 *
 *   yarn evals                         # uses evals/providers.json
 *   yarn evals --providers my.json     # another config
 *   yarn evals --only strong-star,off-topic
 *
 * providers.json (gitignored) lists providers; keys come from environment variables,
 * never from the file. See evals/providers.example.json and evals/README.md.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'
import { computeMetrics } from '../src/interview/metrics'
import { callEvaluateAnswer } from '../src/interview/llmCalls'
import { evaluateAnswer } from '../src/interview/prompts'
import { LlmError } from '../src/providers/llm/errors'
import { createLlmProvider } from '../src/providers/llm/openaiCompatible'
import { Fixture } from './fixtures'
import { compare, type Comparison } from './score'

const here = dirname(fileURLToPath(import.meta.url))

const ProviderEntry = z.object({
  name: z.string(),
  preset: z.string().default('custom'),
  baseUrl: z.url(),
  model: z.string(),
  /** Name of the environment variable holding the key (empty for local providers). */
  apiKeyEnv: z.string().optional(),
})

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}

function loadProviders() {
  const path = arg('providers') ?? join(here, 'providers.json')
  if (!existsSync(path)) {
    console.error(`No providers file at ${path}. Copy evals/providers.example.json to evals/providers.json.`)
    process.exit(1)
  }
  return z.array(ProviderEntry).parse(JSON.parse(readFileSync(path, 'utf8')))
}

function loadFixtures(): Fixture[] {
  const all = z.array(Fixture).parse(JSON.parse(readFileSync(join(here, 'fixtures', 'answers.json'), 'utf8')))
  const only = arg('only')?.split(',')
  return only ? all.filter((f) => only.includes(f.id)) : all
}

interface Row {
  provider: string
  fixture: string
  ok: boolean
  ms: number
  error?: string
  comparison?: Comparison
}

const pad = (s: string | number, n: number) => String(s).padEnd(n)
const fmt = (n: number) => n.toFixed(2)

async function main() {
  const providers = loadProviders()
  const fixtures = loadFixtures()
  const rows: Row[] = []
  console.log(`evaluateAnswer ${evaluateAnswer.version} · ${fixtures.length} fixtures · ${providers.length} providers\n`)

  for (const p of providers) {
    const apiKey = p.apiKeyEnv ? (process.env[p.apiKeyEnv] ?? '') : ''
    if (p.apiKeyEnv && !apiKey) {
      console.warn(`skip ${p.name}: ${p.apiKeyEnv} is not set`)
      continue
    }
    const llm = createLlmProvider({ preset: p.preset, baseUrl: p.baseUrl, apiKey, model: p.model })

    for (const f of fixtures) {
      const started = performance.now()
      try {
        const feedback = await callEvaluateAnswer(llm, {
          question: f.question,
          competency: f.competency,
          transcript: f.transcript,
          story: f.story,
          metrics: computeMetrics(f.transcript, f.language, f.answerDurationMs),
          interviewType: f.interviewType,
          language: f.language,
          feedbackLanguage: 'en',
        })
        const comparison = compare(f, feedback)
        rows.push({ provider: p.name, fixture: f.id, ok: true, ms: performance.now() - started, comparison })
        process.stdout.write('.')
      } catch (err) {
        // LlmError details are already redacted; never print the key.
        const error = err instanceof LlmError ? `${err.kind}${err.detail ? `: ${err.detail}` : ''}` : String(err)
        rows.push({ provider: p.name, fixture: f.id, ok: false, ms: performance.now() - started, error })
        process.stdout.write('x')
      }
    }
    process.stdout.write('\n')
  }

  console.log(`\n${pad('provider', 28)}${pad('valid', 8)}${pad('MAE', 7)}${pad('±tol', 7)}${pad('answered', 10)}${pad('invented#', 11)}avg ms`)
  for (const name of [...new Set(rows.map((r) => r.provider))]) {
    const mine = rows.filter((r) => r.provider === name)
    const good = mine.filter((r) => r.comparison)
    const avg = (fn: (c: Comparison) => number) =>
      good.length ? good.reduce((a, r) => a + fn(r.comparison!), 0) / good.length : NaN
    console.log(
      pad(name, 28) +
        pad(`${good.length}/${mine.length}`, 8) +
        pad(fmt(avg((c) => c.mae)), 7) +
        pad(`${Math.round(avg((c) => c.withinTolerance) * 100)}%`, 7) +
        pad(`${good.filter((r) => r.comparison!.answeredMatches).length}/${good.length}`, 10) +
        pad(good.filter((r) => r.comparison!.inventedNumbers.length).length, 11) +
        Math.round(mine.reduce((a, r) => a + r.ms, 0) / mine.length),
    )
  }
  const failures = rows.filter((r) => !r.ok)
  if (failures.length) {
    console.log('\nFailures:')
    for (const r of failures) console.log(`  ${r.provider} / ${r.fixture}: ${r.error}`)
  }

  const outDir = join(here, 'results')
  mkdirSync(outDir, { recursive: true })
  const out = join(outDir, `${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
  writeFileSync(out, JSON.stringify({ prompt: evaluateAnswer.version, rows }, null, 2))
  console.log(`\nDetails: ${out}`)
}

void main()
