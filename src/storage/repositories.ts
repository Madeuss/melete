import {
  ExportFile,
  LlmCall,
  Pitch,
  Profile,
  Session,
  Settings,
  Story,
  StoryInput,
  Turn,
  defaultSettings,
  normalizeTag,
  type ProfileInput,
  type SessionStatus,
  type UiLanguage,
} from '../schemas'
import { getDb, newId, nowIso, type MeleteDb } from './db'

/*
 * Every read goes through schema.parse: data in IndexedDB may come from an older version
 * or from an import, so it's treated as untrusted like LLM output.
 */

function parseAll<T>(schema: { parse: (v: unknown) => T }, rows: unknown[]): T[] {
  return rows.map((r) => schema.parse(r))
}

export function createSettingsRepo(db: MeleteDb) {
  return {
    async get(): Promise<Settings | undefined> {
      const row = await db.settings.get('default')
      return row ? Settings.parse(row) : undefined
    },
    async getOrDefault(fallbackLanguage?: UiLanguage): Promise<Settings> {
      return (await this.get()) ?? defaultSettings(fallbackLanguage)
    },
    async save(settings: Settings): Promise<Settings> {
      const parsed = Settings.parse(settings)
      await db.settings.put(parsed)
      return parsed
    },
  }
}

function cleanStoryInput(input: StoryInput): StoryInput {
  const parsed = StoryInput.parse(input)
  const tags = [...new Set(parsed.tags.map(normalizeTag).filter(Boolean))]
  return { ...parsed, tags }
}

export function createStoriesRepo(db: MeleteDb) {
  return {
    async list(): Promise<Story[]> {
      const rows = await db.stories.orderBy('updatedAt').reverse().toArray()
      return parseAll(Story, rows)
    },
    async get(id: string): Promise<Story | undefined> {
      const row = await db.stories.get(id)
      return row ? Story.parse(row) : undefined
    },
    async create(input: StoryInput): Promise<Story> {
      const now = nowIso()
      const story = Story.parse({ ...cleanStoryInput(input), id: newId(), createdAt: now, updatedAt: now })
      await db.stories.add(story)
      return story
    },
    async update(id: string, input: StoryInput): Promise<Story> {
      const current = await this.get(id)
      if (!current) throw new Error(`Story ${id} not found`)
      const story = Story.parse({ ...current, ...cleanStoryInput(input), updatedAt: nowIso() })
      await db.stories.put(story)
      return story
    },
    async remove(id: string): Promise<void> {
      await db.stories.delete(id)
    },
    /** Upsert by id: importing the same file twice doesn't duplicate stories. */
    async importMany(stories: Story[]): Promise<number> {
      const parsed = parseAll(Story, stories)
      await db.stories.bulkPut(parsed)
      return parsed.length
    },
    async allTags(): Promise<string[]> {
      const keys = await db.stories.orderBy('tags').uniqueKeys()
      return keys.map(String).sort()
    },
  }
}

export function createSessionsRepo(db: MeleteDb) {
  return {
    async create(data: Omit<Session, 'id' | 'createdAt'>): Promise<Session> {
      const session = Session.parse({ ...data, id: newId(), createdAt: nowIso() })
      await db.sessions.add(session)
      return session
    },
    async get(id: string): Promise<Session | undefined> {
      const row = await db.sessions.get(id)
      return row ? Session.parse(row) : undefined
    },
    async list(): Promise<Session[]> {
      const rows = await db.sessions.orderBy('createdAt').reverse().toArray()
      return parseAll(Session, rows)
    },
    async update(id: string, patch: Partial<Omit<Session, 'id' | 'createdAt'>>): Promise<Session> {
      const current = await this.get(id)
      if (!current) throw new Error(`Session ${id} not found`)
      const next = Session.parse({ ...current, ...patch })
      await db.sessions.put(next)
      return next
    },
    async setStatus(id: string, status: SessionStatus): Promise<void> {
      await db.sessions.update(id, { status })
    },
    /** Deletes a session, its turns and its LLM calls. */
    async remove(id: string): Promise<void> {
      await db.transaction('rw', [db.sessions, db.turns, db.llmCalls], async () => {
        await db.turns.where('sessionId').equals(id).delete()
        await db.llmCalls.where('sessionId').equals(id).delete()
        await db.sessions.delete(id)
      })
    },
  }
}

export function createTurnsRepo(db: MeleteDb) {
  return {
    async add(data: Omit<Turn, 'id' | 'createdAt'>): Promise<Turn> {
      const turn = Turn.parse({ ...data, id: newId(), createdAt: nowIso() })
      await db.turns.add(turn)
      return turn
    },
    async listBySession(sessionId: string): Promise<Turn[]> {
      const rows = await db.turns
        .where('[sessionId+index]')
        .between([sessionId, -Infinity], [sessionId, Infinity])
        .toArray()
      return parseAll(Turn, rows)
    },
    async update(id: string, patch: Partial<Omit<Turn, 'id' | 'sessionId' | 'createdAt'>>): Promise<Turn> {
      const row = await db.turns.get(id)
      if (!row) throw new Error(`Turn ${id} not found`)
      const next = Turn.parse({ ...Turn.parse(row), ...patch })
      await db.turns.put(next)
      return next
    },
  }
}

export function createLlmCallsRepo(db: MeleteDb) {
  return {
    async add(data: Omit<LlmCall, 'id' | 'createdAt'>): Promise<LlmCall> {
      const call = LlmCall.parse({ ...data, id: newId(), createdAt: nowIso() })
      await db.llmCalls.add(call)
      return call
    },
    async listBySession(sessionId: string): Promise<LlmCall[]> {
      const rows = await db.llmCalls.where('sessionId').equals(sessionId).sortBy('createdAt')
      return parseAll(LlmCall, rows)
    },
  }
}

export function createPitchesRepo(db: MeleteDb) {
  return {
    async add(data: Omit<Pitch, 'id' | 'createdAt'>): Promise<Pitch> {
      const pitch = Pitch.parse({ ...data, id: newId(), createdAt: nowIso() })
      await db.pitches.add(pitch)
      return pitch
    },
    /** Newest first. */
    async list(): Promise<Pitch[]> {
      return parseAll(Pitch, await db.pitches.orderBy('createdAt').reverse().toArray())
    },
    async update(id: string, patch: Partial<Omit<Pitch, 'id' | 'createdAt'>>): Promise<Pitch> {
      const row = await db.pitches.get(id)
      if (!row) throw new Error(`Pitch ${id} not found`)
      const next = Pitch.parse({ ...Pitch.parse(row), ...patch })
      await db.pitches.put(next)
      return next
    },
    async remove(id: string): Promise<void> {
      await db.pitches.delete(id)
    },
  }
}

export function createProfileRepo(db: MeleteDb) {
  return {
    async get(): Promise<Profile | undefined> {
      const row = await db.profile.get('default')
      return row ? Profile.parse(row) : undefined
    },
    async save(input: ProfileInput): Promise<Profile> {
      const profile = Profile.parse({ ...input, id: 'default', updatedAt: nowIso() })
      await db.profile.put(profile)
      return profile
    },
    async remove(): Promise<void> {
      await db.profile.delete('default')
    },
  }
}

export function createDataRepo(db: MeleteDb) {
  return {
    /** Full export. Settings (and so the API key) are never included. */
    async exportAll(): Promise<ExportFile> {
      const [stories, sessions, turns, llmCalls, pitches, profile] = await Promise.all([
        db.stories.toArray(),
        db.sessions.toArray(),
        db.turns.toArray(),
        db.llmCalls.toArray(),
        db.pitches.toArray(),
        db.profile.get('default'),
      ])
      return ExportFile.parse({
        app: 'melete',
        version: 1,
        exportedAt: nowIso(),
        stories,
        sessions,
        turns,
        llmCalls,
        pitches,
        ...(profile ? { profile } : {}),
      })
    },
    async exportStories(): Promise<ExportFile> {
      return ExportFile.parse({
        app: 'melete',
        version: 1,
        exportedAt: nowIso(),
        stories: await db.stories.toArray(),
      })
    },
    /** Validates the whole file first, then upserts everything in one transaction. */
    async importFile(raw: unknown): Promise<{ stories: number; sessions: number }> {
      const file = ExportFile.parse(raw)
      await db.transaction('rw', [db.stories, db.sessions, db.turns, db.llmCalls, db.pitches, db.profile], async () => {
        await db.stories.bulkPut(file.stories)
        await db.sessions.bulkPut(file.sessions)
        await db.turns.bulkPut(file.turns)
        await db.llmCalls.bulkPut(file.llmCalls)
        await db.pitches.bulkPut(file.pitches)
        if (file.profile) await db.profile.put(file.profile)
      })
      return { stories: file.stories.length, sessions: file.sessions.length }
    },
    async wipe(): Promise<void> {
      const tables = [db.settings, db.stories, db.sessions, db.turns, db.llmCalls, db.pitches, db.profile]
      await db.transaction('rw', tables, async () => {
        await Promise.all([
          db.settings.clear(),
          db.stories.clear(),
          db.sessions.clear(),
          db.turns.clear(),
          db.llmCalls.clear(),
          db.pitches.clear(),
          db.profile.clear(),
        ])
      })
    },
  }
}

export type SettingsRepo = ReturnType<typeof createSettingsRepo>
export type StoriesRepo = ReturnType<typeof createStoriesRepo>
export type SessionsRepo = ReturnType<typeof createSessionsRepo>
export type TurnsRepo = ReturnType<typeof createTurnsRepo>
export type LlmCallsRepo = ReturnType<typeof createLlmCallsRepo>
export type PitchesRepo = ReturnType<typeof createPitchesRepo>
export type ProfileRepo = ReturnType<typeof createProfileRepo>
export type DataRepo = ReturnType<typeof createDataRepo>

export interface Repositories {
  settings: SettingsRepo
  stories: StoriesRepo
  sessions: SessionsRepo
  turns: TurnsRepo
  llmCalls: LlmCallsRepo
  pitches: PitchesRepo
  profile: ProfileRepo
  data: DataRepo
}

export function createRepositories(db: MeleteDb): Repositories {
  return {
    settings: createSettingsRepo(db),
    stories: createStoriesRepo(db),
    sessions: createSessionsRepo(db),
    turns: createTurnsRepo(db),
    llmCalls: createLlmCallsRepo(db),
    pitches: createPitchesRepo(db),
    profile: createProfileRepo(db),
    data: createDataRepo(db),
  }
}

let repos: Repositories | undefined
export function getRepositories(): Repositories {
  repos ??= createRepositories(getDb())
  return repos
}
