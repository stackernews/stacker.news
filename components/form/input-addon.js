import { cn } from '@/lib/cn'
import styles from './field.module.css'

export function InputAddon ({ className, children, onClick, ...props }) {
  const Component = onClick ? 'button' : 'span'
  return (
    <Component
      type={onClick ? 'button' : undefined}
      className={cn(styles.addon, 'flex items-center px-4 py-1.5 text-base max-md:text-[1rem]', onClick && 'cursor-pointer', className)}
      onClick={onClick}
      {...props}
    >
      {children}
    </Component>
  )
}
