import { Menu as BaseMenu } from '@base-ui/react/menu'
import { createContext, useContext, useEffect, useMemo, useRef } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/cn'
import styles from './menu.module.css'

const InMenuContext = createContext(false)
const MenuContext = createContext({ visible: true })

export function MenuProvider ({ container, visible = true, children }) {
  const value = useMemo(() => ({ container, visible }), [container, visible])
  return <MenuContext.Provider value={value}>{children}</MenuContext.Provider>
}

// also used by the mentions and suggest listboxes
export const menuClasses = ({ className } = {}) =>
  cn(styles.popup, 'min-w-40 py-2 text-base rounded-md shadow-lg', className)

// the listboxes pass their own active state
export const itemClasses = ({ active, className } = {}) =>
  cn(styles.item, active && styles.active, 'block w-full py-1.5 px-6 font-medium whitespace-nowrap', className)

export function Menu ({ className, children, actionsRef: actionsRefProp, ...props }) {
  const { visible } = useContext(MenuContext)
  const localActionsRef = useRef(null)
  const actionsRef = actionsRefProp ?? localActionsRef

  // close menus when the other navbar takes over
  useEffect(() => {
    if (!visible) actionsRef.current?.close()
  }, [visible, actionsRef])

  return (
    <span className={className}>
      <BaseMenu.Root modal={false} actionsRef={actionsRef} {...props}>{children}</BaseMenu.Root>
    </span>
  )
}

export function MenuPopup ({ side = 'bottom', align = 'start', sideOffset = 2, className, children, finalFocus, ...props }) {
  const { container, visible } = useContext(MenuContext)
  return (
    <BaseMenu.Portal container={container}>
      <BaseMenu.Positioner side={side} align={align} sideOffset={sideOffset} className={styles.positioner}>
        {/* don't return focus to a hidden or offscreen navbar */}
        <BaseMenu.Popup className={menuClasses({ className })} finalFocus={visible ? finalFocus : false} {...props}>
          <InMenuContext.Provider value>{children}</InMenuContext.Provider>
        </BaseMenu.Popup>
      </BaseMenu.Positioner>
    </BaseMenu.Portal>
  )
}

// outside a MenuPopup (e.g. the mobile drawer) items are plain links and buttons
export function MenuItem ({ href, target, rel, active, className, children, ...props }) {
  const inMenu = useContext(InMenuContext)
  const cls = itemClasses({ active, className })
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

export const MenuTrigger = BaseMenu.Trigger
