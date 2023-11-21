import { useCallback, useRef, useState } from 'react'
import { quote as quoteMd } from '../lib/md'

export function useQuoteReply ({ text }) {
  const ref = useRef(null)
  const [quote, setQuote] = useState(null)

  const quoteReply = useCallback(({ selectionOnly }) => {
    const selection = window.getSelection()
    const selectedText = selection.isCollapsed ? undefined : selection.toString()
    const isSelectedTextInTarget = ref?.current?.contains(selection.anchorNode)

    if ((selection.isCollapsed || !isSelectedTextInTarget || !selectedText) && selectionOnly) return

    const textToQuote = isSelectedTextInTarget ? selectedText : text
    setQuote(quoteMd(textToQuote))
  }, [ref?.current, text])

  const cancelQuote = useCallback(() => {
    setQuote(null)
  }, [])

  return { ref, quote, quoteReply, cancelQuote }
}
