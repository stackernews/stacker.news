import { cn } from '@/lib/cn'
import styles from './field.module.css'

export function InputAddon ({ className, children, ...props }) {
  return (
    <span className={cn(styles.addon, 'flex items-center px-4 py-1.5 text-base max-md:text-[1rem]', className)} {...props}>
      {children}
    </span>
  )
}
