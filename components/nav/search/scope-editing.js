import { useSearchState } from './state'

// puts @ or ~ at the end of the text as a word of its own. it replaces one
// that's already there with nothing after it
export function appendPrefix (text, prefix) {
  const before = text.replace(/(^|\s)[@~]?\s*$/, '')
  return before ? `${before} ${prefix}` : prefix
}

// changes to the text that start a ~territory or @nym lookup
export function useScopeEditing ({ setCaret, inputRef }) {
  const { text, setText } = useSearchState()

  // puts the prefix at the end of the text, with the caret after it
  const addPrefix = prefix => {
    const next = appendPrefix(text, prefix)
    setText(next)
    setCaret(next.length)
    inputRef.current?.focus()
  }

  return { addPrefix }
}
