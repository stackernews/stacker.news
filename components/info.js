import React from 'react'
import InfoIcon from '@/svgs/information-fill.svg'
import { useShowModal } from './modal'

export default function Info ({ children, label, iconClassName = 'fill-theme-color' }) {
  const showModal = useShowModal()

  return (
    <div
      onClick={(e) => {
        e.preventDefault()
        showModal(onClose => children)
      }}
      className='d-flex align-items-center pointer'
    >
      <InfoIcon
        width={18} height={18} className={`${iconClassName} mx-1`}
      />
      {label && <small className='text-muted'>{label}</small>}
    </div>
  )
}
