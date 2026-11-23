import { z } from 'zod'
import type { ChatMessage } from '../../providers/llm/types'
import type { Profile, UiLanguage } from '../../schemas'
import { UI_LANGUAGE_NAME, UNTRUSTED_NOTE, block, profileText } from './shared'

export interface CompareProfileJobInput {
  profile: Profile
  jobDescription: string
  feedbackLanguage: UiLanguage
}

export const JobRequirement = z.object({
  requirement: z.string(),
  /** strong: the CV clearly shows it; weak: related but indirect; none: nothing in the CV. */
  evidence: z.enum(['strong', 'weak', 'none']),
  /** For weak or none: how to answer if asked about it, without making things up. */
  tip: z.string(),
})
export type JobRequirement = z.infer<typeof JobRequirement>

export const CompareProfileJobOutput = z.object({ requirements: z.array(JobRequirement) })

const ORDER = { none: 0, weak: 1, strong: 2 } as const

export const compareProfileJobV1 = {
  id: 'compareProfileJob',
  version: 'v1',
  name: 'compare_profile_job',
  schema: CompareProfileJobOutput,

  build({ profile, jobDescription, feedbackLanguage }: CompareProfileJobInput): ChatMessage[] {
    const system = [
      "You compare a candidate's CV with a job description to prepare them for the interview.",
      'List the main requirements of the job (at most 10, the ones an interviewer would ask about), and for each one say how well the CV shows it:',
      '- strong: the CV clearly shows it (name where, briefly, in the tip);',
      '- weak: something related but indirect;',
      '- none: nothing in the CV.',
      'For weak and none, tip says how to answer honestly if asked: what related experience to bring, how to frame it, or how to show they are learning it. Never suggest claiming experience the CV does not show.',
      `Write requirement and tip in ${UI_LANGUAGE_NAME[feedbackLanguage]}, short.`,
      UNTRUSTED_NOTE,
    ].join('\n')
    return [
      { role: 'system', content: system },
      { role: 'user', content: [block('cv', profileText(profile)), block('job_description', jobDescription)].join('\n\n') },
    ]
  },

  /** Gaps first (none, then weak, then strong), at most 10. */
  postProcess(out: z.infer<typeof CompareProfileJobOutput>): JobRequirement[] {
    return out.requirements
      .filter((r) => r.requirement.trim())
      .sort((a, b) => ORDER[a.evidence] - ORDER[b.evidence])
      .slice(0, 10)
  },
}
