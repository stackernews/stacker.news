import { PreviewCard as BasePreviewCard } from '@base-ui/react/preview-card'
import { cn } from '@/lib/cn'
import { popoverClasses } from './popover'
import styles from './popover.module.css'
import arrowStyles from './arrow.module.css'

export const PreviewCardRoot = BasePreviewCard.Root
export const createPreviewCardHandle = BasePreviewCard.createHandle

// onShow prefetches before the open delay elapses
export function PreviewCardTrigger ({ handle, payload, onShow, className, children }) {
  return <BasePreviewCard.Trigger handle={handle} payload={payload} delay={500} render={<span className={className} onPointerEnter={onShow} onFocus={onShow}>{children}</span>} />
}

export function PreviewCardContent ({ hoverable = true, className, children, ...props }) {
  return (
    <BasePreviewCard.Portal>
      <BasePreviewCard.Positioner
        sideOffset={8}
        {...props}
        className={cn(styles.positioner, !hoverable && 'pointer-events-none')}
      >
        <BasePreviewCard.Popup className={popoverClasses({ className: cn('py-2 px-4', className) })}>
          <BasePreviewCard.Arrow className={arrowStyles.arrow} />
          {children}
        </BasePreviewCard.Popup>
      </BasePreviewCard.Positioner>
    </BasePreviewCard.Portal>
  )
}

export default function PreviewCard ({ trigger, body, onShow }) {
  return (
    <PreviewCardRoot>
      <PreviewCardTrigger onShow={onShow}>{trigger}</PreviewCardTrigger>
      <PreviewCardContent>{body}</PreviewCardContent>
    </PreviewCardRoot>
  )
}
