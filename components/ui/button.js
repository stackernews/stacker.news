import { Button as BaseButton } from '@base-ui/react/button'
import { cn } from '@/lib/cn'
import styles from './button.module.css'

// text-base is SN's body-size token (.93rem/1.75, styles/tailwind.css @theme),
// so no explicit line-height; sm/lg carry their native paired line-heights
const BASE = 'inline-block text-center align-middle select-none cursor-pointer border-0 text-base rounded-md'

// inputs must use the same md metrics (px-4 py-1.5) or InputGroups misalign
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
    // compiled .btn-link is weight 400; every other variant is bold ($btn-font-weight)
    variant === 'link' ? 'font-normal' : 'font-bold',
    SIZES[size],
    className
  )
}

/**
 * SN Button component
 * @param {string} variant - The variant of the button
 * @param {string} size - The size of the button
 * @param {string} as - The component to render the button as
 * @param {string} href - The href for the button (will render an <a> tag)
 * @param {string} type - The type of the button
 * @param {string} className - The extra class name for the button
 * @param {boolean} focusableWhenDisabled - Whether the button should be focusable when disabled, useful for buttons with loading states
 * @param {Object} props - The props for the button
 */
export default function Button ({ variant = 'primary', size = 'md', as: As, href, type = 'button', className, ...props }) {
  const render = As ? <As href={href} /> : href ? <a href={href} /> : undefined

  return (
    <BaseButton
      render={render}
      type={render ? undefined : type}
      className={buttonClasses({ variant, size, className })}
      {...props}
    />
  )
}
