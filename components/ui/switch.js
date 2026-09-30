import { Switch as BaseSwitch } from '@base-ui/react/switch'
import { cn } from '@/lib/cn'
import styles from './switch.module.css'

export default function Switch ({ className, ...props }) {
  return (
    <BaseSwitch.Root className={cn(styles.track, className)} {...props}>
      <BaseSwitch.Thumb className={styles.thumb} />
    </BaseSwitch.Root>
  )
}
