import { PreviewCard as BasePreviewCard } from '@base-ui/react/preview-card'
import { popoverClasses } from './popover'
import styles from './popover.module.css'
import arrowStyles from './arrow.module.css'

export default function PreviewCard ({ trigger, body, onShow, side = 'bottom', triggerClassName }) {
  return (
    <BasePreviewCard.Root>
      {/* onShow prefetches before the open delay elapses */}
      <BasePreviewCard.Trigger delay={500} render={<span className={triggerClassName} onPointerEnter={onShow} onFocus={onShow}>{trigger}</span>} />
      <BasePreviewCard.Portal>
        <BasePreviewCard.Positioner side={side} sideOffset={8} className={styles.positioner}>
          <BasePreviewCard.Popup className={popoverClasses({ className: 'py-2 px-4' })}>
            <BasePreviewCard.Arrow className={arrowStyles.arrow} />
            {body}
          </BasePreviewCard.Popup>
        </BasePreviewCard.Positioner>
      </BasePreviewCard.Portal>
    </BasePreviewCard.Root>
  )
}
