import { createContext, useContext, useCallback, useReducer } from 'react'

const DndContext = createContext(null)
const DndDispatchContext = createContext(null)

export const DRAG_START = 'DRAG_START'
export const DRAG_ENTER = 'DRAG_ENTER'
export const DRAG_DROP = 'DRAG_DROP'
export const DRAG_END = 'DRAG_END'

const initialState = {
  isDragging: false,
  dragIndex: null,
  dragOverIndex: null
}

export function useDndState () {
  const context = useContext(DndContext)
  if (!context) {
    throw new Error('useDndState must be used within a DndProvider')
  }
  return context
}

export function useDndDispatch () {
  const context = useContext(DndDispatchContext)
  if (!context) {
    throw new Error('useDndDispatch must be used within a DndProvider')
  }
  return context
}

export function DndProvider ({ children, onReorder }) {
  const [state, dispatch] = useReducer(dndReducer, initialState)

  const dispatchWithCallback = useCallback((action) => {
    if (action.type !== DRAG_DROP) {
      dispatch(action)
      return
    }

    const { fromIndex, toIndex, items } = action
    if (fromIndex === toIndex) {
      // nothing changed, just dispatch action but don't run onReorder callback
      dispatch(action)
      return
    }

    const newItems = [...items]
    const [movedItem] = newItems.splice(fromIndex, 1)
    newItems.splice(toIndex, 0, movedItem)
    const prioritiesUpdates = newItems.map((item, index) => ({
      id: item.id,
      priority: index
    }))
    onReorder(prioritiesUpdates)
  }, [onReorder])

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
        isDragging: true,
        dragIndex: action.index,
        dragOverIndex: null
      }
    case DRAG_ENTER:
      return {
        ...state,
        dragOverIndex: action.index
      }
    case DRAG_DROP:
    case DRAG_END:
      return {
        isDragging: false,
        dragIndex: null,
        dragOverIndex: null
      }
    default:
      return state
  }
}
