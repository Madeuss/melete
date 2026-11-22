import type { HTMLAttributes } from 'react'
import { cn } from './cn'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** plain = page background with a 1px border; subtle = tinted panel, no border. */
  tone?: 'plain' | 'subtle'
  size?: 'card' | 'panel'
}

/** Cards never have a shadow: panels are separated by tone. */
export function Card({ tone = 'plain', size = 'card', className, ...rest }: CardProps) {
  return (
    <div
      className={cn(
        tone === 'plain' ? 'border border-border bg-bg' : 'bg-surface-subtle',
        size === 'card' ? 'rounded-card p-6' : 'rounded-panel p-8',
        className,
      )}
      {...rest}
    />
  )
}
