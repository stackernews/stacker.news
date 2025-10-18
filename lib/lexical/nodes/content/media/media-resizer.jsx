import { useRef } from 'react'
import styles from '@/components/lexical/theme/media.module.css'
import { calculateZoomLevel } from '@lexical/utils'
import classNames from 'classnames'

function clamp (value, min, max) {
  return Math.min(Math.max(value, min), max)
}

const Direction = {
  east: 1 << 0,
  north: 1 << 3,
  south: 1 << 1,
  west: 1 << 2
}

export default function MediaResizer ({
  onResizeStart,
  onResizeEnd,
  buttonRef,
  imageRef,
  maxWidth,
  editor,
  showCaption,
  setShowCaption,
  captionsEnabled
}) {
  const controlWrapperRef = useRef(null)
  const userSelect = useRef({
    priority: '',
    value: 'default'
  })
  const positioningRef = useRef({
    currentHeight: 'inherit',
    currentWidth: 'inherit',
    direction: 0,
    isResizing: false,
    ratio: 0,
    startHeight: 0,
    startWidth: 0,
    startX: 0,
    startY: 0
  })

  const editorRootElement = editor.getRootElement()
  const maxWidthContainer = maxWidth || (editorRootElement !== null
    ? editorRootElement.getBoundingClientRect().width - 20
    : 100)

  const maxHeightContainer = editorRootElement !== null
    ? editorRootElement.getBoundingClientRect().height - 20
    : 100

  const minWidth = 100
  const minHeight = 100

  const setStartCursor = (direction) => {
    const ew = direction === Direction.east || direction === Direction.west
    const ns = direction === Direction.north || direction === Direction.south
    const nwse =
      (direction & Direction.north && direction & Direction.west) ||
      (direction & Direction.south && direction & Direction.east)

    const cursorDir = ew ? 'ew' : ns ? 'ns' : nwse ? 'nwse' : 'nesw'

    if (editorRootElement !== null) {
      editorRootElement.style.setProperty(
        'cursor',
        `${cursorDir}-resize`,
        'important'
      )
    }
    if (document.body !== null) {
      document.body.style.setProperty(
        'cursor',
        `${cursorDir}-resize`,
        'important'
      )
      userSelect.current.value = document.body.style.getPropertyValue(
        '-webkit-user-select'
      )
      userSelect.current.priority = document.body.style.getPropertyPriority(
        '-webkit-user-select'
      )
      document.body.style.setProperty(
        '-webkit-user-select',
        'none',
        'important'
      )
    }
  }

  const setEndCursor = () => {
    if (editorRootElement !== null) {
      editorRootElement.style.setProperty('cursor', 'text')
    }
    if (document.body !== null) {
      document.body.style.setProperty('cursor', 'default')
      document.body.style.setProperty(
        '-webkit-user-select',
        userSelect.current.value,
        userSelect.current.priority
      )
    }
  }

  const handlePointerDown = (event, direction) => {
    if (!editor.isEditable()) return

    const image = imageRef.current
    const controlWrapper = controlWrapperRef.current

    if (image === null || controlWrapper === null) return

    event.preventDefault()

    const { width, height } = image.getBoundingClientRect()
    const zoom = calculateZoomLevel(image)
    const positioning = positioningRef.current
    positioning.startWidth = width
    positioning.startHeight = height
    positioning.ratio = width / height
    positioning.currentWidth = width
    positioning.currentHeight = height
    positioning.startX = event.clientX / zoom
    positioning.startY = event.clientY / zoom
    positioning.direction = direction
    positioning.isResizing = true

    setStartCursor(direction)
    onResizeStart()

    controlWrapper.classList.add(styles.imageControlWrapperResizing)
    image.style.height = `${height}px`
    image.style.width = `${width}px`

    document.addEventListener('pointermove', handlePointerMove)
    document.addEventListener('pointerup', handlePointerUp)
  }

  const handlePointerMove = (event) => {
    const image = imageRef.current
    const positioning = positioningRef.current

    const isHorizontal =
      positioning.direction & (Direction.east | Direction.west)
    const isVertical =
      positioning.direction & (Direction.south | Direction.north)

    if (image !== null && positioning.isResizing) {
      const zoom = calculateZoomLevel(image)
      // Corner cursor
      if (isHorizontal && isVertical) {
        let diff = Math.floor(positioning.startX - event.clientX / zoom)
        diff = positioning.direction & Direction.east ? -diff : diff

        const width = clamp(
          positioning.startWidth + diff,
          minWidth,
          maxWidthContainer
        )

        const height = width / positioning.ratio
        image.style.width = `${width}px`
        image.style.height = `${height}px`
        positioning.currentHeight = height
        positioning.currentWidth = width
      } else if (isVertical) {
        let diff = Math.floor(positioning.startY - event.clientY / zoom)
        diff = positioning.direction & Direction.south ? -diff : diff

        const height = clamp(
          positioning.startHeight + diff,
          minHeight,
          maxHeightContainer
        )

        image.style.height = `${height}px`
        positioning.currentHeight = height
      } else {
        let diff = Math.floor(positioning.startX - event.clientX / zoom)
        diff = positioning.direction & Direction.east ? -diff : diff

        const width = clamp(
          positioning.startWidth + diff,
          minWidth,
          maxWidthContainer
        )

        image.style.width = `${width}px`
        positioning.currentWidth = width
      }
    }
  }
  const handlePointerUp = () => {
    const image = imageRef.current
    const positioning = positioningRef.current
    const controlWrapper = controlWrapperRef.current
    if (image !== null && controlWrapper !== null && positioning.isResizing) {
      const width = positioning.currentWidth
      const height = positioning.currentHeight
      positioning.startWidth = 0
      positioning.startHeight = 0
      positioning.ratio = 0
      positioning.startX = 0
      positioning.startY = 0
      positioning.currentWidth = 0
      positioning.currentHeight = 0
      positioning.isResizing = false

      controlWrapper.classList.remove(styles.imageControlWrapperResizing)

      setEndCursor()
      onResizeEnd(width, height)

      document.removeEventListener('pointermove', handlePointerMove)
      document.removeEventListener('pointerup', handlePointerUp)
    }
  }

  return (
    <div ref={controlWrapperRef}>
      {!showCaption && captionsEnabled && (
        <button
          className={styles.imageCaptionButton}
          ref={buttonRef}
          onClick={() => {
            setShowCaption(!showCaption)
          }}
        >
          Add Caption
        </button>
      )}
      <div
        className={classNames(styles.imageResizer, styles.imageResizerN)}
        onPointerDown={(event) => {
          handlePointerDown(event, Direction.north)
        }}
      />
      <div
        className={classNames(styles.imageResizer, styles.imageResizerNe)}
        onPointerDown={(event) => {
          handlePointerDown(event, Direction.north | Direction.east)
        }}
      />
      <div
        className={classNames(styles.imageResizer, styles.imageResizerE)}
        onPointerDown={(event) => {
          handlePointerDown(event, Direction.east)
        }}
      />
      <div
        className={classNames(styles.imageResizer, styles.imageResizerSe)}
        onPointerDown={(event) => {
          handlePointerDown(event, Direction.south | Direction.east)
        }}
      />
      <div
        className={classNames(styles.imageResizer, styles.imageResizerS)}
        onPointerDown={(event) => {
          handlePointerDown(event, Direction.south)
        }}
      />
      <div
        className={classNames(styles.imageResizer, styles.imageResizerSw)}
        onPointerDown={(event) => {
          handlePointerDown(event, Direction.south | Direction.west)
        }}
      />
      <div
        className={classNames(styles.imageResizer, styles.imageResizerW)}
        onPointerDown={(event) => {
          handlePointerDown(event, Direction.west)
        }}
      />
      <div
        className={classNames(styles.imageResizer, styles.imageResizerNw)}
        onPointerDown={(event) => {
          handlePointerDown(event, Direction.north | Direction.west)
        }}
      />
    </div>
  )
}
