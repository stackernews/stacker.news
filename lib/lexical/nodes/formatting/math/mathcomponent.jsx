import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { useLexicalEditable } from '@lexical/react/useLexicalEditable'
import { useState, useRef, useCallback, useEffect } from 'react'
import { $isMathNode } from './mathnode'
import { mergeRegister } from '@lexical/utils'
import { SELECTION_CHANGE_COMMAND, KEY_ESCAPE_COMMAND, COMMAND_PRIORITY_HIGH, $getNodeByKey, $getSelection, $isNodeSelection } from 'lexical'
import ErrorBoundary from '@/components/error-boundary'
import MathEditor from './matheditor'
import KatexRenderer from '@/components/katex-renderer'

export default function MathComponent ({ math, inline, nodeKey }) {
  const [editor] = useLexicalComposerContext()
  const isEditable = useLexicalEditable()
  const [mathValue, setMathValue] = useState(math)
  const [showMathEditor, setShowMathEditor] = useState(false)
  const inputRef = useRef(null)

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

  useEffect(() => {
    if (!isEditable) return
    if (showMathEditor) {
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
    } else {
      return editor.registerUpdateListener(({ editorState }) => {
        const isSelected = editorState.read(() => {
          const selection = $getSelection()
          return (
            $isNodeSelection(selection) &&
            selection.has(nodeKey) &&
            selection.getNodes().length === 1
          )
        })
        if (isSelected) {
          setShowMathEditor(true)
        }
      })
    }
  }, [editor, nodeKey, onHide, showMathEditor, isEditable])

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
            />
          </ErrorBoundary>
          )}
    </>
  )
}
