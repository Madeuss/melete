import { z } from 'zod'
import type { ChatMessage } from '../../providers/llm/types'
import { Experience, type ProfileInput } from '../../schemas'
import { UNTRUSTED_NOTE, block } from './shared'

export interface StructureProfileInput {
  /** Text extracted from the CV file (or pasted). */
  cvText: string
}

/** Long CVs are cut: the structure is in the first pages anyway. */
export const CV_TEXT_MAX = 24_000

export const StructureProfileOutput = z.object({
  headline: z.string(),
  experiences: z.array(Experience),
  skills: z.array(z.string()),
  education: z.array(z.string()),
  languages: z.array(z.string()),
})

export const structureProfileV1 = {
  id: 'structureProfile',
  version: 'v1',
  name: 'structure_profile',
  schema: StructureProfileOutput,

  build({ cvText }: StructureProfileInput): ChatMessage[] {
    const system = [
      'You turn the text of a CV (extracted from a PDF or Word file, so the layout may be messy) into a structured profile.',
      '',
      '- headline: one line with the current title and focus, from the CV.',
      '- experiences: each job, most recent first. company, title, start and end as written in the CV (end empty if it is the current job), ' +
        'and achievements: the bullet points, one per item, kept close to the original wording.',
      '- skills: tools, technologies and skills listed in the CV, one per item.',
      '- education: one item per degree, like "Degree, Institution, years".',
      '- languages: one item per language, like "English, advanced".',
      '',
      'Use only what the CV says. Never invent or embellish. Keep the CV language. Leave a list empty if the CV has nothing for it.',
      UNTRUSTED_NOTE,
    ].join('\n')
    return [
      { role: 'system', content: system },
      { role: 'user', content: block('cv', cvText.slice(0, CV_TEXT_MAX)) },
    ]
  },

  /** Trims everything and drops empty items. */
  postProcess(out: z.infer<typeof StructureProfileOutput>): ProfileInput {
    const list = (xs: string[]) => xs.map((x) => x.trim()).filter(Boolean)
    return {
      headline: out.headline.trim(),
      experiences: out.experiences
        .map((e) => ({
          company: e.company.trim(),
          title: e.title.trim(),
          start: e.start.trim(),
          end: e.end.trim(),
          achievements: list(e.achievements),
        }))
        .filter((e) => e.company || e.title),
      skills: list(out.skills),
      education: list(out.education),
      languages: list(out.languages),
    }
  },
}
