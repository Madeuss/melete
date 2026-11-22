import { afterEach, describe, expect, it } from 'vitest'
import { defaultSettings, type SessionConfig } from '../schemas'
import { MeleteDb } from './db'
import { createRepositories } from './repositories'

const dbs: MeleteDb[] = []
function setup() {
  const db = new MeleteDb(`test-${crypto.randomUUID()}`)
  dbs.push(db)
  return createRepositories(db)
}
afterEach(async () => {
  await Promise.all(dbs.splice(0).map((db) => db.delete()))
})

const story = {
  title: 'Checkout outage',
  situation: 'Error rate jumped to 4%',
  task: 'Find the cause',
  action: 'Traced a retry race condition',
  result: 'Errors back under 0.1%',
  tags: ['Ownership', ' incident response ', 'ownership'],
}

const config: SessionConfig = {
  type: 'behavioral',
  role: 'Frontend engineer',
  seniority: 'senior',
  questionCount: 3,
  followUps: true,
  feedbackTiming: 'per-answer',
  difficulty: 'standard',
}

describe('settings repo', () => {
  it('returns defaults until saved, then the saved value', async () => {
    const r = setup()
    expect(await r.settings.get()).toBeUndefined()
    expect((await r.settings.getOrDefault('pt-BR')).uiLanguage).toBe('pt-BR')
    const saved = await r.settings.save({
      ...defaultSettings(),
      llm: { preset: 'openai', baseUrl: 'https://api.openai.com/v1', apiKey: 'sk-test', model: 'gpt-4o-mini' },
    })
    expect(await r.settings.get()).toEqual(saved)
  })

  it('rejects invalid settings', async () => {
    const r = setup()
    await expect(
      r.settings.save({ ...defaultSettings(), llm: { preset: 'x', baseUrl: 'not a url', apiKey: '', model: 'm' } }),
    ).rejects.toThrow()
  })
})

describe('stories repo', () => {
  it('creates with normalized, deduplicated tags and lists newest first', async () => {
    const r = setup()
    const a = await r.stories.create(story)
    expect(a.tags).toEqual(['ownership', 'incident-response'])
    await new Promise((res) => setTimeout(res, 5))
    const b = await r.stories.create({ ...story, title: 'Second' })
    expect((await r.stories.list()).map((s) => s.id)).toEqual([b.id, a.id])
    expect(await r.stories.allTags()).toEqual(['incident-response', 'ownership'])
  })

  it('updates and removes', async () => {
    const r = setup()
    const a = await r.stories.create(story)
    const u = await r.stories.update(a.id, { ...story, title: 'Renamed' })
    expect(u.title).toBe('Renamed')
    expect(u.createdAt).toBe(a.createdAt)
    await r.stories.remove(a.id)
    expect(await r.stories.list()).toEqual([])
  })

  it('requires a title', async () => {
    const r = setup()
    await expect(r.stories.create({ ...story, title: '  ' })).rejects.toThrow()
  })
})

describe('sessions and turns', () => {
  it('stores turns in index order and deletes them with the session', async () => {
    const r = setup()
    const s = await r.sessions.create({
      config,
      model: 'gpt-4o-mini',
      language: 'en',
      status: 'in-progress',
      plannedQuestions: [{ text: 'Tell me about a conflict', competency: 'conflict' }],
    })
    const metrics = { fillerWords: {}, wordCount: 3 }
    await r.turns.add({ sessionId: s.id, index: 1, kind: 'follow-up', question: 'Q2', transcript: 'b', metrics })
    await r.turns.add({ sessionId: s.id, index: 0, kind: 'main', question: 'Q1', transcript: 'a', metrics })
    expect((await r.turns.listBySession(s.id)).map((t) => t.question)).toEqual(['Q1', 'Q2'])

    await r.sessions.setStatus(s.id, 'abandoned')
    expect((await r.sessions.get(s.id))?.status).toBe('abandoned')

    await r.sessions.remove(s.id)
    expect(await r.turns.listBySession(s.id)).toEqual([])
  })
})

describe('export and import', () => {
  it('never includes settings or the API key', async () => {
    const r = setup()
    await r.settings.save({
      ...defaultSettings(),
      llm: { preset: 'openai', baseUrl: 'https://api.openai.com/v1', apiKey: 'sk-secret-123', model: 'm' },
    })
    await r.stories.create(story)
    const file = await r.data.exportAll()
    expect(JSON.stringify(file)).not.toContain('sk-secret-123')
    expect(file).not.toHaveProperty('settings')
    expect(file.stories).toHaveLength(1)
  })

  it('round-trips and does not duplicate on re-import', async () => {
    const a = setup()
    await a.stories.create(story)
    const file = JSON.parse(JSON.stringify(await a.data.exportAll()))

    const b = setup()
    await b.data.importFile(file)
    await b.data.importFile(file)
    expect(await b.stories.list()).toHaveLength(1)
  })

  it('rejects a file that is not a melete export', async () => {
    const r = setup()
    await expect(r.data.importFile({ stories: [] })).rejects.toThrow()
  })
})
