import { Collapsible as BaseCollapsible } from '@base-ui/react/collapsible'
import { cn } from '@/lib/cn'
import styles from './collapsible.module.css'

export function CollapsibleTrigger ({ className, ...props }) {
  return <BaseCollapsible.Trigger className={cn(styles.trigger, className)} {...props} />
}

export function CollapsiblePanel ({ className, ...props }) {
  return <BaseCollapsible.Panel className={cn(styles.panel, className)} {...props} />
}

export const Collapsible = BaseCollapsible.Root
