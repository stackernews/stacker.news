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

/** SN Menu, Base UI Menu at the old Dropdown ergonomics. modal={false} is
 *  baked because Menu.Root is the one popup primitive that scroll-locks by default */
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

/** dual-mode Item: inside Menu.Popup it renders a Base UI Item or LinkItem,
 *  outside (the drawer nav) a plain styled element. href means link mode,
 *  next/link or a plain <a> when target is passed. closeOnClick is baked on
 *  links since LinkItem defaults it off. Extra props spread so Delete's
 *  injected onClick and dont-link-this's As={Menu.Item} keep working */
function Item ({ href, target, rel, active, className, children, ...props }) {
  const inMenu = useContext(InMenuContext)
  const cls = itemClasses({ active, className })
  if (!inMenu) {
    if (href) {
      return <Link href={href} target={target} rel={rel} className={cls} {...props}>{children}</Link>
    }
    // interactive plain-mode items are real <button>s, a clickable div is
    // keyboard-dead; passive wrappers nesting their own Buttons stay divs
    // so we don't nest interactive elements
    return props.onClick
      ? <button type='button' className={cn(cls, 'bg-transparent border-0 text-start pointer')} {...props}>{children}</button>
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
  // div in both modes, a plain <hr> would inherit reboot's opacity .25 outside the menu
  return inMenu ? <BaseMenu.Separator className={cls} /> : <div role='separator' className={cls} />
}

export default Object.assign(Root, { Trigger: BaseMenu.Trigger, Popup, Item, Separator })
