import { Popover } from 'react-bootstrap'
import OverlayTrigger from 'react-bootstrap/OverlayTrigger'
import { useRef, useState } from 'react'

export default function HoverablePopover ({ trigger, body, onShow }) {
  const [show, setShow] = useState(false)
  const popRef = useRef(null)
  const timeoutId = useRef(null)

  const onToggle = show => {
    clearTimeout(timeoutId.current)
    if (show) {
      onShow?.()
      timeoutId.current = setTimeout(() => setShow(true), 500)
    } else {
      timeoutId.current = setTimeout(() => setShow(!!popRef.current?.matches(':hover')), 300)
    }
  }

  return (
    <OverlayTrigger
      placement='bottom'
      trigger={['hover', 'focus']}
      show={show}
      onToggle={onToggle}
      transition
      rootClose
      overlay={
        <Popover style={{ position: 'fixed' }} onPointerLeave={() => onToggle(false)}>
          <Popover.Body ref={popRef}>
            {body}
          </Popover.Body>
        </Popover>
      }
    >
      <span>
        {trigger}
      </span>
    </OverlayTrigger>
  )
}
