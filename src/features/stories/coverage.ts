import { SUGGESTED_TAGS, type Story } from '../../schemas'

/** The competencies the map checks: the suggested tags, which interviewers ask about most. */
export const COMPETENCIES = SUGGESTED_TAGS

export type Competency = (typeof COMPETENCIES)[number]

export interface Coverage {
  /** How many stories cover each competency, in COMPETENCIES order. */
  counts: Array<{ competency: Competency; count: number }>
  /** Competencies no story covers yet: what to prepare next. */
  missing: Competency[]
  /** Each story with the competencies it covers. */
  rows: Array<{ story: Story; covers: Set<Competency> }>
}

/** Stories × competencies. Custom tags (outside the list) don't count towards coverage. */
export function coverage(stories: Story[]): Coverage {
  const rows = stories.map((story) => ({
    story,
    covers: new Set(COMPETENCIES.filter((c) => story.tags.includes(c))),
  }))
  const counts = COMPETENCIES.map((competency) => ({
    competency,
    count: rows.filter((r) => r.covers.has(competency)).length,
  }))
  return { counts, missing: counts.filter((c) => c.count === 0).map((c) => c.competency), rows }
}
