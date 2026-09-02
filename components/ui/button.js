import { Button as BaseButton } from '@base-ui/react/button'
import { cn } from '@/lib/cn'
import styles from './button.module.css'

// border stays in the module so every variant has the same height
const BASE = 'inline-block text-center align-middle select-none cursor-pointer text-base rounded-md'

// keep in sync with the inputClasses sizes in form/field.js or input groups misalign
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
    variant === 'link' ? 'font-normal' : 'font-bold',
    SIZES[size],
    className
  )
}

// for links styled as buttons, use buttonClasses() on the <a>
export default function Button ({ variant = 'primary', size = 'md', type = 'button', className, ...props }) {
  return (
    <BaseButton
      type={type}
      className={buttonClasses({ variant, size, className })}
      {...props}
    />
  )
}
