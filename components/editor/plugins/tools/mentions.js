import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import Dropdown from 'react-bootstrap/Dropdown'
import { useLazyQuery } from '@apollo/client'
import { LexicalTypeaheadMenuPlugin, MenuOption } from '@lexical/react/LexicalTypeaheadMenuPlugin'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { USER_SUGGESTIONS } from '@/fragments/users'
import { SUB_SUGGESTIONS } from '@/fragments/subs'
import styles from '@/lib/lexical/theme/editor.module.css'

/** regex to match \@user or \~sub mentions */
const MENTION_PATTERN = /(^|\s|\()([@~]\w{0,75})$/
const MAX_SUGGESTIONS = 5

/** takes the full \@user or \~sub and fetches the suggestions */
function useSuggestions ({ query }) {
  const [suggestions, setSuggestions] = useState([])

  const [getUserSuggestions] = useLazyQuery(USER_SUGGESTIONS, {
    onCompleted: data => query && data && setSuggestions(data.userSuggestions)
  })
  const [getSubSuggestions] = useLazyQuery(SUB_SUGGESTIONS, {
    onCompleted: data => query && data && setSuggestions(data.subSuggestions)
  })

  useEffect(() => {
    if (!query) {
      setSuggestions([])
      return
    }

    const q = query.slice(1)
    if (query.startsWith('@')) {
      getUserSuggestions({ variables: { q, limit: MAX_SUGGESTIONS } })
    } else if (query.startsWith('~')) {
      getSubSuggestions({ variables: { q, limit: MAX_SUGGESTIONS } })
    }
  }, [query, getUserSuggestions, getSubSuggestions])

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
              <Dropdown.Menu className={styles.suggestionsMenu}>
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
