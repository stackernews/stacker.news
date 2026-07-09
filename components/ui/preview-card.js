import { PreviewCard as BasePreviewCard } from '@base-ui/react/preview-card'
import { popoverClasses } from './popover'
import styles from './popover.module.css'
import arrowStyles from './arrow.module.css'

// hover or focus only link-preview popup, named for the Base UI primitive it
// wraps; the user, item and sub variants stay domain-side in
// components/*-preview-card.js
export default function PreviewCard ({ trigger, body, onShow }) {
  return (
    <BasePreviewCard.Root>
      {/* delay 500 matches the old show timeout (the Trigger default is 600),
          and closeDelay's default 300 already matches the old hide grace. The
          render span keeps the old wrapper since children contain Links. The
          onShow prefetch stays at hover-in, not onOpenChange(true), which
          fires 500ms later and would cost every first hover a full round trip */}
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
