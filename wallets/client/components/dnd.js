import { useDndHandlers } from '@/wallets/client/context'
import classNames from 'classnames'
import styles from '@/styles/dnd.module.css'

export function Draggable ({ children, index }) {
  const {
    handleDragStart,
    handleDragOver,
    handleDragEnter,
    handleDragLeave,
    handleDrop,
    handleDragEnd,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    isBeingDragged,
    isDragOver
  } = useDndHandlers(index)

  return (
    <div
      className={classNames(
        styles.draggable,
        {
          [styles.dragging]: isBeingDragged,
          [styles.dragOver]: isDragOver
        }
      )}
      draggable
      data-index={index}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onDragEnd={handleDragEnd}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {children}
    </div>
  )
}
