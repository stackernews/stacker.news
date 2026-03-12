import { useEffect, useCallback } from 'react'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { useLexicalEditable } from '@lexical/react/useLexicalEditable'
import { useLexicalNodeSelection } from '@lexical/react/useLexicalNodeSelection'
import { mergeRegister } from '@lexical/utils'
import {
  CLICK_COMMAND,
  COMMAND_PRIORITY_LOW,
  COMMAND_PRIORITY_EDITOR,
  KEY_DELETE_COMMAND,
  KEY_BACKSPACE_COMMAND,
  KEY_ENTER_COMMAND,
  $getNodeByKey,
  $createParagraphNode
} from 'lexical'

/**
 * Shared click-to-select, focused-class, and delete behavior for decorator nodes.
 * Pass { ref } to narrow the click target, { focusedClass } to auto-toggle a CSS
 * class, { deletable: false } to skip delete/backspace, { active: false } to
 * suspend commands (e.g. while an inline editor is open, such as the math editor),
 * { onDoubleClick } to handle double-click on the node.
 */
export default function useDecoratorNodeSelection (nodeKey, opts = {}) {
  const {
    ref = null,
    focusedClass = null,
    deletable = true,
    active = true,
    onDoubleClick = null
  } = opts

  const [editor] = useLexicalComposerContext()
  const isEditable = useLexicalEditable()
  const [isSelected, setSelected, clearSelection] =
    useLexicalNodeSelection(nodeKey)

  const isFocused = isEditable && isSelected && active

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

  // fallback Enter handler at EDITOR (lowest) priority so decorator-specific
  // handlers (e.g. MathNode opening its editor at LOW priority) run first
  const onEnter = useCallback((event) => {
    if (!isSelected) return false
    event?.preventDefault()
    editor.update(() => {
      const node = $getNodeByKey(nodeKey)
      if (!node) return
      const block = node.getTopLevelElement() || node
      const paragraph = $createParagraphNode()
      block.insertAfter(paragraph)
      paragraph.select()
    })
    return true
  }, [editor, nodeKey, isSelected])

  // when a ref is provided, only match clicks directly on that element
  // otherwise match the decorator container or anything inside it
  const hitTest = useCallback((event) => {
    const element = editor.getElementByKey(nodeKey)
    if (!element) return false

    const target = ref?.current
    return target
      ? event.target === target
      : event.target === element || element.contains(event.target)
  }, [editor, nodeKey, ref])

  const onClick = useCallback((event) => {
    if (!hitTest(event)) return false

    if (event.shiftKey) {
      setSelected(!isSelected)
    } else {
      clearSelection()
      setSelected(true)
    }
    return true
  }, [isSelected, setSelected, clearSelection, hitTest])

  const onDblClick = useCallback((event) => {
    if (!onDoubleClick || !hitTest(event)) return

    event.preventDefault()
    onDoubleClick(event)
  }, [onDoubleClick, hitTest])

  // toggle focused class on the Lexical DOM element
  useEffect(() => {
    if (!focusedClass) return
    const element = editor.getElementByKey(nodeKey)
    if (!element) return
    element.classList.toggle(focusedClass, isFocused)
  }, [editor, nodeKey, isFocused, focusedClass])

  // when the node loses Lexical focus, its contenteditable="false" DOM wrapper
  // can retain browser focus (Chrome for example shows :focus-visible).
  // keyboard input goes to the non-editable element instead of the editor root, so typing breaks.
  useEffect(() => {
    if (isFocused || !active) return
    const element = editor.getElementByKey(nodeKey)
    if (!element) return
    if (element === document.activeElement || element.contains(document.activeElement)) {
      editor.getRootElement()?.focus({ preventScroll: true })
    }
  }, [editor, nodeKey, isFocused, active])

  useEffect(() => {
    if (!isEditable || !active) return

    const commands = [
      editor.registerCommand(CLICK_COMMAND, onClick, COMMAND_PRIORITY_LOW),
      editor.registerCommand(KEY_ENTER_COMMAND, onEnter, COMMAND_PRIORITY_EDITOR)
    ]

    if (deletable) {
      commands.push(
        editor.registerCommand(KEY_DELETE_COMMAND, onDelete, COMMAND_PRIORITY_LOW),
        editor.registerCommand(KEY_BACKSPACE_COMMAND, onDelete, COMMAND_PRIORITY_LOW)
      )
    }

    const unregisterCommands = mergeRegister(...commands)

    const element = onDoubleClick ? editor.getElementByKey(nodeKey) : null
    element?.addEventListener('dblclick', onDblClick)

    return () => {
      unregisterCommands()
      element?.removeEventListener('dblclick', onDblClick)
    }
  }, [editor, nodeKey, isEditable, active, deletable, onClick, onEnter, onDelete, onDblClick, onDoubleClick])

  return { isSelected, setSelected, clearSelection, isFocused }
}
