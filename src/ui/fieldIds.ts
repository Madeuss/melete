export const hintId = (id: string) => `${id}-hint`
export const errorId = (id: string) => `${id}-error`

/** aria-describedby value for a control wrapped in <Field>. */
export function describedBy(id: string, opts: { hint?: unknown; error?: unknown }) {
  if (opts.error) return errorId(id)
  if (opts.hint) return hintId(id)
  return undefined
}
