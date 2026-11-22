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

/** What the editor produces: everything except the generated fields. */
export const StoryInput = Story.pick({
  title: true,
  situation: true,
  task: true,
  action: true,
  result: true,
  tags: true,
}).extend({ title: z.string().trim().min(1) })
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
