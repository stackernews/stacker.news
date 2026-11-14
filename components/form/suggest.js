import { useCallback, useEffect, useId, useState } from 'react'
import { useLazyQuery } from '@apollo/client/react'
import { USER_SUGGESTIONS } from '@/fragments/users'
import { isAbortError } from '@/lib/error'
import { cn } from '@/lib/cn'
import { menuClasses, itemClasses } from '@/components/ui/menu'
import { FormGroup } from './field'
import { InputInner } from './input'

const INITIAL_SUGGESTIONS = { array: [], index: 0 }

function BaseSuggest ({ query, onSelect, children }) {
  const [getSuggestions] = useLazyQuery(USER_SUGGESTIONS)
  const [suggestions, setSuggestions] = useState(INITIAL_SUGGESTIONS)
  const listboxId = useId()
  const resetSuggestions = useCallback(() => setSuggestions(INITIAL_SUGGESTIONS), [])
  useEffect(() => {
    if (query !== undefined) {
      // remove the leading character and any trailing spaces
      const q = query?.replace(/^[@ ~]+|[ ]+$/g, '').replace(/@[^\s]*$/, '').replace(/~[^\s]*$/, '')
      getSuggestions({ variables: { q, limit: 5 } })
        .then(({ data }) => {
          query !== undefined && setSuggestions({ array: data.userSuggestions, index: 0 })
        })
        .catch(err => !isAbortError(err) && console.error(err))
    } else {
      resetSuggestions()
    }
  }, [query, resetSuggestions, getSuggestions])

  const onKeyDown = useCallback(e => {
    switch (e.code) {
      case 'ArrowUp':
        if (suggestions.array.length === 0) {
          break
        }
        e.preventDefault()
        setSuggestions(suggestions =>
          ({
            ...suggestions,
            index: Math.max(suggestions.index - 1, 0)
          }))
        break
      case 'ArrowDown':
        if (suggestions.array.length === 0) {
          break
        }
        e.preventDefault()
        setSuggestions(suggestions =>
          ({
            ...suggestions,
            index: Math.min(suggestions.index + 1, suggestions.array.length - 1)
          }))
        break
      case 'Tab':
      case 'Enter':
        if (suggestions.array?.length === 0) {
          break
        }
        e.preventDefault()
        onSelect(suggestions.array[suggestions.index].name)
        resetSuggestions()
        break
      case 'Escape':
        e.preventDefault()
        resetSuggestions()
        break
      default:
        break
    }
  }, [onSelect, resetSuggestions, suggestions])

  const activeOptionId = suggestions.array.length > 0
    ? `${listboxId}-${suggestions.index}`
    : undefined

  // the dropdown is anchored to a wrapper after the input
  return (
    <>
      {children?.({ onKeyDown, resetSuggestions, listboxId, activeOptionId })}
      {suggestions.array.length > 0 && (
        <div className='relative'>
          <div
            id={listboxId}
            role='listbox'
            onMouseDown={e => e.preventDefault()}
            className={cn(menuClasses(), 'absolute start-0 top-0 z-dropdown')}
          >
            {suggestions.array.map((v, i) =>
              <div
                id={`${listboxId}-${i}`}
                key={v.name}
                role='option'
                aria-selected={suggestions.index === i}
                className={itemClasses({ active: suggestions.index === i })}
                onClick={() => {
                  onSelect(v.name)
                  resetSuggestions()
                }}
              >
                {v.name}
              </div>)}
          </div>
        </div>
      )}
    </>
  )
}

export function InputUserSuggest ({ label, groupClassName, ...props }) {
  const [ovalue, setOValue] = useState()
  const [query, setQuery] = useState()
  return (
    <FormGroup label={label} htmlFor={props.id || props.name} className={groupClassName}>
      <BaseSuggest onSelect={setOValue} query={query}>
        {({ onKeyDown, resetSuggestions, listboxId, activeOptionId }) => (
          <InputInner
            {...props}
            role='combobox'
            aria-autocomplete='list'
            aria-expanded={!!activeOptionId}
            aria-controls={listboxId}
            aria-activedescendant={activeOptionId}
            autoComplete='off'
            onChange={(formik, e) => {
              if (e.target.value === ovalue) {
                // we don't need to set the ovalue or query if the value is the same
                return
              }
              setOValue(e.target.value)
              // only open suggestions for interactive edits, not draft restore or ovalue
              if (e.target === document.activeElement) {
                setQuery(e.target.value.replace(/^[@ ]+|[ ]+$/g, ''))
              }
            }}
            overrideValue={ovalue}
            onKeyDown={onKeyDown}
            onBlur={() => setTimeout(resetSuggestions, 500)}
          />
        )}
      </BaseSuggest>
    </FormGroup>
  )
}
