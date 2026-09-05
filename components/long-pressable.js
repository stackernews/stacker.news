import { useEffect, useRef } from 'react'

function eventToPosition (event) {
  return {
    x: event.clientX,
    y: event.clientY
  }
}

function distance (pointA, pointB) {
  return Math.sqrt(
    Math.pow(pointB.x - pointA.x, 2) + Math.pow(pointB.y - pointA.y, 2)
  )
}

export default function LongPressable ({
  onLongPress,
  onShortPress,
  longPressTime = 500,
  primaryMouseButtonOnly = true,
  // maximum distance (pixels) user is allowed to drag before click is canceled
  dragThreshold = 100,
  children
}) {
  const timerRef = useRef(null)
  const isLongPressingRef = useRef(false)
  const startingPositionRef = useRef({ x: 0, y: 0 })

  useEffect(() => () => clearTimeout(timerRef.current), [])

  const cancelLongPress = () => {
    clearTimeout(timerRef.current)
    timerRef.current = null
  }

  const handlePointerDown = (e) => {
    if (primaryMouseButtonOnly && e.pointerType === 'mouse' && e.button !== 0) return

    // re-initialize long press
    isLongPressingRef.current = false
    startingPositionRef.current = eventToPosition(e)

    timerRef.current = setTimeout(() => {
      isLongPressingRef.current = true
      onLongPress(e)
    }, longPressTime)
  }

  const handlePointerUp = (e) => {
    if (timerRef.current) cancelLongPress()

    const mousePosition = eventToPosition(e)

    if (!isLongPressingRef.current && distance(startingPositionRef.current, mousePosition) <= dragThreshold) {
      onShortPress(e)
    } else {
      isLongPressingRef.current = false
    }
  }

  const handlePointerMove = (e) => {
    if (timerRef.current && distance(startingPositionRef.current, eventToPosition(e)) > dragThreshold) {
      cancelLongPress()
    }
  }

  const handlePointerLeave = () => {
    if (timerRef.current) cancelLongPress()
  }

  return (
    <div
      onPointerUp={handlePointerUp}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
    >
      {children}
    </div>
  )
}
