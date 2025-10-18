import { useCallback, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Dropdown } from 'react-bootstrap'
import { useLazyQuery } from '@apollo/client'
import { LexicalTypeaheadMenuPlugin, MenuOption } from '@lexical/react/LexicalTypeaheadMenuPlugin'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import styles from '@/components/form.module.css'
import { SUB_SUGGESTIONS } from '@/fragments/subs'
import { USER_SUGGESTIONS } from '@/fragments/users'
import { $createMentionNode } from '@/lib/lexical/nodes/decorative/mentions/user-mention'
import { $createTerritoryNode } from '@/lib/lexical/nodes/decorative/mentions/territory-mention'

// This comes from Lexical Mentions Plugin, it's not going to be what we want
// This is a placeholder to have an idea of a structure for mention nodes.
// Support both @ for mentions and ~ for territories
// Regex patterns for matching @ and ~ mentions
const AtSignMentionsRegex = /(^|\s|\()([@~]\w{0,75})$/

// At most, 5 suggestions are shown in the popup.
const SUGGESTION_LIST_LENGTH_LIMIT = 5

export default function MentionsPlugin () {
  const [editor] = useLexicalComposerContext()
  const [, setQuery] = useState(null)
  const [suggestions, setSuggestions] = useState(null)

  const [getSubSuggestions] = useLazyQuery(SUB_SUGGESTIONS, {
    onCompleted: (data) => {
      setSuggestions(data.subSuggestions)
    }
  })

  const [getUserSuggestions] = useLazyQuery(USER_SUGGESTIONS, {
    onCompleted: (data) => {
      setSuggestions(data.userSuggestions)
    }
  })

  const options = useMemo(() => {
    if (!suggestions?.length) return []
    return suggestions.map(s => Object.assign(new MenuOption(s.name), { name: s.name }))
  }, [suggestions])

  const onSelectOption = useCallback((selectedOption, nodeToReplace, closeMenu) => {
    editor.update(() => {
      if (nodeToReplace) {
        if (nodeToReplace.getTextContent().startsWith('@')) {
          const mentionNode = $createMentionNode(selectedOption.name)
          nodeToReplace.replace(mentionNode)
        } else {
          const territoryNode = $createTerritoryNode(selectedOption.name)
          nodeToReplace.replace(territoryNode)
        }
      }
      closeMenu()
    })
  }, [editor])

  const checkForAtMentionMatch = useCallback((text) => {
    const match = AtSignMentionsRegex.exec(text)
    if (match) {
      const leadingWhiteSpace = match[1]
      const fullMention = match[2] // this is the full string including the @ or ~

      if (fullMention.length >= 2) { // it has to have at least one character after the @ or ~
        const query = fullMention.slice(1) // remove the @ or ~

        if (query.length > 0) {
          if (fullMention.startsWith('@')) {
            getUserSuggestions({ variables: { q: query, limit: SUGGESTION_LIST_LENGTH_LIMIT } })
          } else {
            getSubSuggestions({ variables: { q: query, limit: SUGGESTION_LIST_LENGTH_LIMIT } })
          }
        }

        return {
          leadOffset: match.index + leadingWhiteSpace.length,
          matchingString: fullMention,
          replaceableString: fullMention
        }
      }
    }
    return null
  }, [getUserSuggestions, getSubSuggestions])

  return (
    <LexicalTypeaheadMenuPlugin
      options={options}
      onQueryChange={setQuery}
      onSelectOption={onSelectOption}
      onClose={() => {
        setSuggestions(null)
      }}
      triggerFn={checkForAtMentionMatch}
      menuRenderFn={(
        anchorElementRef,
        { selectedIndex, selectOptionAndCleanUp, setHighlightedIndex }
      ) =>
        anchorElementRef?.current && options?.length
          ? createPortal(
            <Dropdown show style={{ zIndex: 1000 }}>
              <Dropdown.Menu className={styles.suggestionsMenu}>
                {options?.map((option, index) =>
                  <Dropdown.Item
                    key={option.name}
                    active={selectedIndex === index}
                    onClick={() => {
                      setHighlightedIndex(index)
                      selectOptionAndCleanUp(option)
                    }}
                  >
                    {option.name}
                  </Dropdown.Item>)}
              </Dropdown.Menu>
            </Dropdown>,
            anchorElementRef?.current
          )
          : null}
    />
  )
}
