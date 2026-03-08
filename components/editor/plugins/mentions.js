import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Dropdown from 'react-bootstrap/Dropdown'
import { useLazyQuery } from '@apollo/client'
import { LexicalTypeaheadMenuPlugin, MenuOption } from '@lexical/react/LexicalTypeaheadMenuPlugin'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import useDebounceCallback from '@/components/use-debounce-callback'
import { USER_SUGGESTIONS } from '@/fragments/users'
import { SUB_SUGGESTIONS } from '@/fragments/subs'
import styles from '@/lib/lexical/theme/editor.module.css'
import { BLUR_COMMAND, COMMAND_PRIORITY_HIGH } from 'lexical'

/** regex to match \@user or \~sub mentions */
const MENTION_PATTERN = /(^|\s|\()([@~]\w{0,75})$/
const MAX_SUGGESTIONS = 5
const SUGGESTION_DEBOUNCE_MS = 150

function getSuggestionLookup (trigger, getUserSuggestions, getSubSuggestions) {
  switch (trigger) {
    case '@':
      return { getSuggestions: getUserSuggestions, itemsField: 'userSuggestions' }
    case '~':
      return { getSuggestions: getSubSuggestions, itemsField: 'subSuggestions' }
    default:
      return null
  }
}

/** takes the full \@user or \~sub and fetches the suggestions */
function useSuggestions ({ query }) {
  const [suggestions, setSuggestions] = useState([])
  const requestIdRef = useRef(0)

  const [getUserSuggestions] = useLazyQuery(USER_SUGGESTIONS)
  const [getSubSuggestions] = useLazyQuery(SUB_SUGGESTIONS)
  const setCurrentSuggestions = useCallback((requestId, nextSuggestions = []) => {
    if (requestId === requestIdRef.current) {
      setSuggestions(nextSuggestions)
    }
  }, [])

  const fetchSuggestions = useDebounceCallback(async (nextQuery, requestId) => {
    const lookup = getSuggestionLookup(nextQuery[0], getUserSuggestions, getSubSuggestions)

    if (!lookup) {
      setCurrentSuggestions(requestId)
      return
    }

    try {
      const { data } = await lookup.getSuggestions({
        variables: { q: nextQuery.slice(1), limit: MAX_SUGGESTIONS }
      })
      setCurrentSuggestions(requestId, data?.[lookup.itemsField] || [])
    } catch {
      setCurrentSuggestions(requestId)
    }
  }, SUGGESTION_DEBOUNCE_MS, [getUserSuggestions, getSubSuggestions, setCurrentSuggestions])

  useEffect(() => {
    if (!query) {
      requestIdRef.current += 1
      fetchSuggestions.cancel()
      setSuggestions([])
      return
    }

    const requestId = requestIdRef.current + 1
    requestIdRef.current = requestId
    fetchSuggestions(query, requestId)

    return () => fetchSuggestions.cancel()
  }, [query, fetchSuggestions])

  return suggestions
}

/** tests if the text is of the form \@user or \~sub via MENTION_PATTERN,
 * and returns the match object for the TypeaheadMenuPlugin */
function testQueryMatch (text) {
  const match = MENTION_PATTERN.exec(text)
  if (match) {
    const leadingWhiteSpace = match[1]
    const fullMention = match[2]

    if (fullMention?.length >= 2) {
      return {
        leadOffset: match.index + leadingWhiteSpace.length,
        matchingString: fullMention,
        replaceableString: fullMention
      }
    }
  }
  return null
}

// custom MenuOption class for LexicalTypeaheadMenuPlugin
class MentionOption extends MenuOption {
  name

  constructor (name) {
    super(name)
    this.name = name
  }
}

export default function MentionsPlugin () {
  const [editor] = useLexicalComposerContext()
  const [query, setQuery] = useState(null)
  const suggestions = useSuggestions({ query })

  // close menu on blur
  useEffect(() => {
    return editor.registerCommand(BLUR_COMMAND, () => {
      setQuery(null)
      return false // let other handlers handle the blur
    }, COMMAND_PRIORITY_HIGH)
  }, [editor])

  const options = useMemo(() => {
    if (!suggestions?.length) return []
    return suggestions.map(s => new MentionOption(s.name))
  }, [suggestions])

  const onSelect = useCallback((selectedOption, nodeToReplace, closeMenu) => {
    editor.update(() => {
      if (nodeToReplace) {
        const trigger = query?.[0] || '@'
        const mention = `${trigger}${selectedOption.key} `
        nodeToReplace.setTextContent(mention)
        nodeToReplace.select()
      }
      closeMenu()
    })
  }, [editor, query])

  return (
    <LexicalTypeaheadMenuPlugin
      onQueryChange={setQuery}
      onSelectOption={onSelect}
      triggerFn={testQueryMatch}
      options={options}
      menuRenderFn={(
        anchorElementRef,
        { selectedIndex, selectOptionAndCleanUp, setHighlightedIndex }
      ) =>
        anchorElementRef.current && suggestions?.length
          ? createPortal(
            <Dropdown show style={{ zIndex: 1000 }}>
              <Dropdown.Menu className={styles.suggestionsMenu} onMouseDown={e => e.preventDefault()}>
                {options.map((o, i) =>
                  <Dropdown.Item
                    key={o.key}
                    active={selectedIndex === i}
                    onClick={() => {
                      setHighlightedIndex(i)
                      selectOptionAndCleanUp(o)
                    }}
                  >
                    {o.name}
                  </Dropdown.Item>)}
              </Dropdown.Menu>
            </Dropdown>, anchorElementRef.current)
          : null}
    />
  )
}
