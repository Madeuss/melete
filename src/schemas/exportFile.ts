import { z } from 'zod'
import { Session } from './session'
import { Story } from './story'
import { Turn } from './turn'

/**
 * The user's JSON export. Never contains settings (and so never the API key).
 * The stories screen exports only `stories`; "export everything" adds sessions and turns.
 */
export const ExportFile = z.object({
  app: z.literal('melete'),
  version: z.literal(1),
  exportedAt: z.string(),
  stories: z.array(Story),
  sessions: z.array(Session).default([]),
  turns: z.array(Turn).default([]),
})
export type ExportFile = z.infer<typeof ExportFile>
