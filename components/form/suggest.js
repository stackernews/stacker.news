import { useCallback, useEffect, useId, useState } from 'react'
import { useLazyQuery } from '@apollo/client/react'
import textAreaCaret from 'textarea-caret'
import { USER_SUGGESTIONS } from '@/fragments/users'
import { SUB_SUGGESTIONS } from '@/fragments/subs'
import { isAbortError } from '@/lib/error'
import { cn } from '@/lib/cn'
import { menuClasses, itemClasses } from '@/components/ui/menu'
import { FormGroup } from './field'
import { InputInner } from './input'

const INITIAL_SUGGESTIONS = { array: [], index: 0 }

export function BaseSuggest ({
  query, onSelect, dropdownStyle,
  transformItem = item => item, selectWithTab = true, filterItems = () => true,
  getSuggestionsQuery, queryName, itemsField,
  children
}) {
  const [getSuggestions] = useLazyQuery(getSuggestionsQuery)
  const [suggestions, setSuggestions] = useState(INITIAL_SUGGESTIONS)
  // The combobox and its active option reference this stable listbox id.
  const listboxId = useId()
  const resetSuggestions = useCallback(() => setSuggestions(INITIAL_SUGGESTIONS), [])
  useEffect(() => {
    if (query !== undefined) {
      // remove the leading character and any trailing spaces
      const q = query?.replace(/^[@ ~]+|[ ]+$/g, '').replace(/@[^\s]*$/, '').replace(/~[^\s]*$/, '')
      getSuggestions({ variables: { q, limit: 5 } })
        .then(({ data }) => {
          query !== undefined && setSuggestions({
            array: data[itemsField]
              .filter((...args) => filterItems(query, ...args))
              .map(transformItem),
            index: 0
          })
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
        if (e.code === 'Tab' && !selectWithTab) {
          break
        }
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

  // Search mentions use an explicit caret position. Other suggestions anchor
  // to the zero-height wrapper immediately after the input.
  return (
    <>
      {children?.({ onKeyDown, resetSuggestions, listboxId, activeOptionId })}
      {suggestions.array.length > 0 && (
        <div style={dropdownStyle} className={dropdownStyle ? undefined : 'relative'}>
          <div
            id={listboxId}
            role='listbox'
            onMouseDown={e => e.preventDefault()}
            className={cn(menuClasses(), 'absolute start-0 top-0 z-(--sn-z-dropdown)')}
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

function BaseInputSuggest ({
  label, groupClassName, transformItem, filterItems,
  selectWithTab, onChange, transformQuery, SuggestComponent, prefixRegex, ...props
}) {
  const [ovalue, setOValue] = useState()
  const [query, setQuery] = useState()
  return (
    <FormGroup label={label} htmlFor={props.id || props.name} className={groupClassName}>
      <SuggestComponent
        transformItem={transformItem}
        filterItems={filterItems}
        selectWithTab={selectWithTab}
        onSelect={(v) => {
          // ovalue tracks display state, so selection updates the controlled
          // field through onChange before syncing that local state.
          onChange && onChange(undefined, { target: { value: v } })
          setOValue(v)
        }}
        query={query}
      >
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
              onChange && onChange(formik, e)
              if (e.target.value === ovalue) {
                // we don't need to set the ovalue or query if the value is the same
                return
              }
              setOValue(e.target.value)
              // only open suggestions for interactive edits, not draft restore or ovalue
              if (e.target === document.activeElement) {
                setQuery(e.target.value.replace(prefixRegex, ''))
              }
            }}
            overrideValue={ovalue}
            onKeyDown={onKeyDown}
            onBlur={() => setTimeout(resetSuggestions, 500)}
          />
        )}
      </SuggestComponent>
    </FormGroup>
  )
}

export function InputUserSuggest ({
  transformUser, filterUsers, ...props
}) {
  return (
    <BaseInputSuggest
      transformItem={transformUser}
      filterItems={filterUsers}
      SuggestComponent={UserSuggest}
      prefixRegex={/^[@ ]+|[ ]+$/g}
      {...props}
    />
  )
}

function UserSuggest ({
  transformUser = user => user, filterUsers = () => true,
  children, ...props
}) {
  return (
    <BaseSuggest
      transformItem={transformUser}
      filterItems={filterUsers}
      getSuggestionsQuery={USER_SUGGESTIONS}
      itemsField='userSuggestions'
      {...props}
    >
      {children}
    </BaseSuggest>
  )
}

function TerritorySuggest ({
  transformSub = sub => sub, filterSubs = () => true,
  children, ...props
}) {
  return (
    <BaseSuggest
      transformItem={transformSub}
      filterItems={filterSubs}
      getSuggestionsQuery={SUB_SUGGESTIONS}
      itemsField='subSuggestions'
      {...props}
    >
      {children}
    </BaseSuggest>
  )
}

function useEntityAutocomplete ({
  prefix,
  meta,
  helpers,
  innerRef,
  setSelectionRange,
  SuggestComponent
}) {
  const [entityData, setEntityData] = useState()

  const handleSelect = useCallback((name) => {
    if (entityData?.start === undefined || entityData?.end === undefined) return
    const { start, end } = entityData
    setEntityData(undefined)
    const first = `${meta?.value.substring(0, start)}${prefix}${name}`
    const second = meta?.value.substring(end)
    const updatedValue = `${first}${second}`
    helpers.setValue(updatedValue)
    setSelectionRange({ start: first.length, end: first.length })
    innerRef.current.focus()
  }, [entityData, meta?.value, helpers, prefix, setSelectionRange, innerRef])

  const handleTextChange = useCallback((e) => {
    const { value, selectionStart } = e.target
    if (!value || selectionStart === undefined) {
      setEntityData(undefined)
      return false
    }

    let priorSpace = -1
    for (let i = selectionStart - 1; i >= 0; i--) {
      if (/[^\w@~]/.test(value[i])) {
        priorSpace = i
        break
      }
    }

    let nextSpace = value.length
    for (let i = selectionStart; i <= value.length; i++) {
      if (/[^\w]/.test(value[i])) {
        nextSpace = i
        break
      }
    }

    const currentSegment = value.substring(priorSpace + 1, nextSpace)
    const regexPattern = new RegExp(`^\\${prefix}\\w*$`)

    if (regexPattern.test(currentSegment)) {
      const { top, left } = textAreaCaret(e.target, e.target.selectionStart)
      setEntityData({
        query: currentSegment,
        start: priorSpace + 1,
        end: nextSpace,
        style: {
          position: 'absolute',
          top: `${top + Number(window.getComputedStyle(e.target).lineHeight.replace('px', ''))}px`,
          left: `${left}px`
        }
      })
      return true
    }

    setEntityData(undefined)
    return false
  }, [prefix])

  // Return a function that takes a render prop instead of directly returning the component
  return {
    entityData,
    handleSelect,
    handleTextChange,
    renderSuggest: (renderProps) => {
      if (!entityData) return null

      return (
        <SuggestComponent
          query={entityData?.query}
          onSelect={handleSelect}
          dropdownStyle={entityData?.style}
        >
          {renderProps}
        </SuggestComponent>
      )
    }
  }
}

export function useDualAutocomplete ({ meta, helpers, innerRef, setSelectionRange }) {
  const userAutocomplete = useEntityAutocomplete({
    prefix: '@',
    meta,
    helpers,
    innerRef,
    setSelectionRange,
    SuggestComponent: UserSuggest
  })

  const territoryAutocomplete = useEntityAutocomplete({
    prefix: '~',
    meta,
    helpers,
    innerRef,
    setSelectionRange,
    SuggestComponent: TerritorySuggest
  })

  const handleTextChange = useCallback((e) => {
    // Try to match user mentions first, then territories
    if (!userAutocomplete.handleTextChange(e)) {
      territoryAutocomplete.handleTextChange(e)
    }
  }, [userAutocomplete, territoryAutocomplete])

  const handleKeyDown = useCallback((e, userOnKeyDown, territoryOnKeyDown) => {
    const metaOrCtrl = e.metaKey || e.ctrlKey
    if (!metaOrCtrl) {
      if (userAutocomplete.entityData) {
        return userOnKeyDown(e)
      } else if (territoryAutocomplete.entityData) {
        return territoryOnKeyDown(e)
      }
    }
    return false // Didn't handle the event
  }, [userAutocomplete.entityData, territoryAutocomplete.entityData])

  const handleBlur = useCallback((resetUserSuggestions, resetTerritorySuggestions) => {
    setTimeout(resetUserSuggestions, 500)
    setTimeout(resetTerritorySuggestions, 500)
  }, [])

  return {
    userAutocomplete,
    territoryAutocomplete,
    handleTextChange,
    handleKeyDown,
    handleBlur
  }
}

export function DualAutocompleteWrapper ({
  userAutocomplete,
  territoryAutocomplete,
  children
}) {
  return (
    <UserSuggest
      query={userAutocomplete.entityData?.query}
      onSelect={userAutocomplete.handleSelect}
      dropdownStyle={userAutocomplete.entityData?.style}
    >{({ onKeyDown: userSuggestOnKeyDown, resetSuggestions: resetUserSuggestions }) => (
      <TerritorySuggest
        query={territoryAutocomplete.entityData?.query}
        onSelect={territoryAutocomplete.handleSelect}
        dropdownStyle={territoryAutocomplete.entityData?.style}
      >{({ onKeyDown: territorySuggestOnKeyDown, resetSuggestions: resetTerritorySuggestions }) =>
        children({
          userSuggestOnKeyDown,
          territorySuggestOnKeyDown,
          resetUserSuggestions,
          resetTerritorySuggestions
        })}
      </TerritorySuggest>
    )}
    </UserSuggest>
  )
}
