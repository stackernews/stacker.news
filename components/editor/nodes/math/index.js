import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { useLexicalEditable } from '@lexical/react/useLexicalEditable'
import { useLexicalNodeSelection } from '@lexical/react/useLexicalNodeSelection'
import { useState, useRef, useCallback, useEffect } from 'react'
import { $isMathNode } from '@/lib/lexical/nodes/formatting/math'
import { mergeRegister } from '@lexical/utils'
import {
  CLICK_COMMAND,
  COMMAND_PRIORITY_LOW,
  COMMAND_PRIORITY_HIGH,
  KEY_ESCAPE_COMMAND,
  KEY_ENTER_COMMAND,
  KEY_DELETE_COMMAND,
  KEY_BACKSPACE_COMMAND,
  SELECTION_CHANGE_COMMAND,
  $getNodeByKey
} from 'lexical'
import ErrorBoundary from '@/components/error-boundary'
import MathEditor from './editor'
import KatexRenderer from '@/components/katex-renderer'
import { useToast } from '@/components/toast'

export default function MathComponent ({ math, inline, nodeKey }) {
  const [editor] = useLexicalComposerContext()
  const isEditable = useLexicalEditable()
  const toaster = useToast()
  const [mathValue, setMathValue] = useState(math)
  const [showMathEditor, setShowMathEditor] = useState(false)
  const inputRef = useRef(null)

  const [isSelected, setSelected, clearSelection] =
    useLexicalNodeSelection(nodeKey)

  const isFocused = isEditable && isSelected && !showMathEditor

  // Toggle 'focused' class on the Lexical container element (.sn-math)
  useEffect(() => {
    const element = editor.getElementByKey(nodeKey)
    if (!element) return
    if (isFocused) {
      element.classList.add('focused')
    } else {
      element.classList.remove('focused')
    }
  }, [editor, nodeKey, isFocused])

  const onHide = useCallback((restoreSelection) => {
    setShowMathEditor(false)
    editor.update(() => {
      const node = $getNodeByKey(nodeKey)
      if ($isMathNode(node)) {
        node.setMath(mathValue)
        if (restoreSelection) {
          node.selectNext(0, 0)
        }
      }
    })
  }, [editor, mathValue, nodeKey])

  useEffect(() => {
    if (!showMathEditor && mathValue !== math) {
      setMathValue(math)
    }
  }, [showMathEditor, mathValue, math])

  // When the math editor is open, handle escape and selection change to close it
  useEffect(() => {
    if (!isEditable || !showMathEditor) return

    return mergeRegister(
      editor.registerCommand(
        SELECTION_CHANGE_COMMAND,
        (payload) => {
          const activeElement = document.activeElement
          const inputElement = inputRef.current
          if (activeElement !== inputElement) {
            onHide()
          }
          return false
        },
        COMMAND_PRIORITY_HIGH
      ),
      editor.registerCommand(
        KEY_ESCAPE_COMMAND,
        (payload) => {
          const activeElement = document.activeElement
          const inputElement = inputRef.current
          if (activeElement === inputElement) {
            onHide(true)
            return true
          }
          return false
        },
        COMMAND_PRIORITY_HIGH
      )
    )
  }, [editor, onHide, showMathEditor, isEditable])

  const onDelete = useCallback((event) => {
    if (!isSelected) return false
    event?.preventDefault()
    editor.update(() => {
      const node = $getNodeByKey(nodeKey)
      if ($isMathNode(node)) {
        node.selectPrevious()
        node.remove()
      }
    })
    return true
  }, [editor, nodeKey, isSelected])

  // When not editing, handle click-to-select and keyboard commands
  useEffect(() => {
    if (!isEditable || showMathEditor) return

    return mergeRegister(
      editor.registerCommand(
        CLICK_COMMAND,
        (event) => {
          const element = editor.getElementByKey(nodeKey)
          if (element && (event.target === element || element.contains(event.target))) {
            if (event.shiftKey) {
              setSelected(!isSelected)
            } else {
              clearSelection()
              setSelected(true)
            }
            return true
          }
          return false
        },
        COMMAND_PRIORITY_LOW
      ),
      editor.registerCommand(
        KEY_ENTER_COMMAND,
        (event) => {
          if (!isSelected) return false
          event?.preventDefault()
          setShowMathEditor(true)
          return true
        },
        COMMAND_PRIORITY_LOW
      ),
      editor.registerCommand(KEY_DELETE_COMMAND, onDelete, COMMAND_PRIORITY_LOW),
      editor.registerCommand(KEY_BACKSPACE_COMMAND, onDelete, COMMAND_PRIORITY_LOW)
    )
  }, [editor, nodeKey, isSelected, setSelected, clearSelection, onDelete, showMathEditor, isEditable])

  return (
    <>
      {showMathEditor && isEditable
        ? (
          <MathEditor
            math={mathValue}
            setMath={setMathValue}
            inline={inline}
            ref={inputRef}
          />
          )
        : (
          <ErrorBoundary onError={(e) => editor._onError(e)} fallback={null}>
            <KatexRenderer
              equation={mathValue}
              inline={inline}
              onDoubleClick={() => {
                if (isEditable) {
                  setShowMathEditor(true)
                }
              }}
              onClick={() => {
                if (!isEditable) {
                  try {
                    navigator.clipboard.writeText(mathValue)
                    toaster.success('math copied to clipboard')
                  } catch {}
                }
              }}
            />
          </ErrorBoundary>
          )}
    </>
  )
}
