import { Menu as BaseMenu } from '@base-ui/react/menu'
import { createContext, useContext } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/cn'
import styles from './menu.module.css'

const InMenuContext = createContext(false)

// popup chrome; exported for the mentions listbox (D4, §14.5) and later C9a's suggest listbox (D3)
export const menuClasses = ({ className } = {}) =>
  cn(styles.popup, 'min-w-40 py-2 text-base rounded-md shadow-lg', className)

// item paint incl. hover/[data-highlighted] brighten + .active brand glow;
// exported for the same two listboxes (they pass active from their own selection state)
export const itemClasses = ({ active, className } = {}) =>
  cn(styles.item, active && styles.active, 'block w-full py-2 px-6 font-medium whitespace-nowrap', className)

/** SN Menu — Base UI Menu at rb-Dropdown ergonomics. modal={false} is baked:
 *  Menu.Root is the popup primitive that DOES scroll-lock by default (§14.2) */
function Root ({ className, children, ...props }) {
  return (
    <span className={className}>
      <BaseMenu.Root modal={false} {...props}>{children}</BaseMenu.Root>
    </span>
  )
}

function Popup ({ side = 'bottom', align = 'start', sideOffset = 2, className, children }) {
  return (
    <BaseMenu.Portal>
      <BaseMenu.Positioner side={side} align={align} sideOffset={sideOffset} className={styles.positioner}>
        <BaseMenu.Popup className={menuClasses({ className })}>
          <InMenuContext.Provider value>{children}</InMenuContext.Provider>
        </BaseMenu.Popup>
      </BaseMenu.Positioner>
    </BaseMenu.Portal>
  )
}

/** dual-mode Item — inside Menu.Popup → Base UI Item/LinkItem; outside (the offcanvas
 *  drawer nav, §14.1) → plain styled element. href ⇒ link mode: next/link, or plain <a>
 *  when target is passed (carousel's external view-original). closeOnClick baked on
 *  links (rb parity — LinkItem defaults false, §14.2). Extra props spread so Delete's
 *  cloneElement-injected onClick and dont-link-this's As={Menu.Item} keep working */
function Item ({ href, target, rel, active, className, children, ...props }) {
  const inMenu = useContext(InMenuContext)
  const cls = itemClasses({ active, className })
  if (!inMenu) {
    return href
      ? <Link href={href} target={target} rel={rel} className={cls} {...props}>{children}</Link>
      : <div className={cls} {...props}>{children}</div>
  }
  if (href) {
    const link = target ? <a href={href} target={target} rel={rel} /> : <Link href={href} />
    return <BaseMenu.LinkItem closeOnClick render={link} className={cls} {...props}>{children}</BaseMenu.LinkItem>
  }
  return <BaseMenu.Item className={cls} {...props}>{children}</BaseMenu.Item>
}

function Separator ({ className }) {
  const inMenu = useContext(InMenuContext)
  const cls = cn(styles.divider, 'my-2', className)
  // div in both modes — a plain <hr> would inherit reboot's opacity .25 outside the menu
  return inMenu ? <BaseMenu.Separator className={cls} /> : <div role='separator' className={cls} />
}

export default Object.assign(Root, { Trigger: BaseMenu.Trigger, Popup, Item, Separator })
