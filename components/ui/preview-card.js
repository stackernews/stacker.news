import { PreviewCard as BasePreviewCard } from '@base-ui/react/preview-card'
import { popoverClasses } from './popover'
import styles from './popover.module.css'
import arrowStyles from './arrow.module.css'

// Domain-specific user, item, and territory previews compose this popup.
export default function PreviewCard ({ trigger, body, onShow }) {
  return (
    <BasePreviewCard.Root>
      {/* Prefetch when intent begins rather than after the opening delay. */}
      <BasePreviewCard.Trigger delay={500} render={<span onPointerEnter={onShow} onFocus={onShow}>{trigger}</span>} />
      <BasePreviewCard.Portal>
        <BasePreviewCard.Positioner side='bottom' sideOffset={8} className={styles.positioner}>
          <BasePreviewCard.Popup className={popoverClasses({ className: 'py-2 px-4' })}>
            <BasePreviewCard.Arrow className={arrowStyles.arrow} />
            {body}
          </BasePreviewCard.Popup>
        </BasePreviewCard.Positioner>
      </BasePreviewCard.Portal>
    </BasePreviewCard.Root>
  )
}
