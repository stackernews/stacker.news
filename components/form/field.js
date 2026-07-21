import { cn } from '@/lib/cn'
import styles from './field.module.css'

// class builders for standalone sites: raw class-string consumers and
// formik-less controls use these

// metrics pair with the ui Button sizes in button.js: both sides of an
// InputGroup must use the same size or the row misaligns. max-md:text-[1rem]
// is the shared iOS no-zoom leg; it rode .form-control before, so sm gets it too
const SIZES = {
  sm: 'px-2 py-1 text-sm',
  md: 'px-4 py-1.5 text-base'
}

export const inputClasses = ({ valid, size = 'md', className } = {}) =>
  cn(styles.control, valid && styles.valid, 'block w-full max-md:text-[1rem]', SIZES[size], className)

export const labelClasses = ({ className } = {}) =>
  cn(styles.label, 'mb-2 inline-block', className)

// hints render as <small> like the old Form.Text did
export const hintClasses = ({ className } = {}) =>
  cn(styles.hint, className)

export const errorClasses = ({ className } = {}) =>
  cn(styles.error, className)

export function FormGroup ({ className, label, children }) {
  return (
    <div className={cn(styles.group, className)}>
      {label && <label className={labelClasses()}>{label}</label>}
      {children}
    </div>
  )
}
