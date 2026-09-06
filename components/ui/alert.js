import { cn } from '@/lib/cn'
import { closeClasses } from './close'
import styles from './alert.module.css'

export function Alert ({ variant, dismissible, onClose, className, children, ...props }) {
  return (
    <div
      role='alert'
      className={cn(styles.alert, styles[variant], dismissible && styles.dismissible, className)}
      {...props}
    >
      {children}
      {dismissible &&
        <button type='button' className={closeClasses({ dim: true, className: 'absolute top-0 right-0 z-[2] py-5 px-4' })} onClick={onClose} aria-label='close'>X</button>}
    </div>
  )
}

export function AlertHeading ({ className, ...props }) {
  return <h4 className={cn('text-reset font-medium text-xl leading-tight mb-2', className)} {...props} />
}

export function AlertLink ({ className, ...props }) {
  return <a className={cn('font-bold text-reset', className)} {...props} />
}
