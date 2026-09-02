import { cn } from '@/lib/cn'
import styles from './field.module.css'

// keep in sync with the Button sizes or input groups misalign
const SIZES = {
  sm: 'px-2 py-1 text-sm',
  md: 'px-4 py-1.5 text-base'
}

export const inputClasses = ({ valid, size = 'md', className } = {}) =>
  cn(styles.control, valid && styles.valid, 'block w-full max-md:text-touch', SIZES[size], className)

export const labelClasses = ({ className } = {}) =>
  cn(styles.label, 'mb-2 inline-block', className)

export const hintClasses = ({ className } = {}) =>
  cn(styles.hint, className)

export const errorClasses = ({ className } = {}) =>
  cn(styles.error, className)

export function FormGroup ({ className, label, labelId, htmlFor, children }) {
  return (
    <div className={cn(styles.group, className)}>
      {label && <label id={labelId} htmlFor={htmlFor} className={labelClasses()}>{label}</label>}
      {children}
    </div>
  )
}
