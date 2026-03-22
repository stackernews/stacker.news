import { forwardRef } from 'react'
import { useIsClient } from '@/components/use-client'
import { createPortal } from 'react-dom'

export const MenuAlternateDimension = forwardRef(function MenuAlternateDimension ({ children, style, className }, ref) {
  // document doesn't exist on SSR
  const isClient = useIsClient()
  if (!isClient) return null

  return createPortal(
    <div ref={ref} style={style} className={className}>
      {children}
    </div>,
    document.body
  )
})
