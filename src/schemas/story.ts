import { z } from 'zod'

export const Story = z.object({
  id: z.string(),
  title: z.string(),
  situation: z.string(),
  task: z.string(),
  action: z.string(),
  result: z.string(),
  tags: z.array(z.string()), // e.g. conflict, leadership, failure, ownership
  createdAt: z.string(),
  updatedAt: z.string(),
})
export type Story = z.infer<typeof Story>

/**
 * Editor limits. Generous for a spoken answer (2,000 characters is ~3 minutes of speech), but
 * they keep prompts small. Only new edits are checked: stored and imported stories aren't.
 */
export const STORY_LIMITS = { title: 120, part: 2000 } as const

/** What the editor produces: everything except the generated fields. */
export const StoryInput = Story.pick({ tags: true }).extend({
  title: z.string().trim().min(1).max(STORY_LIMITS.title),
  situation: z.string().max(STORY_LIMITS.part),
  task: z.string().max(STORY_LIMITS.part),
  action: z.string().max(STORY_LIMITS.part),
  result: z.string().max(STORY_LIMITS.part),
})
export type StoryInput = z.infer<typeof StoryInput>

/** Suggested tags shown in the editor; users can type any other. */
export const SUGGESTED_TAGS = [
  'conflict',
  'leadership',
  'failure',
  'ownership',
  'teamwork',
  'impact',
  'ambiguity',
  'deadline',
  'mentoring',
  'technical',
] as const

export function normalizeTag(tag: string): string {
  return tag.trim().toLowerCase().replace(/\s+/g, '-')
}
