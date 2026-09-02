import { createContext, useContext } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/cn'
import styles from '@/styles/nav.module.css'

const NavContext = createContext(undefined)

// also used by the footer links and the comment navigator
export const navLinkClasses = ({ active, className } = {}) =>
  cn(styles.link, active && cn(styles.active, 'font-bold'), className)

export function Nav ({ activeKey, className, children }) {
  return (
    <NavContext.Provider value={activeKey}>
      <div className={className}>{children}</div>
    </NavContext.Provider>
  )
}

export function NavLink ({ eventKey, href, className, children, ...props }) {
  const activeKey = useContext(NavContext)
  const active = eventKey !== undefined && activeKey === eventKey
  return href
    ? <Link href={href} aria-current={active ? 'page' : undefined} className={navLinkClasses({ active, className })} {...props}>{children}</Link>
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

export function NavItem ({ className, children, ...props }) {
  return <div className={cn('font-medium', className)} {...props}>{children}</div>
}
