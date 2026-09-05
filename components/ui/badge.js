import { cn } from '@/lib/cn'
import styles from './badge.module.css'

const BASE = 'inline-block align-middle ms-0.5 font-bold leading-none text-center whitespace-nowrap rounded-md'

export function badgeClasses ({ variant = 'grey', className } = {}) {
  return cn(styles.badge, variant && styles[variant], BASE, className)
}

export default function Badge ({ variant = 'grey', className, ...props }) {
  return <span className={badgeClasses({ variant, className })} {...props} />
}
