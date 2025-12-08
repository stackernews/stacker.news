import { createPortal } from 'react-dom'
import { LexicalTypeaheadMenuPlugin, MenuOption } from '@lexical/react/LexicalTypeaheadMenuPlugin'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { useCallback, useEffect, useMemo, useState } from 'react'
import Dropdown from 'react-bootstrap/Dropdown'
import styles from '@/lib/lexical/theme/editor.module.css'
import { useLazyQuery } from '@apollo/client'
import { USER_SUGGESTIONS } from '@/fragments/users'
import { SUB_SUGGESTIONS } from '@/fragments/subs'

function useSuggestions ({ query }) {
  const [suggestions, setSuggestions] = useState([])

  const params = useMemo(() => {
    if (!query) return null

    if (query.startsWith('@')) {
      return {
        suggestionsQuery: USER_SUGGESTIONS,
        itemsField: 'userSuggestions'
      }
    } else if (query.startsWith('~')) {
      return {
        suggestionsQuery: SUB_SUGGESTIONS,
        itemsField: 'subSuggestions'
      }
    }

    return null
  }, [query])

  const [getSuggestions] = useLazyQuery(params?.suggestionsQuery ?? USER_SUGGESTIONS, {
    onCompleted: data => {
      query !== undefined && setSuggestions(data[params.itemsField])
    }
  })

  const resetSuggestions = useCallback(() => setSuggestions([]), [])

  useEffect(() => {
    if (query && params) {
      const q = query?.replace(/^[@ ~]+|[ ]+$/g, '').replace(/@[^\s]*$/, '').replace(/~[^\s]*$/, '')
      getSuggestions({ variables: { q, limit: 5 } })
    } else {
      resetSuggestions()
    }
  }, [query, params, resetSuggestions, getSuggestions])

  if (!query) return null

  return suggestions
}

export default function NewMentionsPlugin () {
  const [editor] = useLexicalComposerContext()
  const [query, setQuery] = useState(null)
  const suggestions = useSuggestions({ query })

  const options = useMemo(() => {
    if (!suggestions?.length) return []
    return suggestions.map(s =>
      new MenuOption(s.name, { name: s.name })
    )
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

  const checkMentionTrigger = useCallback((text) => {
    const match = /(^|\s|\()([@~]\w{0,75})$/.exec(text)
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
  }, [])

  return (
    <LexicalTypeaheadMenuPlugin
      onQueryChange={setQuery}
      onSelectOption={onSelect}
      triggerFn={checkMentionTrigger}
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
                    {o.key}
                  </Dropdown.Item>)}
              </Dropdown.Menu>
            </Dropdown>, anchorElementRef.current)
          : null}
    />
  )
}
