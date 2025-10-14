import { useRef, useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import ToolbarPlugin from '../index'
import styles from '@/components/lexical/theme/theme.module.css'
import { $getSelection, getDOMSelection, SELECTION_CHANGE_COMMAND, COMMAND_PRIORITY_LOW, $isRangeSelection } from 'lexical'
import { setFloatingToolbarPosition } from '@/components/lexical/plugins/links/linkeditor/position'
import { mergeRegister } from '@lexical/utils'
import { useToolbarState } from '@/components/lexical/contexts/toolbar'

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

export function FloatingToolbar ({ editor, anchorElem }) {
  const floatingToolbarRef = useRef(null)
  const { toolbarState } = useToolbarState()

  function mouseMoveListener (e) {
    const toolbarElem = floatingToolbarRef.current
    if (!toolbarElem) return

    if (e.buttons === 1 || e.buttons === 3) {
      if (toolbarElem.style.pointerEvents !== 'none') {
        const x = e.clientX
        const y = e.clientY
        const elementUnderMouse = document.elementFromPoint(x, y)

        if (!toolbarElem.contains(elementUnderMouse)) {
          toolbarElem.style.pointerEvents = 'none'
        }
      }
    }
  }

  function mouseUpListener (e) {
    const toolbarElem = floatingToolbarRef.current
    if (!toolbarElem) return

    if (toolbarElem.style.pointerEvents !== 'auto') {
      toolbarElem.style.pointerEvents = 'auto'
    }
  }

  useEffect(() => {
    if (!floatingToolbarRef?.current) return

    document.addEventListener('mousemove', mouseMoveListener)
    document.addEventListener('mouseup', mouseUpListener)
    return () => {
      document.removeEventListener('mousemove', mouseMoveListener)
      document.removeEventListener('mouseup', mouseUpListener)
    }
  }, [floatingToolbarRef])

  const $updateFloatingToolbar = useCallback(() => {
    const toolbarElem = floatingToolbarRef.current
    if (!toolbarElem) return

    const sel = $getSelection()
    const nativeSel = getDOMSelection(editor._window)
    const rootEl = editor.getRootElement()

    if (!sel || !nativeSel || !rootEl) return

    if (!nativeSel.isCollapsed && rootEl.contains(nativeSel.anchorNode)) {
      const rangeRect = getDOMRangeRect(nativeSel, rootEl)
      setFloatingToolbarPosition({
        targetRect: rangeRect,
        floatingElem: toolbarElem,
        anchorElem,
        isLink: toolbarState.isLink
      })
    }
  }, [editor, anchorElem, toolbarState.isLink])

  useEffect(() => {
    const scrollerElem = anchorElem.parentElement

    const update = () => {
      editor.getEditorState().read(() => {
        $updateFloatingToolbar()
      })
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
    }
  }, [editor, $updateFloatingToolbar, anchorElem])

  useEffect(() => {
    editor.getEditorState().read(() => {
      $updateFloatingToolbar()
    })
    return mergeRegister(
      editor.registerUpdateListener(({ editorState }) => {
        editorState.read(() => {
          $updateFloatingToolbar()
        })
      }),
      editor.registerCommand(
        SELECTION_CHANGE_COMMAND,
        () => {
          $updateFloatingToolbar()
          return false
        },
        COMMAND_PRIORITY_LOW
      )
    )
  }, [editor, $updateFloatingToolbar])

  return (
    <div className={styles.floatingToolbarContainer} ref={floatingToolbarRef}>
      <div
        className={styles.floatingToolbar}
        onMouseDown={e => e.preventDefault()}
      >
        <ToolbarPlugin anchorElem={anchorElem} isFloating />
      </div>
    </div>
  )
}

export function useFloatingToolbar ({ editor, anchorElem }) {
  const [show, setShow] = useState(false)

  const updatePopup = useCallback(() => {
    editor.getEditorState().read(() => {
      if (editor.isComposing()) return
      console.log('updatePopup')

      const sel = $getSelection()
      const nativeSel = getDOMSelection(editor._window)
      const rootEl = editor.getRootElement()

      // if there is no selection,
      // or the selection is not in the root element, hide the popup
      if (nativeSel !== null && (!$isRangeSelection(sel) || rootEl === null || !rootEl.contains(nativeSel.anchorNode))) {
        setShow(false)
        return
      }

      // if the selection is not a range selection, hide the popup
      if (!$isRangeSelection(sel)) return

      // is there any text selected?
      if (sel.getTextContent() === '') {
        setShow(false)
        return
      }

      // if so, is it empty?
      const rawTextContent = sel.getTextContent().replace(/\n/g, '')
      if (!sel.isCollapsed() && rawTextContent === '') {
        setShow(false)
      } else {
        setShow(true)
      }
    })
  }, [editor])

  useEffect(() => {
    document.addEventListener('selectionchange', updatePopup)
    return () => {
      document.removeEventListener('selectionchange', updatePopup)
    }
  }, [updatePopup])

  useEffect(() => {
    return mergeRegister(
      editor.registerUpdateListener(() => {
        updatePopup()
      }),
      editor.registerRootListener(() => {
        if (editor.getRootElement() === null) {
          setShow(false)
        }
      })
    )
  }, [editor, updatePopup])

  if (!show) return null
  console.log('show', show)

  return createPortal(
    <FloatingToolbar editor={editor} anchorElem={anchorElem} />,
    anchorElem
  )
}

export default function FloatingToolbarPlugin ({ anchorElem }) {
  const [editor] = useLexicalComposerContext()

  return useFloatingToolbar({ editor, anchorElem })
}
