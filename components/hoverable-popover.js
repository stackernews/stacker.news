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
      popperConfig={{
        modifiers: {
          preventOverflow: {
            enabled: false
          }
        }
      }}
      overlay={
        <Popover
          onPointerEnter={handleMouseEnter}
          onPointerLeave={handleMouseLeave}
          onMouseLeave={handleMouseLeave}
          className={styles.HoverablePopover}
          style={{ position: 'fixed' }}
        >
          <Popover.Body className={styles.HoverablePopover}>
            {body}
          </Popover.Body>
        </Popover>
      }
    >
      <span
        onPointerEnter={handleMouseEnter}
        onPointerLeave={handleMouseLeave}
      >
        {trigger}
      </span>
    </OverlayTrigger>
  )
}
