import { useLexicalEditable } from '@lexical/react/useLexicalEditable'
import { createPortal } from 'react-dom'
import styles from '../../../theme/theme.module.css'
import useDebounceCallback from '@/components/use-debounce-callback'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { useState, useRef, useEffect, useMemo } from 'react'
import { IS_APPLE, mergeRegister, $findMatchingParent } from '@lexical/utils'
import { $isTableCellNode, $isTableNode, $getTableAndElementByKey, $getTableRowIndexFromTableCellNode, $getTableColumnIndexFromTableCellNode, getTableElement, $insertTableRowAtSelection, $insertTableColumnAtSelection, TableNode } from '@lexical/table'
import { $getNearestNodeFromDOMNode, isHTMLElement } from 'lexical'
import Add from '@/svgs/add-fill.svg'

const BUTTON_WIDTH_PX = 20

function getMouseInfo (event) {
  const target = event.target
  if (isHTMLElement(target)) {
    const tableDOMNode = target.closest('td.sn__tableCell, th.sn__tableCell')
    const isOutside = !(
      tableDOMNode ||
      target.closest(`span.${styles.tableAddRows}`) ||
      target.closest(`span.${styles.tableAddColumns}`) ||
      target.closest(`div.${styles.tableCellResizer}`)
    )
    return { tableDOMNode, isOutside }
  } else {
    return { tableDOMNode: null, isOutside: true }
  }
}

function TableHoverContent ({ anchorElem }) {
  const [editor] = useLexicalComposerContext()
  const isEditable = useLexicalEditable()
  const [isShownRow, setIsShownRow] = useState(false)
  const [isShownColumn, setIsShownColumn] = useState(false)
  const [shouldListenMouseMove, setShouldListenMouseMove] = useState(false)
  const [position, setPosition] = useState({})
  const tableSetRef = useRef(new Set())
  const tableCellDOMNodeRef = useRef(null)

  const debouncedOnMouseMove = useDebounceCallback((event) => {
    if (!event) return
    const { isOutside, tableDOMNode } = getMouseInfo(event)
    if (isOutside) {
      setIsShownRow(false)
      setIsShownColumn(false)
      return
    }

    if (!tableDOMNode) return

    tableCellDOMNodeRef.current = tableDOMNode
    let hoveredRowNode = null
    let hoveredColumnNode = null
    let tableDOMElement = null

    editor.getEditorState().read(() => {
      const maybeTableCell = $getNearestNodeFromDOMNode(tableDOMNode)
      if ($isTableCellNode(maybeTableCell)) {
        const table = $findMatchingParent(maybeTableCell, (node) => $isTableNode(node))
        if (!$isTableNode(table)) return

        tableDOMElement = getTableElement(table, editor.getElementByKey(table.getKey()))
        if (tableDOMElement) {
          const rowCount = table.getChildrenSize()
          const colCount = (table.getChildAtIndex(0))?.getChildrenSize()
          const rowIndex = $getTableRowIndexFromTableCellNode(maybeTableCell)
          const colIndex = $getTableColumnIndexFromTableCellNode(maybeTableCell)

          if (rowIndex === rowCount - 1) {
            hoveredRowNode = maybeTableCell
          } else if (colIndex === colCount - 1) {
            hoveredColumnNode = maybeTableCell
          }
        }
      }
    }, { editor })

    if (tableDOMElement) {
      const {
        width: tableElemWidth,
        y: tableElemY,
        right: tableElemRight,
        left: tableElemLeft,
        bottom: tableElemBottom,
        height: tableElemHeight
      } = tableDOMElement.getBoundingClientRect()

      const parentElement = tableDOMElement.parentElement
      let tableHasScroll = false
      if (parentElement && parentElement.classList.contains('sn__tableScrollableWrapper')) {
        tableHasScroll = parentElement.scrollWidth > parentElement.clientWidth
      }
      const { y: editorElemY, left: editorElemLeft } = anchorElem.getBoundingClientRect()

      if (hoveredRowNode) {
        setIsShownColumn(false)
        setIsShownRow(true)
        setPosition({
          height: BUTTON_WIDTH_PX,
          left: tableHasScroll && parentElement ? parentElement.offsetLeft : tableElemLeft - editorElemLeft,
          top: tableElemBottom - editorElemY + (tableHasScroll && !IS_APPLE ? 16 : 5),
          width: tableHasScroll && parentElement ? parentElement.offsetWidth : tableElemWidth
        })
      } else if (hoveredColumnNode) {
        setIsShownColumn(true)
        setIsShownRow(false)
        setPosition({
          height: tableElemHeight,
          left: tableElemRight - editorElemLeft + 5,
          top: tableElemY - editorElemY,
          width: BUTTON_WIDTH_PX
        })
      }
    }
  }, 50)

  const tableResizeObserver = useMemo(() => {
    return new window.ResizeObserver(() => {
      setIsShownRow(false)
      setIsShownColumn(false)
    })
  }, [])

  useEffect(() => {
    if (!shouldListenMouseMove) return

    document.addEventListener('mousemove', debouncedOnMouseMove)

    return () => {
      setIsShownRow(false)
      setIsShownColumn(false)
      document.removeEventListener('mousemove', debouncedOnMouseMove)
    }
  }, [shouldListenMouseMove, debouncedOnMouseMove])

  useEffect(() => {
    return mergeRegister(
      editor.registerMutationListener(TableNode, (mutations) => {
        editor.getEditorState().read(() => {
          let resetObserver = false
          for (const [key, type] of mutations) {
            switch (type) {
              case 'created': {
                tableSetRef.current.add(key)
                resetObserver = true
                break
              }
              case 'destroyed': {
                tableSetRef.current.delete(key)
                resetObserver = true
                break
              }
              default:
                break
            }
          }
          if (resetObserver) {
            tableResizeObserver.disconnect()
            for (const tableKey of tableSetRef.current) {
              const { tableElement } = $getTableAndElementByKey(tableKey)
              tableResizeObserver.observe(tableElement)
            }
            setShouldListenMouseMove(tableSetRef.current.size > 0)
          }
        }, { editor })
      }, { skipInitialization: false })
    )
  }, [editor, tableResizeObserver])

  const insertAction = (insertRow) => {
    editor.update(() => {
      if (tableCellDOMNodeRef.current) {
        const maybeTableNode = $getNearestNodeFromDOMNode(tableCellDOMNodeRef.current)
        maybeTableNode?.selectEnd()
        if (insertRow) {
          $insertTableRowAtSelection()
          setIsShownRow(false)
        } else {
          $insertTableColumnAtSelection()
          setIsShownColumn(false)
        }
      }
    })
  }

  if (!isEditable) {
    return null
  }

  return (
    <>
      {isShownRow && (
        <span
          className={styles.tableAddRows}
          style={position}
          onClick={() => insertAction(true)}
        >
          <Add />
        </span>
      )}
      {isShownColumn && (
        <span
          className={styles.tableAddColumns}
          style={position}
          onClick={() => insertAction(false)}
        >
          <Add />
        </span>
      )}
    </>
  )
}

export default function TableHoverPlugin ({ anchorElem }) {
  const isEditable = useLexicalEditable()

  return isEditable && anchorElem
    ? createPortal(
      <TableHoverContent anchorElem={anchorElem} />,
      anchorElem
    )
    : null
}
