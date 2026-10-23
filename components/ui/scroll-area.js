import { ScrollArea as BaseScrollArea } from '@base-ui/react/scroll-area'
import { cn } from '@/lib/cn'
import styles from './scroll-area.module.css'

// a scrollable box with a thin scrollbar
// className goes on the box, the other props on the viewport
// fade dims the bottom edge when there's more to scroll
export function ScrollArea ({ fade, className, children, ...props }) {
  return (
    <BaseScrollArea.Root className={cn('flex flex-col min-h-0', className)}>
      <BaseScrollArea.Viewport className={cn(fade && styles.fade, 'overscroll-contain')} {...props}>
        {children}
      </BaseScrollArea.Viewport>
      <BaseScrollArea.Scrollbar className={cn(styles.scrollbar, 'w-1 m-1')}>
        <BaseScrollArea.Thumb className={cn(styles.thumb, 'rounded-full')} />
      </BaseScrollArea.Scrollbar>
    </BaseScrollArea.Root>
  )
}
