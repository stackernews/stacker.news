import { Collapsible as BaseCollapsible } from '@base-ui/react/collapsible'
import { cn } from '@/lib/cn'
import styles from './collapsible.module.css'

/** SN Collapsible, a thin compound on Base UI Collapsible.
 *  Trigger renders a real <button> (keyboard and aria where the old accordion
 *  toggle was a keyboard-dead div) with the UA button resets baked in;
 *  Panel bakes the house motion: fade-in 150ms ease-out, snap close (no ending
 *  rule, so the close unmounts within a frame; layout height snaps both ways,
 *  like the old $enable-transitions: false paint) */
function Trigger ({ className, ...props }) {
  return <BaseCollapsible.Trigger className={cn(styles.trigger, className)} {...props} />
}

function Panel ({ className, ...props }) {
  return <BaseCollapsible.Panel className={cn(styles.panel, className)} {...props} />
}

export default Object.assign(BaseCollapsible.Root, { Trigger, Panel })
