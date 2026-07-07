import { cn } from '@/lib/cn'
import styles from './badge.module.css'

// text-xs carries a paired line-height token; leading-none beats it in compiled output order
const BASE = 'inline-block px-2 py-0.5 text-xs font-bold leading-none text-center whitespace-nowrap rounded-md'

/**
 * generates the class names for a badge based on the variant
 * @param {string} variant - The variant of the badge (omit for a skin-only badge)
 * @param {string} className - The extra class name(s) for the badge
 * @returns {string} The class names for the badge
 */
export function badgeClasses ({ variant, className } = {}) {
  return cn(styles.badge, variant && styles[variant], BASE, className)
}

/**
 * SN Badge component
 * @param {string} variant - The variant of the badge
 * @param {string} className - The extra class name for the badge
 */
export default function Badge ({ variant, className, ...props }) {
  return <span className={badgeClasses({ variant, className })} {...props} />
}
