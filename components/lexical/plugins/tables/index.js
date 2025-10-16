import { useEffect } from 'react'
import { TableCellNode, TableNode, TableRowNode } from '@lexical/table'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { useTableContext } from '@/components/lexical/contexts/table'

// TODO: unused
export function TablePlugin ({ cellConfig, children }) {
  const [editor] = useLexicalComposerContext()
  const tableContext = useTableContext()

  useEffect(() => {
    if (!editor.hasNodes([TableNode, TableCellNode, TableRowNode])) {
      throw new Error('TablePlugin requires TableNode, TableCellNode, and TableRowNode')
    }
  }, [editor])

  useEffect(() => {
    tableContext.set(cellConfig, children)
  }, [tableContext, cellConfig, children])

  return null
}
