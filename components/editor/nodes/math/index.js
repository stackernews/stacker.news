import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { useLexicalEditable } from '@lexical/react/useLexicalEditable'
import { useState, useRef, useCallback, useEffect } from 'react'
import { $isMathNode } from '@/lib/lexical/nodes/formatting/math'
import { mergeRegister } from '@lexical/utils'
import {
  COMMAND_PRIORITY_LOW,
  COMMAND_PRIORITY_HIGH,
  KEY_ESCAPE_COMMAND,
  KEY_ENTER_COMMAND,
  SELECTION_CHANGE_COMMAND,
  $getNodeByKey
} from 'lexical'
import ErrorBoundary from '@/components/error-boundary'
import MathEditor from './editor'
import KatexRenderer from '@/components/katex-renderer'
import { useToast } from '@/components/toast'
import useDecoratorNodeSelection from '@/components/editor/hooks/use-decorator-selection'

export default function MathComponent ({ math, inline, nodeKey }) {
  const [editor] = useLexicalComposerContext()
  const isEditable = useLexicalEditable()
  const toaster = useToast()
  const [mathValue, setMathValue] = useState(math)
  const [showMathEditor, setShowMathEditor] = useState(false)
  const inputRef = useRef(null)

  const { isSelected } = useDecoratorNodeSelection(nodeKey, {
    focusedClass: 'focused',
    active: !showMathEditor
  })

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

  useEffect(() => {
    if (!isEditable || showMathEditor) return

    return editor.registerCommand(
      KEY_ENTER_COMMAND,
      (event) => {
        if (!isSelected) return false
        event?.preventDefault()
        setShowMathEditor(true)
        return true
      },
      COMMAND_PRIORITY_LOW
    )
  }, [editor, isSelected, showMathEditor, isEditable])

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
