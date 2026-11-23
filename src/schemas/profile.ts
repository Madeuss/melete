import { z } from 'zod'

export const Experience = z.object({
  company: z.string(),
  title: z.string(),
  /** As written in the CV ("Mar 2021", "2019"); end empty = current job. */
  start: z.string(),
  end: z.string(),
  /** Achievements and responsibilities, one per item. */
  achievements: z.array(z.string()),
})
export type Experience = z.infer<typeof Experience>

/**
 * The candidate's CV, structured from the uploaded file and reviewed by them. One per browser.
 * The file itself is never kept: only this.
 */
export const Profile = z.object({
  id: z.literal('default'),
  updatedAt: z.string(),
  /** One line: current title and focus. */
  headline: z.string(),
  experiences: z.array(Experience),
  skills: z.array(z.string()),
  /** "Degree, Institution, 2015–2019", one per item. */
  education: z.array(z.string()),
  /** "English, advanced", one per item. */
  languages: z.array(z.string()),
})
export type Profile = z.infer<typeof Profile>

export type ProfileInput = Omit<Profile, 'id' | 'updatedAt'>
