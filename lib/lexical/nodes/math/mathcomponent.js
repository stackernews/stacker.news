import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { useLexicalEditable } from '@lexical/react/LexicalEditable'
import { useState, useRef, useCallback, useEffect } from 'react'
import { $isMathNode } from './mathnode'
import { mergeRegister } from '@lexical/utils'
import { SELECTION_CHANGE_COMMAND, KEY_ESCAPE_COMMAND, COMMAND_PRIORITY_HIGH, $getNodeByKey, $getSelection, $isNodeSelection } from 'lexical'

export default function MathComponent ({ equation, inline, nodeKey }) {
  const [editor] = useLexicalComposerContext()
  const isEditable = useLexicalEditable()
  const [equationValue, setEquationValue] = useState(equation)
  const [showEquationEditor, setShowEquationEditor] = useState(false)
  const inputRef = useRef(null)

  const onHide = useCallback((restoreSelection) => {
    setShowEquationEditor(false)
    editor.update(() => {
      const node = $getNodeByKey(nodeKey)
      if ($isMathNode(node)) {
        node.setEquation(equationValue)
        if (restoreSelection) {
          node.selectNext(0, 0)
        }
      }
    })
  }, [editor, equationValue, nodeKey])

  useEffect(() => {
    if (!showEquationEditor && equationValue !== equation) {
      setEquationValue(equation)
    }
  }, [showEquationEditor, equationValue, equation])

  useEffect(() => {
    if (!isEditable) return
    if (showEquationEditor) {
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
          setShowEquationEditor(true)
        }
      })
    }
  }, [editor, nodeKey, onHide, showEquationEditor, isEditable])

  return null
}
