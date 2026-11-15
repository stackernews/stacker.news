import { useId, useState } from 'react'
import { useLazyQuery } from '@apollo/client/react'
import { USER_SUGGESTIONS } from '@/fragments/users'
import { isAbortError } from '@/lib/error'
import { cn } from '@/lib/cn'
import { menuClasses, itemClasses } from '@/components/ui/menu'
import { FormGroup } from './field'
import { InputInner } from './input'

const INITIAL_SUGGESTIONS = { array: [], index: 0 }

export function InputUserSuggest ({ label, groupClassName, ...props }) {
  const [getSuggestions] = useLazyQuery(USER_SUGGESTIONS)
  const [suggestions, setSuggestions] = useState(INITIAL_SUGGESTIONS)
  const [ovalue, setOValue] = useState()
  const listboxId = useId()
  const open = suggestions.array.length > 0
  const activeOptionId = open ? `${listboxId}-${suggestions.index}` : undefined

  const resetSuggestions = () => setSuggestions(INITIAL_SUGGESTIONS)

  const select = name => {
    setOValue(name)
    resetSuggestions()
  }

  const move = step => setSuggestions(({ array, index }) =>
    ({ array, index: Math.min(Math.max(index + step, 0), array.length - 1) }))

  const onChange = (formik, e) => {
    // InputInner calls onChange again with the value it was just given
    if (e.target.value === ovalue) return
    setOValue(e.target.value)
    // only open suggestions for interactive edits, not draft restore
    if (e.target !== document.activeElement) return
    const q = e.target.value.replace(/^[@ ]+|[ ]+$/g, '')
    getSuggestions({ variables: { q, limit: 5 } })
      .then(({ data }) => setSuggestions({ array: data.userSuggestions, index: 0 }))
      .catch(err => !isAbortError(err) && console.error(err))
  }

  const onKeyDown = e => {
    if (e.code === 'Escape') {
      e.preventDefault()
      resetSuggestions()
    }
    if (!open) return
    if (e.code === 'ArrowUp' || e.code === 'ArrowDown') {
      e.preventDefault()
      move(e.code === 'ArrowUp' ? -1 : 1)
    } else if (e.code === 'Tab' || e.code === 'Enter') {
      e.preventDefault()
      select(suggestions.array[suggestions.index].name)
    }
  }

  return (
    <FormGroup label={label} htmlFor={props.id || props.name} className={groupClassName}>
      <InputInner
        {...props}
        role='combobox'
        aria-autocomplete='list'
        aria-expanded={open}
        aria-controls={listboxId}
        aria-activedescendant={activeOptionId}
        autoComplete='off'
        onChange={onChange}
        overrideValue={ovalue}
        onKeyDown={onKeyDown}
        onBlur={() => setTimeout(resetSuggestions, 500)}
      />
      {/* the dropdown is anchored to a wrapper after the input */}
      {open && (
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
                onClick={() => select(v.name)}
              >
                {v.name}
              </div>)}
          </div>
        </div>
      )}
    </FormGroup>
  )
}
