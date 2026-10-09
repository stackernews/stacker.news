import { Menu as BaseMenu } from '@base-ui/react/menu'
import { createContext, useContext } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/cn'
import motionStyles from './popup-motion.module.css'
import styles from './menu.module.css'

const InMenuContext = createContext(false)

// also used by the mentions and suggest listboxes
export const menuClasses = ({ className } = {}) =>
  cn(styles.popup, motionStyles.motion, 'min-w-40 py-2 text-base rounded-md shadow-lg', className)

// the listboxes pass their own active state
export function itemClasses ({ active, variant, className } = {}) {
  const baseClasses = [styles.item, 'w-full']

  if (variant === 'compact') {
    return cn(
      baseClasses,
      styles.compact,
      active && styles.compactActive,
      'flex justify-between items-center gap-5 mb-0.5 p-1.5 whitespace-normal text-wrap',
      active ? 'text-base font-medium' : 'text-sm font-normal',
      className
    )
  }

  return cn(
    baseClasses,
    active && styles.active,
    'block py-1.5 px-6 font-medium whitespace-nowrap',
    className
  )
}

export function Menu ({ className, children, ...props }) {
  return (
    <span className={className}>
      <BaseMenu.Root modal={false} {...props}>{children}</BaseMenu.Root>
    </span>
  )
}

export function MenuPopup ({ side = 'bottom', align = 'start', sideOffset = 2, positionMethod = 'absolute', className, children, ...props }) {
  return (
    <BaseMenu.Portal>
      <BaseMenu.Positioner side={side} align={align} sideOffset={sideOffset} positionMethod={positionMethod} className={styles.positioner}>
        <BaseMenu.Popup className={menuClasses({ className })} {...props}>
          <InMenuContext.Provider value>{children}</InMenuContext.Provider>
        </BaseMenu.Popup>
      </BaseMenu.Positioner>
    </BaseMenu.Portal>
  )
}

// outside a MenuPopup (e.g. the mobile drawer) items are plain links and buttons
export function MenuItem ({ href, target, rel, active, variant, className, children, ...props }) {
  const inMenu = useContext(InMenuContext)
  const cls = itemClasses({ active, variant, className })
  if (!inMenu) {
    if (href) {
      return <Link href={href} target={target} rel={rel} aria-current={active ? 'page' : undefined} className={cls} {...props}>{children}</Link>
    }
    // without onClick stay a div so nested controls don't end up inside a button
    return props.onClick
      ? <button type='button' className={cn(cls, 'text-start')} {...props}>{children}</button>
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
  return inMenu ? <BaseMenu.Separator className={cls} /> : <div role='separator' className={cls} />
}

export function MenuItemText ({ className, ...props }) {
  return <span className={cn(styles.itemText, className)} {...props} />
}

export const MenuTrigger = BaseMenu.Trigger
