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

export function PreviewCardContent ({ side = 'bottom', positionMethod, collisionBoundary, collisionAvoidance, hoverable = true, className, children }) {
  return (
    <BasePreviewCard.Portal>
      <BasePreviewCard.Positioner
        side={side}
        sideOffset={8}
        positionMethod={positionMethod}
        collisionBoundary={collisionBoundary}
        collisionAvoidance={collisionAvoidance}
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

export default function PreviewCard ({ trigger, body, onShow, side, triggerClassName }) {
  return (
    <PreviewCardRoot>
      <PreviewCardTrigger onShow={onShow} className={triggerClassName}>{trigger}</PreviewCardTrigger>
      <PreviewCardContent side={side}>{body}</PreviewCardContent>
    </PreviewCardRoot>
  )
}
