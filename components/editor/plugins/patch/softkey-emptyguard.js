import { useEffect } from 'react'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { $createRangeSelection, $setSelection, $getRoot, $isTextNode, $isParagraphNode } from 'lexical'

/**
 * Workaround to prevent a text node from becoming truly empty.
 *
 * This is necessary because some browser engines keep an editable area “non-empty”
 * by inserting placeholders. This might hijack the IME composition and cause unexpected behavior.
 */

// The character used as a guard. Ideally this would be non-printable, but I’ve found
// that some Android keyboards disable auto-correct and other features when a
// non-printable character is present in the text. A space seems to work best.
// TODO: experiment with other characters if issues arise.
const GUARD_CHARACTER = ' '

const GUARD_REGEX = new RegExp(GUARD_CHARACTER, 'g')
const GUARD_TAG = 'ensure-guard'

// recursively add the guard character at the end of every text node.
function ensureGuard (el) {
  if ($isTextNode(el)) {
    let content = el.getTextContent()
    if (GUARD_CHARACTER === ' ') { // special handling if the guard character is a space
      // ensure there is a guard character at the end
      if (!content.endsWith(GUARD_CHARACTER)) {
        content += GUARD_CHARACTER
        el.setTextContent(content)
      }
    } else {
      // remove all existing guard characters
      content = content.replace(GUARD_REGEX, '')
      // add a single guard character at the end
      content += GUARD_CHARACTER
      el.setTextContent(content)
    }
  } else {
    const children = el?.getChildren?.() || []
    for (const child of children) {
      ensureGuard(child)
    }
  }
}

function clearEditorIfEmpty (root) {
  const children = root.getChildren?.()
  if (children?.length !== 1) return
  // a single child

  const firstChildren = children[0]
  if (!$isParagraphNode(firstChildren)) return
  // that is a paragraph

  const grandChildren = firstChildren.getChildren()
  if (grandChildren?.length !== 1) return
  // with a single node

  const child = grandChildren[0]
  if (!$isTextNode(child)) return
  // that is a text node

  const content = child.getTextContent()
  if (GUARD_CHARACTER === ' ') {
    // special handling if the guard character is a space
    if (content.trim()) return
  } else {
    if (content !== GUARD_CHARACTER) return
  }
  // with a guard only or empty content:
  //     if we reached this point, it means the editor is effectively empty

  // reset the editor
  firstChildren.clear()

  // reset the selection
  const sel = $createRangeSelection()
  sel.anchor.set(root.getKey(), 0, 'element')
  sel.focus.set(root.getKey(), 0, 'element')
  $setSelection(sel)
}

export function SoftkeyEmptyGuardPlugin () {
  const [editor] = useLexicalComposerContext()

  useEffect(() => {
    const disposeListener = editor.registerUpdateListener(({ editorState, tags }) => {
      if (tags.has(GUARD_TAG)) return
      editor.update(() => {
        const root = $getRoot()
        if (root) {
          ensureGuard(root)
          clearEditorIfEmpty(root)
        }
      }, { tag: GUARD_TAG })
    })

    const disposeRootListener = editor.registerRootListener((root, prevRoot) => {
      editor.update(() => {
        if (root) {
          ensureGuard(root)
          clearEditorIfEmpty(root)
        }
      }, { tag: GUARD_TAG })
    })

    return () => {
      disposeListener()
      disposeRootListener()
    }
  }, [editor])

  return null
}
