import { cn } from '@/lib/cn'
import styles from './alert.module.css'

/**
 * SN Alert component, drop-in for react-bootstrap's Alert
 * @param {string} variant - info | danger | warning
 * @param {boolean} dismissible - render an X close button
 * @param {function} onClose - called when the close button is clicked
 * @param {string} className - extra class name(s) for the alert
 */
export default function Alert ({ variant, dismissible, onClose, className, children, ...props }) {
  return (
    <div
      role='alert'
      className={cn(styles.alert, styles[variant], dismissible && styles.dismissible, className)}
      {...props}
    >
      {children}
      {dismissible &&
        <button type='button' className={styles.close} onClick={onClose} aria-label='Close alert'>X</button>}
    </div>
  )
}

function AlertHeading ({ className, ...props }) {
  return <div className={cn('text-reset font-medium text-xl leading-tight mb-2', className)} {...props} />
}

/* text-reset also beats globals' a:hover recolor, matching today: alert links keep the alert's text color */
function AlertLink ({ className, ...props }) {
  return <a className={cn('font-bold text-reset', className)} {...props} />
}

Alert.Heading = AlertHeading
Alert.Link = AlertLink
