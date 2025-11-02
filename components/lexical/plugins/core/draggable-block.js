import { useRef, useState } from 'react'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { $getNearestNodeFromDOMNode, $createParagraphNode } from 'lexical'
import styles from '@/components/lexical/theme/theme.module.css'
import DraggableIcon from '@/svgs/lexical/draggable.svg'
import { DraggableBlockPlugin_EXPERIMENTAL as LexicalDraggableBlockPlugin } from '@lexical/react/LexicalDraggableBlockPlugin'
import AddIcon from '@/svgs/add-fill.svg'
function isOnMenu (element) {
  return !!element.closest(`.${styles.draggableBlockMenu}`)
}

// enables node dragging and dropping between blocks
// doesn't have good styling yet.
export default function DraggableBlockPlugin ({ anchorElem }) {
  const [editor] = useLexicalComposerContext()
  const menuRef = useRef(null)
  const targetLineRef = useRef(null)
  const [draggableElement, setDraggableElement] = useState(null)

  function insertBlock (e) {
    if (!draggableElement || !editor) return

    editor.update(() => {
      const node = $getNearestNodeFromDOMNode(draggableElement)
      if (!node) return

      const pNode = $createParagraphNode()
      if (e.altKey || e.ctrlKey || e.metaKey) {
        node.insertBefore(pNode)
      } else {
        node.insertAfter(pNode)
      }

      pNode.select()
    })
  }

  if (!anchorElem) return null

  return (
    <LexicalDraggableBlockPlugin
      anchorElem={anchorElem}
      menuRef={menuRef}
      targetLineRef={targetLineRef}
      menuComponent={
        <div ref={menuRef} className={styles.draggableBlockMenu}>
          <span title='click to add below' onClick={insertBlock} className={styles.draggableBlockMenuAdd}>
            <AddIcon />
          </span>
          <DraggableIcon />
        </div>
      }
      targetLineComponent={
        <div ref={targetLineRef} className={styles.draggableBlockTargetLine} />
      }
      isOnMenu={isOnMenu}
      onElementChanged={setDraggableElement}
    />
  )
}
