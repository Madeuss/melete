import { cn } from './cn'

/** Wordmark only: "melete" in lowercase, Figtree 600. Brand name, never translated. */
export function Logo({ className }: { className?: string }) {
  return <span className={cn('text-lg font-semibold tracking-[-0.01em] text-text', className)}>melete</span>
}
