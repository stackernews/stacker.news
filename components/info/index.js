import React from 'react'
import InfoIcon from '@/svgs/information-fill.svg'
import { useShowModal } from '../modal'
import { cn } from '@/lib/cn'

// The icon follows the surrounding text color; iconClassName adds to that.
export default function Info ({ children, size = 18, label, iconClassName }) {
  const showModal = useShowModal()

  return (
    <div
      onClick={(e) => {
        e.preventDefault()
        showModal(onClose => children)
      }}
      className='pointer flex items-center'
    >
      <InfoIcon
        width={size} height={size} className={cn('fill-current mx-1', iconClassName)}
      />
      {label && <small className='text-muted'>{label}</small>}
    </div>
  )
}
