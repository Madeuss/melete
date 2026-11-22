import { ChevronDown } from 'lucide-react'
import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { cn } from './cn'
import { iconPropsSm } from './icon'

const field =
  'w-full bg-surface-sunken text-text border border-border placeholder:text-text-subtle ' +
  'transition-colors duration-150 ease-out hover:border-border-strong ' +
  'disabled:opacity-50 aria-invalid:border-danger'

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  size?: 'md' | 'sm'
}

export function Input({ className, size = 'md', ...rest }: InputProps) {
  return (
    <input
      className={cn(field, 'rounded-pill', size === 'md' ? 'h-11 px-5 text-base' : 'h-9 px-4 text-sm', className)}
      {...rest}
    />
  )
}

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Reading size (18px / 1.6) for transcripts. */
  reading?: boolean
}

export function Textarea({ className, reading = false, rows = 4, ...rest }: TextareaProps) {
  return (
    <textarea
      rows={rows}
      className={cn(field, 'resize-y rounded-field px-5 py-3', reading ? 'text-reading' : 'text-base', className)}
      {...rest}
    />
  )
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className={cn('relative', className)}>
      <select className={cn(field, 'h-11 appearance-none rounded-pill pl-5 pr-11 text-base')} {...rest}>
        {children}
      </select>
      <ChevronDown
        {...iconPropsSm}
        className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-text-muted"
      />
    </div>
  )
}
