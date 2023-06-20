import { useState } from 'react'
import { Modal } from 'react-bootstrap'
import InfoIcon from '../svgs/information-fill.svg'

export default function Info ({ children, iconClassName = 'fill-theme-color' }) {
  const [info, setInfo] = useState()

  return (
    <>
      <Modal
        show={info}
        onHide={() => setInfo(false)}
      >
        <div className='modal-close' onClick={() => setInfo(false)}>X</div>
        <Modal.Body>
          {children}
        </Modal.Body>
      </Modal>
      <InfoIcon
        width={18} height={18} className={`${iconClassName} pointer ml-1`}
        onClick={(e) => {
          e.preventDefault()
          setInfo(true)
        }}
      />
    </>
  )
}
