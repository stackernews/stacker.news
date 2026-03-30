import { useCallback, useEffect, useRef, useState } from 'react'
import { quote as quoteMd } from '@/lib/md'
import { getMarkdownFromSelection } from '@/lib/lexical/utils/selection'

export function useQuoteReply ({ text, readerRef }) {
  const ref = useRef(null)
  const [quote, setQuote] = useState(null)
  const [selection, setSelection] = useState(null)
  const to = useRef(null)

  const onSelectionChange = useCallback(e => {
    clearTimeout(to.current)
    const domSelection = window.getSelection()
    const selectedText = domSelection.isCollapsed ? undefined : domSelection.toString()
    const isSelectedTextInTarget = ref?.current?.contains(domSelection.anchorNode)

    if ((domSelection.isCollapsed || !isSelectedTextInTarget || !selectedText)) {
      to.current = setTimeout(() => {
        setSelection(null)
      }, 1000)
      return
    }

    setSelection(selectedText)
  }, [ref?.current, setSelection])

  useEffect(() => {
    document.addEventListener('selectionchange', onSelectionChange)
    return () => document.removeEventListener('selectionchange', onSelectionChange)
  }, [onSelectionChange])

  const quoteReply = useCallback(({ selectionOnly }) => {
    if (selectionOnly && !selection) return
    let textToQuote = selection || text

    if (selection && readerRef) {
      const markdown = getMarkdownFromSelection(readerRef)
      if (markdown) {
        textToQuote = markdown
      }
    }

    setQuote(quoteMd(textToQuote))
  }, [selection, text, readerRef])

  const cancelQuote = useCallback(() => {
    setQuote(null)
    setSelection(null)
  }, [setQuote, setSelection])

  return { ref, quote, quoteReply, cancelQuote }
}
