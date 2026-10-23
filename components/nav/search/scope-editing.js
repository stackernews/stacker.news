import { useLayoutEffect, useState } from 'react'
import { SCOPES } from '@/lib/search'
import { useSearchState } from './state'
import { scopeHint } from './lookup'

// puts @ or ~ at the end of the text as a word of its own. it replaces one
// that's already there with nothing after it
export function appendPrefix (text, prefix) {
  const before = text.replace(/(^|\s)[@~]?\s*$/, '')
  return before ? `${before} ${prefix}` : prefix
}

// the text without the word from start to end and the spaces after it, and
// the caret where the word was
export function cutWord (text, start, end) {
  return { text: text.slice(0, start) + text.slice(end).trimStart(), caret: start }
}

const NO_GROUPS = []

// adds and removes chips, and adds a ~ or @ to the text. items is groups, or
// no rows for one render after a chip is added
export function useScopeEditing ({ lookup, groups, open, setCaret, inputRef }) {
  const { scope, text, setText, setScope } = useSearchState()
  // the value of the highlighted row
  const [highlighted, setHighlighted] = useState()

  // one render with no rows puts the highlight back on the first row
  const [resetHighlight, setResetHighlight] = useState(false)
  useLayoutEffect(() => {
    if (resetHighlight) setResetHighlight(false)
  }, [resetHighlight])

  // puts the prefix at the end of the text, with the caret after it
  const addPrefix = prefix => {
    const next = appendPrefix(text, prefix)
    setText(next)
    setCaret(next.length)
    inputRef.current?.focus()
  }

  // a stacker or territory that isn't a chip yet
  const canScope = item => SCOPES.some(({ type }) => type === item.type) &&
    scope[item.type]?.toLowerCase() !== item.name.toLowerCase()

  // makes the item a chip. the @name or ~name being typed leaves the text
  const addScope = item => {
    if (lookup.mode === 'name' && lookup.type === item.type) {
      const cut = cutWord(text, lookup.start, lookup.end)
      setText(cut.text)
      setCaret(cut.caret)
    }
    setScope({ [item.type]: item.name })
    setResetHighlight(true)
    inputRef.current?.focus()
  }

  // removes a chip and focuses the input
  const removeScope = type => {
    setScope({ [type]: undefined })
    inputRef.current?.focus()
  }

  // the stackers or territories of an @name or ~name, while the popup is open.
  // tab picks the highlighted one, or the first
  const tabItems = lookup.mode === 'name' && open ? groups[0]?.items ?? [] : []
  const tabItem = tabItems.find(item => item.value === highlighted) ?? tabItems[0]

  // tab makes the tab item a chip. backspace at the start of the text removes
  // the last chip, but not while it's held down
  const onKeyDown = event => {
    const input = event.currentTarget
    if (event.key === 'Tab' && !event.shiftKey && tabItem) {
      event.preventDefault()
      addScope(tabItem)
    } else if (event.key === 'Backspace' && !event.repeat && input.selectionStart === 0 && input.selectionEnd === 0) {
      const last = scope.user ? 'user' : scope.sub ? 'sub' : undefined
      if (!last) return
      event.preventDefault()
      removeScope(last)
    }
  }

  return {
    addPrefix,
    addScope,
    removeScope,
    canScope,
    onKeyDown,
    tabHint: tabItem && scopeHint(tabItem),
    onItemHighlighted: item => setHighlighted(item?.value),
    items: resetHighlight ? NO_GROUPS : groups
  }
}
