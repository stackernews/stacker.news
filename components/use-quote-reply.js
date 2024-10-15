import { useCallback, useEffect, useRef, useState } from 'react'
import { quote as quoteMd } from '@/lib/md'

export function useQuoteReply ({ text }) {
  const ref = useRef(null)
  const [quote, setQuote] = useState(null)
  const [selection, setSelection] = useState(null)
  const to = useRef(null)

  const onSelectionChange = useCallback(e => {
    clearTimeout(to.current)
    const selection = window.getSelection()
    const selectedText = selection.isCollapsed ? undefined : selection.toString()
    const isSelectedTextInTarget = ref?.current?.contains(selection.anchorNode)

    if ((selection.isCollapsed || !isSelectedTextInTarget || !selectedText)) {
      // selection is collapsed or not in target or empty
      // but on button click we don't want to immediately clear selection
      to.current = setTimeout(() => setSelection(null), 1000)
      return
    }

    setSelection(selectedText)
  }, [ref?.current, setSelection])

  useEffect(() => {
    document.addEventListener('selectionchange', onSelectionChange)
    return () => document.removeEventListener('selectionchange', onSelectionChange)
  }, [])

  const quoteReply = useCallback(({ selectionOnly }) => {
    if (selectionOnly && !selection) return
    const textToQuote = selection || text
    setQuote(quoteMd(textToQuote))
  }, [selection, text])

  const cancelQuote = useCallback(() => {
    setQuote(null)
    setSelection(null)
  }, [setQuote, setSelection])

  return { ref, quote, quoteReply, cancelQuote }
}
