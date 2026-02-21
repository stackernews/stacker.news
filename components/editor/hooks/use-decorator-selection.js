import { useEffect, useCallback } from 'react'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { useLexicalEditable } from '@lexical/react/useLexicalEditable'
import { useLexicalNodeSelection } from '@lexical/react/useLexicalNodeSelection'
import { mergeRegister } from '@lexical/utils'
import {
  CLICK_COMMAND,
  COMMAND_PRIORITY_LOW,
  KEY_DELETE_COMMAND,
  KEY_BACKSPACE_COMMAND,
  $getNodeByKey
} from 'lexical'

/**
 * Shared click-to-select, focused-class, and delete behavior for decorator nodes.
 * Pass { ref } to narrow the click target, { focusedClass } to auto-toggle a CSS
 * class, { deletable: false } to skip delete/backspace, { active: false } to
 * suspend commands (e.g. while an inline editor is open).
 */
export default function useDecoratorNodeSelection (nodeKey, opts = {}) {
  const {
    ref = null,
    focusedClass = null,
    deletable = true,
    active = true
  } = opts

  const [editor] = useLexicalComposerContext()
  const isEditable = useLexicalEditable()
  const [isSelected, setSelected, clearSelection] =
    useLexicalNodeSelection(nodeKey)

  const isFocused = isEditable && isSelected && active

  // toggle focused class on the Lexical-managed DOM element
  useEffect(() => {
    if (!focusedClass) return
    const element = editor.getElementByKey(nodeKey)
    if (!element) return
    element.classList.toggle(focusedClass, isFocused)
  }, [editor, nodeKey, isFocused, focusedClass])

  const onDelete = useCallback((event) => {
    if (!isSelected) return false
    event?.preventDefault()
    editor.update(() => {
      const node = $getNodeByKey(nodeKey)
      if (node) {
        node.selectPrevious()
        node.remove()
      }
    })
    return true
  }, [editor, nodeKey, isSelected])

  useEffect(() => {
    if (!isEditable || !active) return

    const onClick = (event) => {
      const target = ref?.current
      const element = editor.getElementByKey(nodeKey)
      if (!element) return false

      // when a ref is provided, only match clicks directly on that element
      // otherwise match the container or anything inside it
      const hit = target
        ? event.target === target
        : event.target === element || element.contains(event.target)

      if (hit) {
        if (event.shiftKey) {
          setSelected(!isSelected)
        } else {
          clearSelection()
          setSelected(true)
        }
        return true
      }
      return false
    }

    return mergeRegister(
      editor.registerCommand(CLICK_COMMAND, onClick, COMMAND_PRIORITY_LOW),
      ...(deletable
        ? [
            editor.registerCommand(KEY_DELETE_COMMAND, onDelete, COMMAND_PRIORITY_LOW),
            editor.registerCommand(KEY_BACKSPACE_COMMAND, onDelete, COMMAND_PRIORITY_LOW)
          ]
        : [])
    )
  }, [editor, nodeKey, isEditable, isSelected, setSelected, clearSelection, ref, deletable, active, onDelete])

  return { isSelected, setSelected, clearSelection, isFocused }
}
