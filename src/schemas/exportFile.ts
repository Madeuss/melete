import { z } from 'zod'
import { LlmCall } from './llmCall'
import { Pitch } from './pitch'
import { Profile } from './profile'
import { Session } from './session'
import { Story } from './story'
import { Turn } from './turn'

/**
 * The user's JSON export. Never contains settings (and so never the API key).
 * The stories screen exports only `stories`; "export everything" adds sessions, turns, LLM calls,
 * pitch versions and the CV profile. Older files without the newer lists still import (they default to []).
 */
export const ExportFile = z.object({
  app: z.literal('melete'),
  version: z.literal(1),
  exportedAt: z.string(),
  stories: z.array(Story),
  sessions: z.array(Session).default([]),
  turns: z.array(Turn).default([]),
  llmCalls: z.array(LlmCall).default([]),
  pitches: z.array(Pitch).default([]),
  profile: Profile.optional(),
})
export type ExportFile = z.infer<typeof ExportFile>
