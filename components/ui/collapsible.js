import { Collapsible as BaseCollapsible } from '@base-ui/react/collapsible'
import { cn } from '@/lib/cn'
import styles from './collapsible.module.css'

// Trigger provides button semantics and Panel owns the shared opening motion.
function Trigger ({ className, ...props }) {
  return <BaseCollapsible.Trigger className={cn(styles.trigger, className)} {...props} />
}

function Panel ({ className, ...props }) {
  return <BaseCollapsible.Panel className={cn(styles.panel, className)} {...props} />
}

export default Object.assign(BaseCollapsible.Root, { Trigger, Panel })
