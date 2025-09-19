import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { LexicalTypeaheadMenuPlugin, MenuOption } from '@lexical/react/LexicalTypeaheadMenuPlugin'
import { useState, useCallback, useMemo } from 'react'
import { $createMentionNode } from '@/lib/lexical/nodes/mention'
import { USER_SUGGESTIONS } from '@/fragments/users'
import { useLazyQuery } from '@apollo/client'
import { createPortal } from 'react-dom'

// This comes from Lexical Mentions Plugin, it's not going to be what we want
// This is a placeholder to have an idea of a structure for mention nodes.
const TRIGGERS = ['@'].join('')

// Chars we expect to see in a mention (non-space, non-punctuation).
const VALID_CHARS = '[^' + TRIGGERS + '\\s]'

// Non-standard series of chars. Each series must be preceded and followed by
// a valid char.
const VALID_JOINS =
  '(?:' +
  '\\.[ |$]|' + // E.g. "r. " in "Mr. Smith"
  ' |' + // E.g. " " in "Josh Duck"
  '[' +
  ']|' + // E.g. "-' in "Salier-Hellendag"
  ')'

const LENGTH_LIMIT = 75

const AtSignMentionsRegex = new RegExp(
  '(^|\\s|\\()(' +
    '[' +
    TRIGGERS +
    ']' +
    '((?:' +
    VALID_CHARS +
    VALID_JOINS +
    '){0,' +
    LENGTH_LIMIT +
    '})' +
    ')$'
)

// 50 is the longest alias length limit.
const ALIAS_LENGTH_LIMIT = 50

// Regex used to match alias.
const AtSignMentionsRegexAliasRegex = new RegExp(
  '(^|\\s|\\()(' +
    '[' +
    TRIGGERS +
    ']' +
    '((?:' +
    VALID_CHARS +
    '){0,' +
    ALIAS_LENGTH_LIMIT +
    '})' +
    ')$'
)

// At most, 5 suggestions are shown in the popup.
const SUGGESTION_LIST_LENGTH_LIMIT = 5

function MentionsTypeaheadMenuItem ({ index, onClick, onMouseEnter, option }) {
  return (
    <li
      key={option.name}
      tabIndex={-1}
      ref={option.setRefElement}
      role='option'
      id={'typeahead-item-' + index}
      onMouseEnter={onMouseEnter}
      onClick={onClick}
    >
      <span>{option.name}</span>
    </li>
  )
}

export default function MentionsPlugin () {
  const [editor] = useLexicalComposerContext()
  const [, setQuery] = useState(null)
  const [suggestions, setSuggestions] = useState(null)

  const [getSuggestions] = useLazyQuery(USER_SUGGESTIONS, {
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
      const mentionNode = $createMentionNode(selectedOption.name)
      if (nodeToReplace) {
        nodeToReplace.replace(mentionNode)
      }
      closeMenu()
    })
  }, [editor])

  const checkForAtMentionMatch = useCallback((text) => {
    let match = AtSignMentionsRegex.exec(text)
    if (!match) {
      match = AtSignMentionsRegexAliasRegex.exec(text)
    }
    console.log('match', match)
    if (match) {
      const leadingWhiteSpace = match[1]
      console.log('leadingWhiteSpace', leadingWhiteSpace)
      const matchingString = match[3]
      console.log('matchingString', matchingString)
      if (matchingString.length >= 1) {
        console.log('matchingString', matchingString)
        if (matchingString.length > 1) {
          getSuggestions({ variables: { q: matchingString, limit: SUGGESTION_LIST_LENGTH_LIMIT } })
        }
        return {
          leadOffset: match.index + leadingWhiteSpace.length,
          matchingString,
          replaceableString: match[2]
        }
      }
    }
    return null
  }, [getSuggestions])

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
            <div className='typeahead-menu'>
              <ul>
                {options?.map((option, index) => (
                  <MentionsTypeaheadMenuItem
                    index={index}
                    isSelected={selectedIndex === index}
                    option={option}
                    key={option.name}
                    onClick={() => {
                      setHighlightedIndex(index)
                      selectOptionAndCleanUp(option)
                    }}
                    onMouseEnter={() => {
                      setHighlightedIndex(index)
                    }}
                  />
                ))}
              </ul>
            </div>,
            anchorElementRef?.current
          )
          : null}
    />
  )
}
