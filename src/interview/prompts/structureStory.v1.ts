import { z } from 'zod'
import type { ChatMessage } from '../../providers/llm/types'
import { STORY_LIMITS, SUGGESTED_TAGS, type UiLanguage } from '../../schemas'
import { UI_LANGUAGE_NAME, UNTRUSTED_NOTE, block } from './shared'

export interface StructureStoryInput {
  /** The story as the candidate told it, in any order and language. */
  narrative: string
  /** Answers to the questions asked in a previous round. */
  answers: Array<{ question: string; answer: string }>
  /** Language for the follow-up questions (the user's interface language). */
  uiLanguage: UiLanguage
}

export const StructureStoryOutput = z.object({
  title: z.string(),
  situation: z.string(),
  task: z.string(),
  action: z.string(),
  result: z.string(),
  tags: z.array(z.string()),
  /** What's missing or vague, as questions to the candidate, most important first. */
  missing: z.array(z.string()),
})
export type StructureStoryOutput = z.infer<typeof StructureStoryOutput>

const cut = (s: string, max: number) => (s.length > max ? s.slice(0, max).trimEnd() : s.trim())

export const structureStoryV1 = {
  id: 'structureStory',
  version: 'v1',
  name: 'structure_story',
  schema: StructureStoryOutput,

  build({ narrative, answers, uiLanguage }: StructureStoryInput): ChatMessage[] {
    const system = [
      'You help a job candidate turn a work story, told loosely, into the STAR format they will use in behavioral interviews.',
      '',
      'Fill in:',
      '- title: a short name for the story (at most 8 words).',
      '- situation: the context, in one or two sentences.',
      '- task: what the candidate was responsible for or asked to do.',
      '- action: what the candidate did, in the first person ("I…"), concrete steps.',
      '- result: how it ended, with the numbers the candidate gave.',
      `- tags: 1 to 3 that fit, only from this list: ${SUGGESTED_TAGS.join(', ')}.`,
      `- missing: up to 3 questions in ${UI_LANGUAGE_NAME[uiLanguage]} about what is missing or vague, most important first. ` +
        'Typical gaps: the candidate\'s exact role versus the team\'s, the concrete actions, a measurable result (a number, a before/after), what they learned. ' +
        'Do not ask about something already answered. Empty list if nothing important is missing.',
      '',
      'Rules:',
      '- Use only facts from the story and the answers. Never invent numbers, names, tools or outcomes.',
      '- When a part is missing, leave that field short or empty and ask about it in missing.',
      '- Write the fields in the same language the story was told in, in a natural spoken style, concise.',
      UNTRUSTED_NOTE,
    ].join('\n')

    const answered = answers
      .filter((a) => a.answer.trim())
      .map((a) => `Q: ${a.question}\nA: ${a.answer.trim()}`)
      .join('\n\n')

    return [
      { role: 'system', content: system },
      {
        role: 'user',
        content: [block('story', narrative), ...(answered ? [block('answers', answered)] : [])].join('\n\n'),
      },
    ]
  },

  /** Keeps the editor's limits and the known tags, and at most 3 questions. */
  postProcess(out: StructureStoryOutput): StructureStoryOutput {
    const known = new Set<string>(SUGGESTED_TAGS)
    return {
      title: cut(out.title, STORY_LIMITS.title),
      situation: cut(out.situation, STORY_LIMITS.part),
      task: cut(out.task, STORY_LIMITS.part),
      action: cut(out.action, STORY_LIMITS.part),
      result: cut(out.result, STORY_LIMITS.part),
      tags: [...new Set(out.tags.map((t) => t.trim().toLowerCase()).filter((t) => known.has(t)))].slice(0, 3),
      missing: out.missing.map((q) => q.trim()).filter(Boolean).slice(0, 3),
    }
  },
}
