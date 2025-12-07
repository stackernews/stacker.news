import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import useUniversalAutocomplete from './autocompleter'
import { BaseSuggest } from '@/components/form'
import { useLazyQuery } from '@apollo/client'
import { USER_SUGGESTIONS } from '@/fragments/users'
import { SUB_SUGGESTIONS } from '@/fragments/subs'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { KEY_DOWN_COMMAND, COMMAND_PRIORITY_HIGH } from 'lexical'

// bridges BageSuggest to the Universal Autocomplete hook
function SuggestWrapper ({
  q, onSelect, dropdownStyle, selectWithTab = false, onSuggestionsChange, children,
  getSuggestionsQuery, itemsField
}) {
  // fetch suggestions on-demand
  // getSuggestionsQuery is the query to be used to fetch suggestions
  const [getSuggestions] = useLazyQuery(getSuggestionsQuery, {
    onCompleted: data => {
      if (onSuggestionsChange) {
        // itemsField is the field in the data that contains the suggestions
        onSuggestionsChange(data[itemsField])
      }
    }
  })

  // watch query changes and fetch suggestions
  // strip prefixes (@ or ~) and trailing spaces
  useEffect(() => {
    if (q !== undefined) {
      getSuggestions({ variables: { q, limit: 5 } })
    }
  }, [q, getSuggestions])

  // will display the dropdown, calling onSelect when a mention is selected
  return (
    <BaseSuggest
      query={q}
      dropdownStyle={dropdownStyle}
      selectWithTab={selectWithTab}
      getSuggestionsQuery={getSuggestionsQuery}
      itemsField={itemsField}
      onSelect={onSelect}
    >
      {children}
    </BaseSuggest>
  )
}

export default function MentionsPlugin () {
  const [editor] = useLexicalComposerContext()
  const { entityData, handleSelect } = useUniversalAutocomplete({ editor })
  const keyDownHandlerRef = useRef()
  const resetSuggestionsRef = useRef()
  const [currentSuggestions, setCurrentSuggestions] = useState([])

  // we receive the name from BaseSuggest
  // then we find the full item from our stored suggestions
  const handleItemSelect = useCallback((name) => {
    const fullItem = currentSuggestions.find(item => item.name === name)
    if (fullItem) {
      handleSelect(fullItem, entityData?.isUser)
    }
  }, [handleSelect, entityData, currentSuggestions])

  // clear suggestions when entity data is null
  useEffect(() => {
    if (!entityData) {
      if (resetSuggestionsRef.current) {
        resetSuggestionsRef.current()
      }
      setCurrentSuggestions([])
    }
  }, [entityData])

  useEffect(() => {
    return editor.registerCommand(
      KEY_DOWN_COMMAND,
      (event) => {
        if (keyDownHandlerRef.current && entityData) {
          keyDownHandlerRef.current(event)
          return true
        }
        return false
      },
      COMMAND_PRIORITY_HIGH
    )
  }, [editor, entityData, keyDownHandlerRef])

  if (!entityData) return null

  return createPortal(
    <SuggestWrapper
      q={entityData.query}
      onSelect={handleItemSelect}
      dropdownStyle={entityData.style}
      selectWithTab={false}
      onSuggestionsChange={setCurrentSuggestions}
      getSuggestionsQuery={entityData.isUser ? USER_SUGGESTIONS : SUB_SUGGESTIONS}
      itemsField={entityData.isUser ? 'userSuggestions' : 'subSuggestions'}
    >
      {({ onKeyDown, resetSuggestions }) => {
        keyDownHandlerRef.current = onKeyDown
        resetSuggestionsRef.current = resetSuggestions
        return null
      }}
    </SuggestWrapper>, document.body)
}
