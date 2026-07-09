import { PreviewCard as BasePreviewCard } from '@base-ui/react/preview-card'
import { popoverClasses } from './popover'
import styles from './popover.module.css'
import arrowStyles from './arrow.module.css'

// hover/focus-only link-preview popup, named for the Base UI primitive it
// wraps (pr2 doc §13.0 rename); the user/item/sub variants stay domain-side
// in components/*-preview-card.js
export default function PreviewCard ({ trigger, body, onShow }) {
  return (
    <BasePreviewCard.Root>
      {/* delay 500 = today's show timeout (Trigger default is 600); closeDelay's
          default 300 = today's hide grace exactly — omitted. Trigger renders <a>
          by default; render keeps today's span wrapper (children contain Links).
          onShow prefetch stays at hover-in, NOT onOpenChange(true) — that fires
          500ms later and would cost every first hover a skeleton-length RTT */}
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
