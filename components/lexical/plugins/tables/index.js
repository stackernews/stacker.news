import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { useEffect } from 'react'
import { useTableContext } from '@/components/lexical/contexts/table'
import { TableNode, TableCellNode, TableRowNode } from '@lexical/table'

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
