import { Button as BaseButton } from '@base-ui/react/button'
import { cn } from '@/lib/cn'
import styles from './button.module.css'

// text-base is SN's body-size token, so no explicit line-height; sm and lg carry
// their native pairs. No border utility here: the module's 1px transparent border
// is load-bearing height, and a width utility would beat the outline color pins.
const BASE = 'inline-block text-center align-middle select-none cursor-pointer text-base rounded-md'

// metrics pair with the inputClasses sizes in form/field.js: both sides of an
// InputGroup must use the same size or the row misaligns
const SIZES = {
  sm: 'px-2 py-1 text-sm rounded-sm',
  md: 'px-4 py-1.5',
  lg: 'px-4 py-2 text-lg rounded-lg'
}

/**
 * generates the class names for a button based on the variant and size
 * @param {string} variant - The variant of the button
 * @param {string} size - The size of the button
 * @param {string} className - The extra class name(s) for the button
 * @returns {string} The class names for the button
 */
export function buttonClasses ({ variant = 'primary', size = 'md', className } = {}) {
  return cn(
    styles.btn,
    styles[variant],
    BASE,
    // the compiled .btn-link is weight 400; every other variant is bold
    variant === 'link' ? 'font-normal' : 'font-bold',
    SIZES[size],
    className
  )
}

/**
 * SN Button component, always a real <button>; link-shaped buttons use
 * a Link or <a> with buttonClasses() instead
 * @param {string} variant - The variant of the button
 * @param {string} size - The size of the button
 * @param {string} type - The type of the button
 * @param {string} className - The extra class name for the button
 * @param {boolean} focusableWhenDisabled - Whether the button should be focusable when disabled, useful for buttons with loading states
 * @param {Object} props - The props for the button
 */
export default function Button ({ variant = 'primary', size = 'md', type = 'button', className, ...props }) {
  return (
    <BaseButton
      type={type}
      className={buttonClasses({ variant, size, className })}
      {...props}
    />
  )
}
