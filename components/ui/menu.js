import { Menu as BaseMenu } from '@base-ui/react/menu'
import { createContext, useContext } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/cn'
import styles from './menu.module.css'

const InMenuContext = createContext(false)

// popup chrome; also exported for the mentions and suggest listboxes
export const menuClasses = ({ className } = {}) =>
  cn(styles.popup, 'min-w-40 py-2 text-base rounded-md shadow-lg', className)

// item paint including the hover and keyboard highlight and the active brand
// glow; exported for the same two listboxes, which pass their own active state
export const itemClasses = ({ active, className } = {}) =>
  cn(styles.item, active && styles.active, 'block w-full py-1.5 px-6 font-medium whitespace-nowrap', className)

// Menus do not lock page scroll.
export function Menu ({ className, children, ...props }) {
  return (
    <span className={className}>
      <BaseMenu.Root modal={false} {...props}>{children}</BaseMenu.Root>
    </span>
  )
}

export function MenuPopup ({ side = 'bottom', align = 'start', sideOffset = 2, className, children }) {
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

// Items use Base UI semantics inside a popup and plain navigation semantics in
// drawers. External targets use an anchor; internal routes use Next Link.
export function MenuItem ({ href, target, rel, active, className, children, ...props }) {
  const inMenu = useContext(InMenuContext)
  const cls = itemClasses({ active, className })
  if (!inMenu) {
    if (href) {
      return <Link href={href} target={target} rel={rel} aria-current={active ? 'page' : undefined} className={cls} {...props}>{children}</Link>
    }
    // Passive wrappers stay divs so nested controls do not become interactive
    // elements inside a button.
    return props.onClick
      ? <button type='button' className={cn(cls, 'bg-transparent border-0 text-start pointer')} {...props}>{children}</button>
      : <div className={cls} {...props}>{children}</div>
  }
  if (href) {
    const link = target ? <a href={href} target={target} rel={rel} /> : <Link href={href} />
    return <BaseMenu.LinkItem closeOnClick render={link} aria-current={active ? 'page' : undefined} className={cls} {...props}>{children}</BaseMenu.LinkItem>
  }
  return <BaseMenu.Item className={cls} {...props}>{children}</BaseMenu.Item>
}

export function MenuSeparator ({ className }) {
  const inMenu = useContext(InMenuContext)
  const cls = cn(styles.divider, 'my-2', className)
  // A div keeps separators visually consistent inside and outside popups.
  return inMenu ? <BaseMenu.Separator className={cls} /> : <div role='separator' className={cls} />
}

export const MenuTrigger = BaseMenu.Trigger
