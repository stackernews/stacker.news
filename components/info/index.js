import React from 'react'
import InfoIcon from '@/svgs/information-fill.svg'
import { useShowModal } from '../modal'

export default function Info ({ children, size = 18, label, iconClassName = 'fill-theme-color' }) {
  const showModal = useShowModal()

  return (
    <div
      onClick={(e) => {
        e.preventDefault()
        showModal(onClose => children)
      }}
      className='pointer d-flex align-items-center'
    >
      <InfoIcon
        width={size} height={size} className={`${iconClassName} mx-1`}
      />
      {label && <small className='text-muted'>{label}</small>}
    </div>
  )
}
