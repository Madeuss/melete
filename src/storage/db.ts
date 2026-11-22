import Dexie, { type EntityTable } from 'dexie'
import type { LlmCall, Pitch, Session, Settings, Story, Turn } from '../schemas'

/**
 * IndexedDB via Dexie. Only the repositories in this folder touch it;
 * components and the engine go through them.
 */
export class MeleteDb extends Dexie {
  settings!: EntityTable<Settings, 'id'>
  stories!: EntityTable<Story, 'id'>
  sessions!: EntityTable<Session, 'id'>
  turns!: EntityTable<Turn, 'id'>
  llmCalls!: EntityTable<LlmCall, 'id'>
  pitches!: EntityTable<Pitch, 'id'>

  constructor(name = 'melete') {
    super(name)
    this.version(1).stores({
      settings: 'id',
      stories: 'id, *tags, updatedAt',
      sessions: 'id, createdAt, status',
      turns: 'id, sessionId, [sessionId+index]',
    })
    // v2: the LLM calls of each session, with token usage. Only adds a table: existing data stays.
    this.version(2).stores({
      llmCalls: 'id, sessionId',
    })
    // v3: saved versions of the "Tell me about yourself" pitch. Only adds a table.
    this.version(3).stores({
      pitches: 'id, createdAt',
    })
  }
}

let instance: MeleteDb | undefined

/** The app's database (created lazily so tests can use their own). */
export function getDb(): MeleteDb {
  instance ??= new MeleteDb()
  return instance
}

export function newId(): string {
  return crypto.randomUUID()
}

export function nowIso(): string {
  return new Date().toISOString()
}
