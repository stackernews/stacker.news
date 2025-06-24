import { createContext, useContext, useCallback, useReducer, useState } from 'react'

const DndContext = createContext(null)
const DndDispatchContext = createContext(null)

export const DRAG_START = 'DRAG_START'
export const DRAG_ENTER = 'DRAG_ENTER'
export const DRAG_DROP = 'DRAG_DROP'
export const DRAG_END = 'DRAG_END'
export const DRAG_LEAVE = 'DRAG_LEAVE'

const initialState = {
  isDragging: false,
  dragIndex: null,
  dragOverIndex: null,
  items: []
}

function useDndState () {
  const context = useContext(DndContext)
  if (!context) {
    throw new Error('useDndState must be used within a DndProvider')
  }
  return context
}

function useDndDispatch () {
  const context = useContext(DndDispatchContext)
  if (!context) {
    throw new Error('useDndDispatch must be used within a DndProvider')
  }
  return context
}

export function useDndHandlers (index) {
  const dispatch = useDndDispatch()
  const { isDragging, dragOverIndex, dragIndex } = useDndState()
  const [isTouchDragging, setIsTouchDragging] = useState(false)
  const [touchStartY, setTouchStartY] = useState(0)
  const [touchStartX, setTouchStartX] = useState(0)

  const isBeingDragged = (isDragging || isTouchDragging) && dragIndex === index
  const isDragOver = (isDragging || isTouchDragging) && dragOverIndex === index && dragIndex !== index

  const handleDragStart = useCallback((e) => {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/html', e.target.outerHTML)
    e.dataTransfer.setData('text/plain', index.toString())

    // Remove browser default drag image by setting it to an invisible element
    const invisibleElement = document.createElement('div')
    invisibleElement.style.width = '1px'
    invisibleElement.style.height = '1px'
    invisibleElement.style.opacity = '0'
    invisibleElement.style.position = 'absolute'
    invisibleElement.style.top = '-9999px'
    invisibleElement.style.left = '-9999px'
    document.body.appendChild(invisibleElement)
    e.dataTransfer.setDragImage(invisibleElement, 0, 0)

    // Remove the invisible element after a short delay
    setTimeout(() => {
      if (document.body.contains(invisibleElement)) {
        document.body.removeChild(invisibleElement)
      }
    }, 100)

    dispatch({ type: DRAG_START, index })
  }, [index, dispatch])

  const handleDragOver = useCallback((e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }, [])

  const handleDragEnter = useCallback((e) => {
    e.preventDefault()
    dispatch({ type: DRAG_ENTER, index })
  }, [index, dispatch])

  const handleDragLeave = useCallback((e) => {
    e.preventDefault()
    // Only clear if we're leaving the element (not entering a child)
    if (!e.currentTarget.contains(e.relatedTarget)) {
      dispatch({ type: DRAG_LEAVE })
    }
  }, [dispatch])

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    const draggedIndex = parseInt(e.dataTransfer.getData('text/plain'))
    if (draggedIndex !== index) {
      dispatch({ type: DRAG_DROP, fromIndex: draggedIndex, toIndex: index })
    }
  }, [index, dispatch])

  const handleDragEnd = useCallback(() => {
    dispatch({ type: DRAG_END })
  }, [dispatch])

  // Touch event handlers for mobile
  const handleTouchStart = useCallback((e) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0]
      setTouchStartX(touch.clientX)
      setTouchStartY(touch.clientY)
      setIsTouchDragging(false)
    }
  }, [])

  const handleTouchMove = useCallback((e) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0]
      const deltaX = Math.abs(touch.clientX - touchStartX)
      const deltaY = Math.abs(touch.clientY - touchStartY)

      // Start dragging if moved more than 10px in any direction
      if (!isTouchDragging && (deltaX > 10 || deltaY > 10)) {
        setIsTouchDragging(true)
        dispatch({ type: DRAG_START, index })
      }

      if (isTouchDragging) {
        // Find the element under the touch point
        const elementUnderTouch = document.elementFromPoint(touch.clientX, touch.clientY)
        if (elementUnderTouch) {
          const element = elementUnderTouch.closest('[data-index]')
          if (element) {
            const elementIndex = parseInt(element.dataset.index)
            if (elementIndex !== index) {
              dispatch({ type: DRAG_ENTER, index: elementIndex })
            }
          }
        }
      }
    }
  }, [touchStartX, touchStartY, isTouchDragging, index, dispatch])

  const handleTouchEnd = useCallback((e) => {
    if (isTouchDragging) {
      const touch = e.changedTouches[0]
      const elementUnderTouch = document.elementFromPoint(touch.clientX, touch.clientY)

      if (elementUnderTouch) {
        const element = elementUnderTouch.closest('[data-index]')
        if (element) {
          const elementIndex = parseInt(element.dataset.index)
          if (elementIndex !== index) {
            dispatch({ type: DRAG_DROP, fromIndex: index, toIndex: elementIndex })
          }
        }
      }

      setIsTouchDragging(false)
      dispatch({ type: DRAG_END })
    }
  }, [isTouchDragging, index, dispatch])

  return {
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
  }
}

export function DndProvider ({ children, items, onReorder }) {
  const [state, dispatch] = useReducer(dndReducer, { ...initialState, items })

  const dispatchWithCallback = useCallback((action) => {
    if (action.type !== DRAG_DROP) {
      dispatch(action)
      return
    }

    const { fromIndex, toIndex } = action
    if (fromIndex === toIndex) {
      // nothing changed, just dispatch action but don't run onReorder callback
      dispatch(action)
      return
    }

    const newItems = [...items]
    const [movedItem] = newItems.splice(fromIndex, 1)
    newItems.splice(toIndex, 0, movedItem)
    onReorder(newItems)
  }, [items, onReorder])

  return (
    <DndContext.Provider value={state}>
      <DndDispatchContext.Provider value={dispatchWithCallback}>
        {children}
      </DndDispatchContext.Provider>
    </DndContext.Provider>
  )
}

function dndReducer (state, action) {
  switch (action.type) {
    case DRAG_START:
      return {
        ...state,
        isDragging: true,
        dragIndex: action.index,
        dragOverIndex: null
      }
    case DRAG_ENTER:
      return {
        ...state,
        dragOverIndex: action.index
      }
    case DRAG_LEAVE:
      return {
        ...state,
        dragOverIndex: null
      }
    case DRAG_DROP:
    case DRAG_END:
      return {
        ...state,
        isDragging: false,
        dragIndex: null,
        dragOverIndex: null
      }
    default:
      return state
  }
}
