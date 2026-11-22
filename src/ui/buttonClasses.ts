import { cn } from './cn'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'md' | 'sm'

const base =
  'inline-flex items-center justify-center gap-2 rounded-pill font-medium whitespace-nowrap select-none ' +
  'transition-colors duration-150 ease-out disabled:pointer-events-none disabled:opacity-50'

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-brand-strong text-on-brand hover:bg-brand-hover active:bg-brand-hover',
  secondary: 'bg-surface-sunken text-text hover:bg-border',
  ghost: 'bg-transparent text-text-muted hover:bg-surface-sunken hover:text-text',
  // Destructive actions are outlined, never filled (the brand is pink; a red fill would compete).
  danger: 'border border-danger bg-transparent text-danger hover:bg-surface-sunken',
}

const sizes: Record<ButtonSize, string> = {
  md: 'h-11 px-5 text-base',
  sm: 'h-9 px-4 text-sm',
}

/** Class string for things that look like buttons but aren't (router links). */
export function buttonClasses(variant: ButtonVariant = 'secondary', size: ButtonSize = 'md', extra?: string) {
  return cn(base, variants[variant], sizes[size], extra)
}
