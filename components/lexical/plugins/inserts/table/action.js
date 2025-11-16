import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { useLexicalEditable } from '@lexical/react/useLexicalEditable'
import {
  $getTableCellNodeFromLexicalNode,
  $getTableNodeFromLexicalNodeOrThrow,
  $isTableCellNode,
  $isTableSelection,
  getTableElement,
  getTableObserverFromTableElement,
  TableCellHeaderStates,
  TableCellNode
} from '@lexical/table'
import { mergeRegister } from '@lexical/utils'
import {
  $getSelection,
  $isRangeSelection,
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
import { SN_TABLE_INSERT_COMMAND, SN_TABLE_DELETE_COMMAND, SN_TABLE_HEADER_TOGGLE_COMMAND, SN_TABLE_MERGE_TOGGLE_COMMAND } from '@/lib/lexical/universal/commands/table'
import { $canUnmerge, computeSelectionCount } from '@/lib/lexical/universal/utils/table'
import { getShortcutCombo } from '@/lib/lexical/extensions/core/shortcuts/keyboard'

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
        updateSelectionCounts(currentSelectionCounts)
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

  const insertTableRowAtSelection = useCallback(
    (shouldInsertAfter) => {
      editor.dispatchCommand(SN_TABLE_INSERT_COMMAND, { type: 'row', selectionCounts, shouldInsertAfter })
      onClose()
    }, [editor, onClose, selectionCounts]
  )

  const insertTableColumnAtSelection = useCallback(
    (shouldInsertAfter) => {
      editor.dispatchCommand(SN_TABLE_INSERT_COMMAND, { type: 'column', selectionCounts, shouldInsertAfter })
      onClose()
    }, [editor, onClose, selectionCounts]
  )

  const deleteTableAtSelection = useCallback(() => {
    editor.dispatchCommand(SN_TABLE_DELETE_COMMAND, { type: 'table', tableCellNode })
    clearTableSelection()
    onClose()
  }, [editor, clearTableSelection, onClose])

  const toggleTableRowIsHeader = useCallback(() => {
    editor.dispatchCommand(SN_TABLE_HEADER_TOGGLE_COMMAND, { type: 'row', tableCellNode })
    clearTableSelection()
    onClose()
  }, [editor, clearTableSelection, onClose])

  const toggleTableColumnIsHeader = useCallback(() => {
    editor.dispatchCommand(SN_TABLE_HEADER_TOGGLE_COMMAND, { type: 'column', tableCellNode })
    clearTableSelection()
    onClose()
  }, [editor, clearTableSelection, onClose])

  return createPortal(
    <div ref={dropDownRef} className={styles.tableActionMenuWrapper}>
      <Dropdown.Menu
        className={styles.tableActionMenuDropdown}
        onClick={(e) => {
          e.stopPropagation()
        }}
      >
        {cellMerge && (canMergeCells || canUnmergeCell) && (
          <Dropdown.Item
            className={styles.tableActionMenuItem}
            onClick={() => {
              editor.dispatchCommand(SN_TABLE_MERGE_TOGGLE_COMMAND, selectionCounts)
              onClose()
            }}
          >
            <span className={styles.tableActionMenuLabel}>
              {canMergeCells ? 'merge cells' : canUnmergeCell ? 'unmerge cells' : ''}
              <span className={styles.tableActionMenuItemShortcut}>
                {getShortcutCombo('table-merge')}
              </span>
            </span>
          </Dropdown.Item>
        )}
        <Dropdown.Item
          className={styles.tableActionMenuItem}
          onClick={() => insertTableRowAtSelection(false)}
        >
          <span className={styles.tableActionMenuLabel}>
            insert{' '}
            {selectionCounts.rows === 1 ? 'row' : `${selectionCounts.rows} rows`}{' '}
            above
            <span className={styles.tableActionMenuItemShortcut}>
              {getShortcutCombo('table-insert-row')}
            </span>
          </span>
        </Dropdown.Item>
        <Dropdown.Item
          className={styles.tableActionMenuItem}
          onClick={() => insertTableRowAtSelection(true)}
        >
          <span className={styles.tableActionMenuLabel}>
            insert{' '}
            {selectionCounts.rows === 1 ? 'row' : `${selectionCounts.rows} rows`}{' '}
            below
            <span className={styles.tableActionMenuItemShortcut}>
              {getShortcutCombo('table-insert-row')}
            </span>
          </span>
        </Dropdown.Item>
        <hr className='dropdown-divider' />
        <Dropdown.Item
          className={styles.tableActionMenuItem}
          onClick={() => insertTableColumnAtSelection(false)}
        >
          <span className={styles.tableActionMenuLabel}>
            insert{' '}
            {selectionCounts.columns === 1 ? 'column' : `${selectionCounts.columns} columns`}{' '}
            left
            <span className={styles.tableActionMenuItemShortcut}>
              {getShortcutCombo('table-insert-column')}
            </span>
          </span>
        </Dropdown.Item>
        <Dropdown.Item
          className={styles.tableActionMenuItem}
          onClick={() => insertTableColumnAtSelection(true)}
        >
          <span className={styles.tableActionMenuLabel}>
            insert{' '}
            {selectionCounts.columns === 1 ? 'column' : `${selectionCounts.columns} columns`}{' '}
            right
            <span className={styles.tableActionMenuItemShortcut}>
              {getShortcutCombo('table-insert-column')}
            </span>
          </span>
        </Dropdown.Item>
        <hr className='dropdown-divider' />
        <Dropdown.Item
          className={styles.tableActionMenuItem}
          onClick={() => {
            editor.dispatchCommand(SN_TABLE_DELETE_COMMAND, { type: 'column' })
            onClose()
          }}
        >
          <span className={styles.tableActionMenuLabel}>
            delete column
            <span className={styles.tableActionMenuItemShortcut}>
              {getShortcutCombo('table-delete-column')}
            </span>
          </span>
        </Dropdown.Item>
        <Dropdown.Item
          className={styles.tableActionMenuItem}
          onClick={() => {
            editor.dispatchCommand(SN_TABLE_DELETE_COMMAND, { type: 'row' })
            onClose()
          }}
        >
          <span className={styles.tableActionMenuLabel}>
            <span className={styles.dropdownExtraItemText}>delete row</span>
            <span className={styles.tableActionMenuItemShortcut}>
              {getShortcutCombo('table-delete-row')}
            </span>
          </span>
        </Dropdown.Item>
        <Dropdown.Item
          className={styles.tableActionMenuItem}
          onClick={() => deleteTableAtSelection()}
        >
          <span className={styles.tableActionMenuLabel}>
            delete table
            <span className={styles.tableActionMenuItemShortcut}>
              {getShortcutCombo('table-delete')}
            </span>
          </span>
        </Dropdown.Item>
        <hr className='dropdown-divider' />
        <Dropdown.Item
          className={styles.tableActionMenuItem}
          onClick={() => toggleTableRowIsHeader()}
        >
          <span className={styles.tableActionMenuLabel}>
            {(tableCellNode.__headerState & TableCellHeaderStates.ROW) ===
            TableCellHeaderStates.ROW
              ? 'remove'
              : 'add'}{' '}
            row header
            <span className={styles.tableActionMenuItemShortcut}>
              {getShortcutCombo('table-header-toggle-row')}
            </span>
          </span>
        </Dropdown.Item>
        <Dropdown.Item
          className={styles.tableActionMenuItem}
          onClick={() => toggleTableColumnIsHeader()}
        >
          <span className={styles.tableActionMenuLabel}>
            {(tableCellNode.__headerState & TableCellHeaderStates.COLUMN) ===
            TableCellHeaderStates.COLUMN
              ? 'remove'
              : 'add'}{' '}
            column header
            <span className={styles.tableActionMenuItemShortcut}>
              {getShortcutCombo('table-header-toggle-column')}
            </span>
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
              {isMenuOpen && (
                <TableActionMenu
                  contextRef={menuRootRef}
                  setIsMenuOpen={setIsMenuOpen}
                  onClose={() => setIsMenuOpen(false)}
                  tableCellNode={tableCellNode}
                  cellMerge={cellMerge}
                />
              )}
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
