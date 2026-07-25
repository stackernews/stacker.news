import { createContext, useContext } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/cn'
import styles from '@/styles/nav.module.css'

const NavContext = createContext(undefined)

/**
 * nav-link paint without the markup, the globals recipe re-homed in
 * styles/nav.module.css; for the raw-string color consumers (footer links,
 * cancel buttons, comment navigator) and Nav.Link itself
 * @param {boolean} active - active paint (navLinkActive color + bold)
 * @param {string} className - extra class name(s)
 */
export const navLinkClasses = ({ active, className } = {}) =>
  cn(styles.link, active && cn(styles.active, 'font-bold'), className)

/**
 * SN Nav, no Base UI primitive: the old Nav's entire live surface was
 * activeKey and eventKey matching, so this is a context plus class recipes.
 * Metrics ride utilities at call sites; bar height and width stay on
 * header.module.css .navbarNav
 * @param {string} activeKey - the eventKey of the currently-active link
 */
export default function Nav ({ activeKey, className, children }) {
  return (
    <NavContext.Provider value={activeKey}>
      <div className={className}>{children}</div>
    </NavContext.Provider>
  )
}

/* href renders next/link; otherwise a real <button>, where the old href-less
   Nav.Links rendered keyboard-dead <a> tags. The button branch carries UA
   resets so the recipe inherits like the <a> did */
function NavLink ({ eventKey, href, className, children, ...props }) {
  const activeKey = useContext(NavContext)
  const active = eventKey !== undefined && activeKey === eventKey
  return href
    ? <Link href={href} className={navLinkClasses({ active, className })} {...props}>{children}</Link>
    : (
      <button
        type='button'
        className={navLinkClasses({ active, className: cn('bg-transparent p-0', className) })}
        {...props}
      >
        {children}
      </button>
      )
}

/* .nav-item was only ever font-weight: 500 in globals */
function NavItem ({ className, children, ...props }) {
  return <div className={cn('font-medium', className)} {...props}>{children}</div>
}

Nav.Link = NavLink
Nav.Item = NavItem
