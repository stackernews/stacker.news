import { Children, Fragment, cloneElement, isValidElement } from 'react'
import { cn } from '@/lib/cn'
import styles from './field.module.css'

// flatten fragments so each addon is its own group member — rb parity:
// Bootstrap's sibling selectors saw through PasswordInput's addon fragment too
export function flattenAddons (children) {
  return Children.toArray(children).flatMap(child =>
    isValidElement(child) && child.type === Fragment
      ? flattenAddons(child.props.children)
      : [child])
}

// corner-joining (risk 7b): a module rule can't flatten the members' corners —
// their own radius rides layered-!important utilities (§11.0) — so the group
// injects position utilities; cn puts them last, so twMerge resolves in their favor
export function joinCorners (members) {
  const visible = members.filter(Boolean)
  if (visible.length < 2) return visible
  return visible.map((child, i) => {
    if (!isValidElement(child)) return child
    const corner = i === 0 ? 'rounded-e-none' : i === visible.length - 1 ? 'rounded-s-none' : 'rounded-none'
    return cloneElement(child, { key: child.key ?? i, className: cn(child.props.className, corner) })
  })
}

function Text ({ className, children, ...props }) {
  return (
    <span className={cn(styles.addon, 'flex items-center px-4 py-1.5 text-base max-md:text-[1rem]', className)} {...props}>
      {children}
    </span>
  )
}

/** SN InputGroup — the group itself is InputInner-internal (census: zero consumers
 *  compose one); this export exists for the addon and API completeness */
function InputGroup ({ className, children }) {
  return (
    <div className={cn('flex flex-wrap items-stretch', className)}>
      {joinCorners(flattenAddons(children))}
    </div>
  )
}

export default Object.assign(InputGroup, { Text })
