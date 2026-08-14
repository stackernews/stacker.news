import { Button as BaseButton } from '@base-ui/react/button'
import { cn } from '@/lib/cn'
import styles from './button.module.css'

// text-base carries the body line-height. Border width and color stay in the
// module so every variant keeps the same control height.
const BASE = 'inline-block text-center align-middle select-none cursor-pointer text-base rounded-md'

// metrics pair with the inputClasses sizes in form/field.js: both sides of an
// InputGroup must use the same size or the row misaligns
const SIZES = {
  sm: 'px-2 py-1 text-sm rounded-sm',
  md: 'px-4 py-1.5',
  lg: 'px-4 py-2 text-lg rounded-lg'
}

export function buttonClasses ({ variant = 'primary', size = 'md', className } = {}) {
  return cn(
    styles.btn,
    styles[variant],
    BASE,
    // Link buttons follow surrounding text; action buttons keep stronger weight.
    variant === 'link' ? 'font-normal' : 'font-bold',
    SIZES[size],
    className
  )
}

// Links that need button styling use buttonClasses() so this component always
// renders native button semantics.
export default function Button ({ variant = 'primary', size = 'md', type = 'button', className, ...props }) {
  return (
    <BaseButton
      type={type}
      className={buttonClasses({ variant, size, className })}
      {...props}
    />
  )
}
