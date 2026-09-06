import { cn } from '@/lib/cn'
import styles from './close.module.css'

// the X that dismisses alerts, popovers, drawers, modals and toasts
export function closeClasses ({ dim = false, className } = {}) {
  return cn(styles.close, dim && styles.dim, 'text-[150%] leading-none', className)
}
