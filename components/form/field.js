import { cn } from '@/lib/cn'
import styles from './field.module.css'

// class builders for standalone sites (buttonClasses precedent, §18.3-b):
// the §4b raw-string swaps and formik-less controls consume these

export const inputClasses = ({ valid, className } = {}) =>
  cn(styles.control, valid && styles.valid, 'block w-full px-4 py-1.5 text-base max-md:text-[1rem]', className)

export const labelClasses = ({ className } = {}) =>
  cn(styles.label, 'mb-2 inline-block', className)

// render hints as <small> for parity — rb Form.Text was <small class='form-text'>
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
