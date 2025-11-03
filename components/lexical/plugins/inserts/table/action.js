import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { useLexicalEditable } from '@lexical/react/useLexicalEditable'
import {
  $computeTableMapSkipCellCheck,
  $deleteTableColumnAtSelection,
  $deleteTableRowAtSelection,
  $getNodeTriplet,
  $getTableCellNodeFromLexicalNode,
  $getTableColumnIndexFromTableCellNode,
  $getTableNodeFromLexicalNodeOrThrow,
  $getTableRowIndexFromTableCellNode,
  $insertTableColumnAtSelection,
  $insertTableRowAtSelection,
  $isTableCellNode,
  $isTableSelection,
  $mergeCells,
  $unmergeCell,
  getTableElement,
  getTableObserverFromTableElement,
  TableCellHeaderStates,
  TableCellNode
} from '@lexical/table'
import { mergeRegister } from '@lexical/utils'
import {
  $getSelection,
  $isElementNode,
  $isRangeSelection,
  $isTextNode,
  $setSelection,
  COMMAND_PRIORITY_CRITICAL,
  getDOMSelection,
  isDOMNode,
  SELECTION_CHANGE_COMMAND
} from 'lexical'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import styles from '../../../theme/theme.module.css'
import More from '@/svgs/more-fill.svg'
import ActionTooltip from '@/components/action-tooltip'
import Dropdown from 'react-bootstrap/Dropdown'

function computeSelectionCount (selection) {
  const selectionShape = selection.getShape()
  return {
    columns: selectionShape.toX - selectionShape.fromX + 1,
    rows: selectionShape.toY - selectionShape.fromY + 1
  }
}

function $canUnmerge () {
  const selection = $getSelection()
  if (
    ($isRangeSelection(selection) && !selection.isCollapsed()) ||
    ($isTableSelection(selection) && !selection.anchor.is(selection.focus)) ||
    (!$isRangeSelection(selection) && !$isTableSelection(selection))
  ) {
    return false
  }
  const [cell] = $getNodeTriplet(selection.anchor)
  return cell.__colSpan > 1 || cell.__rowSpan > 1
}

function $selectLastDescendant (node) {
  const lastDescendant = node.getLastDescendant()
  if ($isTextNode(lastDescendant)) {
    lastDescendant.select()
  } else if ($isElementNode(lastDescendant)) {
    lastDescendant.selectEnd()
  } else if (lastDescendant !== null) {
    lastDescendant.selectNext()
  }
}

function TableActionMenu ({
  onClose,
  tableCellNode: _tableCellNode,
  setIsMenuOpen,
  contextRef,
  cellMerge
}) {
  const [editor] = useLexicalComposerContext()
  const dropDownRef = useRef(null)
  const [tableCellNode, updateTableCellNode] = useState(_tableCellNode)
  const [selectionCounts, updateSelectionCounts] = useState({
    columns: 1,
    rows: 1
  })
  const [canMergeCells, setCanMergeCells] = useState(false)
  const [canUnmergeCell, setCanUnmergeCell] = useState(false)

  useEffect(() => {
    return editor.registerMutationListener(
      TableCellNode,
      (nodeMutations) => {
        const nodeUpdated =
          nodeMutations.get(tableCellNode.getKey()) === 'updated'

        if (nodeUpdated) {
          editor.getEditorState().read(() => {
            updateTableCellNode(tableCellNode.getLatest())
          })
        }
      },
      { skipInitialization: true }
    )
  }, [editor, tableCellNode])

  useEffect(() => {
    editor.getEditorState().read(() => {
      const selection = $getSelection()
      // lexical notes
      // Merge cells
      if ($isTableSelection(selection)) {
        const currentSelectionCounts = computeSelectionCount(selection)
        updateSelectionCounts(computeSelectionCount(selection))
        setCanMergeCells(
          currentSelectionCounts.columns > 1 || currentSelectionCounts.rows > 1
        )
      }
      // lexical notes
      // Unmerge cell
      setCanUnmergeCell($canUnmerge())
    })
  }, [editor])

  useEffect(() => {
    const menuButtonElement = contextRef.current
    const dropDownElement = dropDownRef.current
    const rootElement = editor.getRootElement()

    if (
      menuButtonElement != null &&
      dropDownElement != null &&
      rootElement != null
    ) {
      const rootEleRect = rootElement.getBoundingClientRect()
      const menuButtonRect = menuButtonElement.getBoundingClientRect()
      dropDownElement.style.opacity = '1'
      const dropDownElementRect = dropDownElement.getBoundingClientRect()
      const margin = 5
      let leftPosition = menuButtonRect.right + margin
      if (
        leftPosition + dropDownElementRect.width > window.innerWidth ||
        leftPosition + dropDownElementRect.width > rootEleRect.right
      ) {
        const position =
          menuButtonRect.left - dropDownElementRect.width - margin
        leftPosition = (position < 0 ? margin : position) + window.pageXOffset
      }
      dropDownElement.style.left = `${leftPosition + window.pageXOffset}px`

      let topPosition = menuButtonRect.top
      if (topPosition + dropDownElementRect.height > window.innerHeight) {
        const position = menuButtonRect.bottom - dropDownElementRect.height
        topPosition = position < 0 ? margin : position
      }
      dropDownElement.style.top = `${topPosition}px`
    }
  }, [contextRef, dropDownRef, editor])

  useEffect(() => {
    function handleClickOutside (event) {
      if (
        dropDownRef.current != null &&
        contextRef.current != null &&
        isDOMNode(event.target) &&
        !dropDownRef.current.contains(event.target) &&
        !contextRef.current.contains(event.target)
      ) {
        setIsMenuOpen(false)
      }
    }

    window.addEventListener('click', handleClickOutside)

    return () => window.removeEventListener('click', handleClickOutside)
  }, [setIsMenuOpen, contextRef])

  const clearTableSelection = useCallback(() => {
    editor.update(() => {
      if (tableCellNode.isAttached()) {
        const tableNode = $getTableNodeFromLexicalNodeOrThrow(tableCellNode)
        const tableElement = getTableElement(
          tableNode,
          editor.getElementByKey(tableNode.getKey())
        )

        if (tableElement === null) {
          throw new Error(
            'TableActionMenu: Expected to find tableElement in DOM'
          )
        }

        const tableObserver = getTableObserverFromTableElement(tableElement)
        if (tableObserver !== null) {
          tableObserver.$clearHighlight()
        }

        tableNode.markDirty()
        updateTableCellNode(tableCellNode.getLatest())
      }
      $setSelection(null)
    })
  }, [editor, tableCellNode])

  const mergeTableCellsAtSelection = () => {
    editor.update(() => {
      const selection = $getSelection()
      if (!$isTableSelection(selection)) {
        return
      }

      const nodes = selection.getNodes()
      const tableCells = nodes.filter($isTableCellNode)
      const targetCell = $mergeCells(tableCells)

      if (targetCell) {
        $selectLastDescendant(targetCell)
        onClose()
      }
    })
  }

  const unmergeTableCellsAtSelection = () => {
    editor.update(() => {
      $unmergeCell()
    })
  }

  const insertTableRowAtSelection = useCallback(
    (shouldInsertAfter) => {
      editor.update(() => {
        for (let i = 0; i < selectionCounts.rows; i++) {
          $insertTableRowAtSelection(shouldInsertAfter)
        }
        onClose()
      })
    },
    [editor, onClose, selectionCounts.rows]
  )

  const insertTableColumnAtSelection = useCallback(
    (shouldInsertAfter) => {
      editor.update(() => {
        for (let i = 0; i < selectionCounts.columns; i++) {
          $insertTableColumnAtSelection(shouldInsertAfter)
        }
        onClose()
      })
    },
    [editor, onClose, selectionCounts.columns]
  )

  const deleteTableRowAtSelection = useCallback(() => {
    editor.update(() => {
      $deleteTableRowAtSelection()
      onClose()
    })
  }, [editor, onClose])

  const deleteTableAtSelection = useCallback(() => {
    editor.update(() => {
      const tableNode = $getTableNodeFromLexicalNodeOrThrow(tableCellNode)
      tableNode.remove()

      clearTableSelection()
      onClose()
    })
  }, [editor, tableCellNode, clearTableSelection, onClose])

  const deleteTableColumnAtSelection = useCallback(() => {
    editor.update(() => {
      $deleteTableColumnAtSelection()
      onClose()
    })
  }, [editor, onClose])

  const toggleTableRowIsHeader = useCallback(() => {
    editor.update(() => {
      const tableNode = $getTableNodeFromLexicalNodeOrThrow(tableCellNode)

      const tableRowIndex = $getTableRowIndexFromTableCellNode(tableCellNode)

      const [gridMap] = $computeTableMapSkipCellCheck(tableNode, null, null)

      const rowCells = new Set()

      const newStyle =
        tableCellNode.getHeaderStyles() ^ TableCellHeaderStates.ROW

      for (let col = 0; col < gridMap[tableRowIndex].length; col++) {
        const mapCell = gridMap[tableRowIndex][col]

        if (!mapCell?.cell) {
          continue
        }

        if (!rowCells.has(mapCell.cell)) {
          rowCells.add(mapCell.cell)
          mapCell.cell.setHeaderStyles(newStyle, TableCellHeaderStates.ROW)
        }
      }
      clearTableSelection()
      onClose()
    })
  }, [editor, tableCellNode, clearTableSelection, onClose])

  const toggleTableColumnIsHeader = useCallback(() => {
    editor.update(() => {
      const tableNode = $getTableNodeFromLexicalNodeOrThrow(tableCellNode)

      const tableColumnIndex =
        $getTableColumnIndexFromTableCellNode(tableCellNode)

      const [gridMap] = $computeTableMapSkipCellCheck(tableNode, null, null)

      const columnCells = new Set()
      const newStyle =
        tableCellNode.getHeaderStyles() ^ TableCellHeaderStates.COLUMN

      for (let row = 0; row < gridMap.length; row++) {
        const mapCell = gridMap[row][tableColumnIndex]

        if (!mapCell?.cell) {
          continue
        }

        if (!columnCells.has(mapCell.cell)) {
          columnCells.add(mapCell.cell)
          mapCell.cell.setHeaderStyles(newStyle, TableCellHeaderStates.COLUMN)
        }
      }
      clearTableSelection()
      onClose()
    })
  }, [editor, tableCellNode, clearTableSelection, onClose])

  const toggleRowStriping = useCallback(() => {
    editor.update(() => {
      if (tableCellNode.isAttached()) {
        const tableNode = $getTableNodeFromLexicalNodeOrThrow(tableCellNode)
        if (tableNode) {
          tableNode.setRowStriping(!tableNode.getRowStriping())
        }
      }
      clearTableSelection()
      onClose()
    })
  }, [editor, tableCellNode, clearTableSelection, onClose])

  const toggleFirstRowFreeze = useCallback(() => {
    editor.update(() => {
      if (tableCellNode.isAttached()) {
        const tableNode = $getTableNodeFromLexicalNodeOrThrow(tableCellNode)
        if (tableNode) {
          tableNode.setFrozenRows(tableNode.getFrozenRows() === 0 ? 1 : 0)
        }
      }
      clearTableSelection()
      onClose()
    })
  }, [editor, tableCellNode, clearTableSelection, onClose])

  const toggleFirstColumnFreeze = useCallback(() => {
    editor.update(() => {
      if (tableCellNode.isAttached()) {
        const tableNode = $getTableNodeFromLexicalNodeOrThrow(tableCellNode)
        if (tableNode) {
          tableNode.setFrozenColumns(
            tableNode.getFrozenColumns() === 0 ? 1 : 0
          )
        }
      }
      clearTableSelection()
      onClose()
    })
  }, [editor, tableCellNode, clearTableSelection, onClose])

  const formatVerticalAlign = (value) => {
    editor.update(() => {
      const selection = $getSelection()
      if ($isRangeSelection(selection) || $isTableSelection(selection)) {
        const [cell] = $getNodeTriplet(selection.anchor)
        if ($isTableCellNode(cell)) {
          cell.setVerticalAlign(value)
        }

        if ($isTableSelection(selection)) {
          const nodes = selection.getNodes()

          for (let i = 0; i < nodes.length; i++) {
            const node = nodes[i]
            if ($isTableCellNode(node)) {
              node.setVerticalAlign(value)
            }
          }
        }
      }
    })
  }

  let mergeCellButton = null
  if (cellMerge) {
    if (canMergeCells) {
      mergeCellButton = (
        <Dropdown.Item
          type='button'
          className={styles.tableActionMenuItem}
          onClick={() => mergeTableCellsAtSelection()}
          data-test-id='table-merge-cells'
        >
          <span className={styles.text}>Merge cells</span>
        </Dropdown.Item>
      )
    } else if (canUnmergeCell) {
      mergeCellButton = (
        <Dropdown.Item
          type='button'
          className={styles.tableActionMenuItem}
          onClick={() => unmergeTableCellsAtSelection()}
          data-test-id='table-unmerge-cells'
        >
          <span className={styles.text}>Unmerge cells</span>
        </Dropdown.Item>
      )
    }
  }

  return createPortal(
    <div ref={dropDownRef} className={styles.tableActionMenuWrapper}>
      <Dropdown.Menu
        className={styles.tableActionMenuDropdown}
        onClick={(e) => {
          e.stopPropagation()
        }}
      >
        {mergeCellButton}
        <Dropdown.Item
          type='button'
          className={styles.tableActionMenuItem}
          onClick={() => toggleRowStriping()}
          data-test-id='table-row-striping'
        >
          <span className={styles.text}>Toggle Row Striping</span>
        </Dropdown.Item>
        <div className={styles.tableActionMenuGroup}>
          <div className={styles.tableActionMenuLabel}>Vertical Align</div>
          <Dropdown.Item
            type='button'
            className={styles.tableActionMenuItem}
            onClick={() => formatVerticalAlign('top')}
          >
            <span className={styles.text}>Top Align</span>
          </Dropdown.Item>
          <Dropdown.Item
            type='button'
            className={styles.tableActionMenuItem}
            onClick={() => formatVerticalAlign('middle')}
          >
            <span className={styles.text}>Middle Align</span>
          </Dropdown.Item>
          <Dropdown.Item
            type='button'
            className={styles.tableActionMenuItem}
            onClick={() => formatVerticalAlign('bottom')}
          >
            <span className={styles.text}>Bottom Align</span>
          </Dropdown.Item>
        </div>
        <Dropdown.Item
          type='button'
          className={styles.tableActionMenuItem}
          onClick={() => toggleFirstRowFreeze()}
          data-test-id='table-freeze-first-row'
        >
          <span className={styles.text}>Toggle First Row Freeze</span>
        </Dropdown.Item>
        <Dropdown.Item
          type='button'
          className={styles.tableActionMenuItem}
          onClick={() => toggleFirstColumnFreeze()}
          data-test-id='table-freeze-first-column'
        >
          <span className={styles.text}>Toggle First Column Freeze</span>
        </Dropdown.Item>
        <hr className={styles.tableActionMenuDivider} />
        <Dropdown.Item
          type='button'
          className={styles.tableActionMenuItem}
          onClick={() => insertTableRowAtSelection(false)}
          data-test-id='table-insert-row-above'
        >
          <span className={styles.text}>
            Insert{' '}
            {selectionCounts.rows === 1 ? 'row' : `${selectionCounts.rows} rows`}{' '}
            above
          </span>
        </Dropdown.Item>
        <Dropdown.Item
          type='button'
          className={styles.tableActionMenuItem}
          onClick={() => insertTableRowAtSelection(true)}
          data-test-id='table-insert-row-below'
        >
          <span className={styles.text}>
            Insert{' '}
            {selectionCounts.rows === 1 ? 'row' : `${selectionCounts.rows} rows`}{' '}
            below
          </span>
        </Dropdown.Item>
        <hr className={styles.tableActionMenuDivider} />
        <Dropdown.Item
          type='button'
          className={styles.tableActionMenuItem}
          onClick={() => insertTableColumnAtSelection(false)}
          data-test-id='table-insert-column-before'
        >
          <span className={styles.text}>
            Insert{' '}
            {selectionCounts.columns === 1
              ? 'column'
              : `${selectionCounts.columns} columns`}{' '}
            left
          </span>
        </Dropdown.Item>
        <Dropdown.Item
          type='button'
          className={styles.tableActionMenuItem}
          onClick={() => insertTableColumnAtSelection(true)}
          data-test-id='table-insert-column-after'
        >
          <span className={styles.text}>
            Insert{' '}
            {selectionCounts.columns === 1
              ? 'column'
              : `${selectionCounts.columns} columns`}{' '}
            right
          </span>
        </Dropdown.Item>
        <hr className={styles.tableActionMenuDivider} />
        <Dropdown.Item
          type='button'
          className={styles.tableActionMenuItem}
          onClick={() => deleteTableColumnAtSelection()}
          data-test-id='table-delete-columns'
        >
          <span className={styles.text}>Delete column</span>
        </Dropdown.Item>
        <Dropdown.Item
          type='button'
          className={styles.tableActionMenuItem}
          onClick={() => deleteTableRowAtSelection()}
          data-test-id='table-delete-rows'
        >
          <span className={styles.text}>Delete row</span>
        </Dropdown.Item>
        <Dropdown.Item
          type='button'
          className={styles.tableActionMenuItem}
          onClick={() => deleteTableAtSelection()}
          data-test-id='table-delete'
        >
          <span className={styles.text}>Delete table</span>
        </Dropdown.Item>
        <hr className={styles.tableActionMenuDivider} />
        <Dropdown.Item
          type='button'
          className={styles.tableActionMenuItem}
          onClick={() => toggleTableRowIsHeader()}
          data-test-id='table-row-header'
        >
          <span className={styles.text}>
            {(tableCellNode.__headerState & TableCellHeaderStates.ROW) ===
            TableCellHeaderStates.ROW
              ? 'Remove'
              : 'Add'}{' '}
            row header
          </span>
        </Dropdown.Item>
        <Dropdown.Item
          type='button'
          className={styles.tableActionMenuItem}
          onClick={() => toggleTableColumnIsHeader()}
          data-test-id='table-column-header'
        >
          <span className={styles.text}>
            {(tableCellNode.__headerState & TableCellHeaderStates.COLUMN) ===
            TableCellHeaderStates.COLUMN
              ? 'Remove'
              : 'Add'}{' '}
            column header
          </span>
        </Dropdown.Item>
      </Dropdown.Menu>
    </div>,
    document.body
  )
}

function TableCellActionMenuContainer ({
  anchorElem,
  cellMerge
}) {
  const [editor] = useLexicalComposerContext()

  const menuButtonRef = useRef(null)
  const menuRootRef = useRef(null)
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  const [tableCellNode, setTableMenuCellNode] = useState(null)

  const checkTableCellOverflow = useCallback(
    (tableCellParentNodeDOM) => {
      const scrollableContainer = tableCellParentNodeDOM.closest(
        '.sn__tableScrollableWrapper'
      )
      if (scrollableContainer) {
        const containerRect = scrollableContainer.getBoundingClientRect()
        const cellRect = tableCellParentNodeDOM.getBoundingClientRect()

        // lexical notes
        // Calculate where the action button would be positioned (5px from right edge of cell)
        // Also account for the button width and table cell padding (8px)
        const actionButtonRight = cellRect.right - 5
        const actionButtonLeft = actionButtonRight - 28 // 20px width + 8px padding

        // lexical notes
        // Only hide if the action button would overflow the container
        if (
          actionButtonRight > containerRect.right ||
          actionButtonLeft < containerRect.left
        ) {
          return true
        }
      }
      return false
    },
    []
  )

  const $moveMenu = useCallback(() => {
    const menu = menuButtonRef.current
    const selection = $getSelection()
    const nativeSelection = getDOMSelection(editor._window)
    const activeElement = document.activeElement
    function disable () {
      if (menu) {
        menu.classList.remove(styles.tableCellActionButtonContainerActive)
        menu.classList.add(styles.tableCellActionButtonContainerInactive)
      }
      setTableMenuCellNode(null)
    }

    if (selection == null || menu == null) {
      return disable()
    }

    const rootElement = editor.getRootElement()
    let tableObserver = null
    let tableCellParentNodeDOM = null

    if (
      $isRangeSelection(selection) &&
      rootElement !== null &&
      nativeSelection !== null &&
      rootElement.contains(nativeSelection.anchorNode)
    ) {
      const tableCellNodeFromSelection = $getTableCellNodeFromLexicalNode(
        selection.anchor.getNode()
      )

      if (tableCellNodeFromSelection == null) {
        return disable()
      }

      tableCellParentNodeDOM = editor.getElementByKey(
        tableCellNodeFromSelection.getKey()
      )

      if (
        tableCellParentNodeDOM == null ||
        !tableCellNodeFromSelection.isAttached()
      ) {
        return disable()
      }

      if (checkTableCellOverflow(tableCellParentNodeDOM)) {
        return disable()
      }

      const tableNode = $getTableNodeFromLexicalNodeOrThrow(
        tableCellNodeFromSelection
      )
      const tableElement = getTableElement(
        tableNode,
        editor.getElementByKey(tableNode.getKey())
      )

      if (tableElement === null) {
        throw new Error(
          'TableActionMenu: Expected to find tableElement in DOM'
        )
      }

      tableObserver = getTableObserverFromTableElement(tableElement)
      setTableMenuCellNode(tableCellNodeFromSelection)
    } else if ($isTableSelection(selection)) {
      const anchorNode = $getTableCellNodeFromLexicalNode(
        selection.anchor.getNode()
      )
      if (!$isTableCellNode(anchorNode)) {
        throw new Error('TableSelection anchorNode must be a TableCellNode')
      }
      const tableNode = $getTableNodeFromLexicalNodeOrThrow(anchorNode)
      const tableElement = getTableElement(
        tableNode,
        editor.getElementByKey(tableNode.getKey())
      )
      if (tableElement === null) {
        throw new Error(
          'TableActionMenu: Expected to find tableElement in DOM'
        )
      }
      tableObserver = getTableObserverFromTableElement(tableElement)
      tableCellParentNodeDOM = editor.getElementByKey(anchorNode.getKey())

      if (tableCellParentNodeDOM === null) {
        return disable()
      }

      if (checkTableCellOverflow(tableCellParentNodeDOM)) {
        return disable()
      }
    } else if (!activeElement) {
      return disable()
    }
    if (tableObserver === null || tableCellParentNodeDOM === null) {
      return disable()
    }
    const enabled = !tableObserver || !tableObserver.isSelecting
    menu.classList.toggle(
      styles.tableCellActionButtonContainerActive,
      enabled
    )
    menu.classList.toggle(
      styles.tableCellActionButtonContainerInactive,
      !enabled
    )
    if (enabled) {
      const tableCellRect = tableCellParentNodeDOM.getBoundingClientRect()
      const anchorRect = anchorElem.getBoundingClientRect()
      const top = tableCellRect.top - anchorRect.top
      const left = tableCellRect.right - anchorRect.left
      menu.style.transform = `translate(${left}px, ${top}px)`
    }
  }, [editor, anchorElem, checkTableCellOverflow])

  useEffect(() => {
    // lexical notes
    // We call the $moveMenu callback every time the selection changes,
    // once up front, and once after each pointerUp
    let timeoutId
    const callback = () => {
      timeoutId = undefined
      editor.getEditorState().read($moveMenu)
    }
    const delayedCallback = () => {
      if (timeoutId === undefined) {
        timeoutId = setTimeout(callback, 0)
      }
      return false
    }
    return mergeRegister(
      editor.registerUpdateListener(delayedCallback),
      editor.registerCommand(
        SELECTION_CHANGE_COMMAND,
        delayedCallback,
        COMMAND_PRIORITY_CRITICAL
      ),
      editor.registerRootListener((rootElement, prevRootElement) => {
        if (prevRootElement) {
          prevRootElement.removeEventListener('pointerup', delayedCallback)
        }
        if (rootElement) {
          rootElement.addEventListener('pointerup', delayedCallback)
          delayedCallback()
        }
      }),
      () => clearTimeout(timeoutId)
    )
  })

  const prevTableCellDOM = useRef(tableCellNode)

  useEffect(() => {
    if (prevTableCellDOM.current !== tableCellNode) {
      setIsMenuOpen(false)
    }

    prevTableCellDOM.current = tableCellNode
  }, [prevTableCellDOM, tableCellNode])

  return (
    <div className={styles.tableCellActionButtonContainer} ref={menuButtonRef}>
      {tableCellNode != null && (
        <>
          <ActionTooltip notForm overlayText='table action menu' placement='top' noWrapper showDelay={500} transition>
            <Dropdown drop='up' className='pointer' as='span' onToggle={(isOpen) => setIsMenuOpen(isOpen)} show={isMenuOpen}>
              <Dropdown.Toggle ref={menuRootRef} as='a' onPointerDown={e => e.preventDefault()} className={styles.tableCellActionButtonContainer}>
                <span className={styles.tableCellActionButton}>
                  <More />
                </span>
              </Dropdown.Toggle>
              <TableActionMenu
                contextRef={menuRootRef}
                setIsMenuOpen={setIsMenuOpen}
                onClose={() => setIsMenuOpen(false)}
                tableCellNode={tableCellNode}
                cellMerge={cellMerge}
              />
            </Dropdown>
          </ActionTooltip>
        </>
      )}
    </div>
  )
}

export default function TableActionMenuPlugin ({
  anchorElem = document.body,
  cellMerge = false
}) {
  const isEditable = useLexicalEditable()

  if (!anchorElem) return null

  return createPortal(
    isEditable
      ? (
        <TableCellActionMenuContainer
          anchorElem={anchorElem}
          cellMerge={cellMerge}
        />
        )
      : null,
    anchorElem
  )
}
