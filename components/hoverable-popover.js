import { useRef, useState } from 'react'
import { Popover } from 'react-bootstrap'
import OverlayTrigger from 'react-bootstrap/OverlayTrigger'
import styles from './hoverable-popover.module.css'

export default function HoverablePopover ({ id, trigger, body, onShow }) {
  const [showOverlay, setShowOverlay] = useState(false)

  const timeoutId = useRef(null)

  const handleMouseEnter = () => {
    clearTimeout(timeoutId.current)
    onShow && onShow()
    timeoutId.current = setTimeout(() => {
      setShowOverlay(true)
    }, 500)
  }

  const handleMouseLeave = () => {
    clearTimeout(timeoutId.current)
    timeoutId.current = setTimeout(() => setShowOverlay(false), 100)
  }

  return (
    <OverlayTrigger
      show={showOverlay}
      placement='bottom'
      onHide={handleMouseLeave}
      overlay={
        <Popover
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          className={styles.HoverablePopover}
        >
          <Popover.Body className={styles.HoverablePopover}>
            {body}
          </Popover.Body>
        </Popover>
      }
    >
      <span
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {trigger}
      </span>
    </OverlayTrigger>
  )
}
