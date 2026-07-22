import { cn } from '@/lib/cn'
import styles from './field.module.css'

function Text ({ className, children, ...props }) {
  return (
    <span className={cn(styles.addon, 'flex items-center px-4 py-1.5 text-base max-md:text-[1rem]', className)} {...props}>
      {children}
    </span>
  )
}

/** SN InputGroup — the group itself is InputInner-internal (census: zero consumers
 *  compose one); this export exists for the addon and API completeness. Corner
 *  flattening is the structural .inputGroup CSS (field.module.css) — members must
 *  not carry radius utilities; corner overrides are call-site (§11.0 bucket 3) */
function InputGroup ({ className, children }) {
  return (
    <div className={cn(styles.inputGroup, 'flex items-stretch', className)}>
      {children}
    </div>
  )
}

export default Object.assign(InputGroup, { Text })
