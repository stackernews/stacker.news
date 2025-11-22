import { useRef, useState } from 'react'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { $getNearestNodeFromDOMNode, $createParagraphNode } from 'lexical'
import styles from '@/components/lexical/theme/theme.module.css'
import DraggableIcon from '@/svgs/lexical/draggable.svg'
import { DraggableBlockPlugin_EXPERIMENTAL as LexicalDraggableBlockPlugin } from '@lexical/react/LexicalDraggableBlockPlugin'
import AddIcon from '@/svgs/add-fill.svg'

/**
 * checks if element is within the draggable block menu
 * @param {HTMLElement} element - dom element to check
 * @returns {boolean} true if element is in menu
 */
function isOnMenu (element) {
  return !!element.closest(`.${styles.draggableBlockMenu}`)
}

/**
 * plugin that enables drag-and-drop reordering of editor blocks

 * @param {HTMLElement} props.anchorElem - anchor element for positioning the drag menu
 * @returns {JSX.Element|null} draggable block plugin component or null
 */
export default function DraggableBlockPlugin ({ anchorElem }) {
  const [editor] = useLexicalComposerContext()
  const menuRef = useRef(null)
  const targetLineRef = useRef(null)
  const [draggableElement, setDraggableElement] = useState(null)

  /**
   * inserts a new paragraph block before or after the draggable element
   * @param {Event} e - click event (modifier keys control position)
   */
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
