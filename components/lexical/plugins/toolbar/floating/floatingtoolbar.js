import { useRef, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import ToolbarPlugin from '../index'
import styles from '@/components/lexical/theme/theme.module.css'
import { $getSelection, getDOMSelection, SELECTION_CHANGE_COMMAND, COMMAND_PRIORITY_LOW, KEY_ESCAPE_COMMAND, COMMAND_PRIORITY_HIGH, $isRangeSelection } from 'lexical'
import { setFloatingElemPosition } from '@/components/lexical/plugins/links/linkeditor/position'
import { mergeRegister } from '@lexical/utils'

function getDOMRangeRect (nativeSelection, rootElement) {
  const domRange = nativeSelection.getRangeAt(0)

  let rect

  if (nativeSelection.anchorNode === rootElement) {
    let inner = rootElement
    while (inner.firstElementChild != null) {
      inner = inner.firstElementChild
    }
    rect = inner.getBoundingClientRect()
  } else {
    rect = domRange.getBoundingClientRect()
  }

  return rect
}

export default function FloatingToolbarPlugin ({ anchorElem }) {
  const [editor] = useLexicalComposerContext()
  const floatingToolbarRef = useRef(null)
  const updateTimeoutRef = useRef(null)
  const previousRangeRectRef = useRef(null)

  function mouseMoveListener (e) {
    if (
      floatingToolbarRef?.current &&
      (e.buttons === 1 || e.buttons === 3)
    ) {
      if (floatingToolbarRef.current.style.pointerEvents !== 'none') {
        const x = e.clientX
        const y = e.clientY
        const elementUnderMouse = document.elementFromPoint(x, y)

        if (!floatingToolbarRef.current.contains(elementUnderMouse)) {
          // mouse is not over the target element => not a normal click, but probably a drag
          floatingToolbarRef.current.style.pointerEvents = 'none'
        }
      }
    }
  }
  function mouseUpListener (e) {
    if (floatingToolbarRef?.current) {
      if (floatingToolbarRef.current.style.pointerEvents !== 'auto') {
        floatingToolbarRef.current.style.pointerEvents = 'auto'
      }
    }
  }

  const handleBlur = useCallback((event) => {
    const floatingElem = floatingToolbarRef.current
    console.log('floatingElem', floatingElem)
    if (!floatingElem || !anchorElem) return

    console.log('handleBlur', event)
    console.log('anchorElem', anchorElem)

    previousRangeRectRef.current = null
    setFloatingElemPosition({ targetRect: null, floatingElem, anchorElem })
  }, [floatingToolbarRef, anchorElem])

  useEffect(() => {
    if (floatingToolbarRef?.current) {
      document.addEventListener('mousemove', mouseMoveListener)
      document.addEventListener('mouseup', mouseUpListener)

      return () => {
        document.removeEventListener('mousemove', mouseMoveListener)
        document.removeEventListener('mouseup', mouseUpListener)
      }
    }
  }, [floatingToolbarRef])

  const $updateTextFormatFloatingToolbar = useCallback(() => {
    const selection = $getSelection()
    if (!selection) return
    const rawTextContent = selection.getTextContent().replace(/\n/g, '')
    if (!$isRangeSelection(selection) || rawTextContent === '') {
      if (!floatingToolbarRef.current || !anchorElem) return
      console.log('updateTextFormatFloatingToolbar', floatingToolbarRef.current, anchorElem)
      previousRangeRectRef.current = null
      setFloatingElemPosition({ targetRect: null, floatingElem: floatingToolbarRef.current, anchorElem })
      return
    }

    const floatingToolbarRefElem = floatingToolbarRef.current
    const nativeSelection = getDOMSelection(editor._window)

    if (floatingToolbarRefElem === null) {
      return
    }

    const rootElement = editor.getRootElement()
    if (
      selection !== null &&
      nativeSelection !== null &&
      !nativeSelection.isCollapsed &&
      rootElement !== null &&
      rootElement.contains(nativeSelection.anchorNode)
    ) {
      const rangeRect = getDOMRangeRect(nativeSelection, rootElement)
      rangeRect.y -= 640

      // with tolerance
      const previousRect = previousRangeRectRef.current
      const POSITION_TOLERANCE = 0.1 // pixels

      if (
        !previousRect ||
        Math.abs(previousRect.x - rangeRect.x) > POSITION_TOLERANCE ||
        Math.abs(previousRect.y - rangeRect.y) > POSITION_TOLERANCE ||
        Math.abs(previousRect.width - rangeRect.width) > 6 ||
        Math.abs(previousRect.height - rangeRect.height) > 6
      ) {
        // remember the new position
        previousRangeRectRef.current = {
          x: rangeRect.x,
          y: rangeRect.y,
          width: rangeRect.width,
          height: rangeRect.height
        }

        setFloatingElemPosition(
          { targetRect: rangeRect, floatingElem: floatingToolbarRefElem, anchorElem }
        )
      }
    }
  }, [editor, anchorElem])

  const debouncedUpdateTextFormatFloatingToolbar = useCallback(() => {
    // Clear any existing timeout
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current)
    }

    // Set a new timeout
    updateTimeoutRef.current = setTimeout(() => {
      editor.getEditorState().read(() => {
        $updateTextFormatFloatingToolbar()
      })
    }, 16)
  }, [editor, $updateTextFormatFloatingToolbar])

  useEffect(() => {
    const scrollerElem = anchorElem?.parentElement

    const update = () => {
      debouncedUpdateTextFormatFloatingToolbar()
    }

    window.addEventListener('resize', update)
    if (scrollerElem) {
      scrollerElem.addEventListener('scroll', update)
    }

    return () => {
      window.removeEventListener('resize', update)
      if (scrollerElem) {
        scrollerElem.removeEventListener('scroll', update)
      }
      // clear timeout
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current)
      }
    }
  }, [debouncedUpdateTextFormatFloatingToolbar, anchorElem])

  useEffect(() => {
    debouncedUpdateTextFormatFloatingToolbar()
    return mergeRegister(
      editor.registerUpdateListener(({ editorState }) => {
        console.log('updating position because of editor state change')
        debouncedUpdateTextFormatFloatingToolbar()
      }),

      editor.registerCommand(
        SELECTION_CHANGE_COMMAND,
        () => {
          console.log('updating position because of selection change')
          debouncedUpdateTextFormatFloatingToolbar()
          return false
        },
        COMMAND_PRIORITY_LOW
      ),
      editor.registerCommand(
        KEY_ESCAPE_COMMAND,
        () => {
          console.log('updating position because of escape key')
          handleBlur()
          return true
        }, COMMAND_PRIORITY_HIGH)
    )
  }, [editor, debouncedUpdateTextFormatFloatingToolbar, handleBlur])

  if (!anchorElem) return null

  return createPortal(
    <div className={styles.floatingToolbarContainer} ref={floatingToolbarRef}>
      <div className={styles.floatingToolbar}>
        <ToolbarPlugin anchorElem={anchorElem} isFloating />
      </div>
    </div>,
    anchorElem
  )
}
