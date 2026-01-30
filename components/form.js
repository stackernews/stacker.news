import Button from 'react-bootstrap/Button'
import InputGroup from 'react-bootstrap/InputGroup'
import BootstrapForm from 'react-bootstrap/Form'
import { Formik, Form as FormikForm, useFormikContext, useField, FieldArray } from 'formik'
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import copy from 'clipboard-copy'
import Col from 'react-bootstrap/Col'
import Dropdown from 'react-bootstrap/Dropdown'
import Row from 'react-bootstrap/Row'
import styles from './form.module.css'
import AddIcon from '@/svgs/add-fill.svg'
import CloseIcon from '@/svgs/close-line.svg'
import { useLazyQuery } from '@apollo/client'
import { USER_SUGGESTIONS } from '@/fragments/users'
import { SUB_SUGGESTIONS } from '@/fragments/subs'
import { useToast } from './toast'
import { numWithUnits } from '@/lib/format'
import textAreaCaret from 'textarea-caret'
import 'react-datepicker/dist/react-datepicker.css'
import { debounce } from './use-debounce-callback'
import { whenRange } from '@/lib/time'
import Thumb from '@/svgs/thumb-up-fill.svg'
import Eye from '@/svgs/eye-fill.svg'
import EyeClose from '@/svgs/eye-close-line.svg'
import Info from './info'
import { useMe } from './me'
import classNames from 'classnames'
import Clipboard from '@/svgs/clipboard-line.svg'
import QrScanIcon from '@/svgs/qr-scan-line.svg'
import { useShowModal } from './modal'
import dynamic from 'next/dynamic'
import { useIsClient } from './use-client'
import PageLoading from './page-loading'
import { SNEditor } from './editor'
export { MultiSelect } from './multi-select'
export class SessionRequiredError extends Error {
  constructor () {
    super('session required')
    this.name = 'SessionRequiredError'
  }
}

export function SubmitButton ({
  children, variant, valueName = 'submit', value, onClick, disabled, appendText, submittingText,
  className, ...props
}) {
  const formik = useFormikContext()

  disabled ||= formik.isSubmitting
  submittingText ||= children

  return (
    <Button
      variant={variant || 'main'}
      className={classNames(formik.isSubmitting && 'pulse', className)}
      type='submit'
      disabled={disabled}
      onClick={value
        ? e => {
          formik.setFieldValue(valueName, value)
          onClick && onClick(e)
        }
        : onClick}
      {...props}
    >
      {formik.isSubmitting ? submittingText : children}{!disabled && appendText && <small> {appendText}</small>}
    </Button>
  )
}

export function CopyButton ({ value, icon, ...props }) {
  const toaster = useToast()
  const [copied, setCopied] = useState(false)

  const handleClick = useCallback(async () => {
    try {
      await copy(value)
      toaster.success('copied')
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch (err) {
      toaster.danger('failed to copy')
    }
  }, [toaster, value])

  if (icon) {
    return (
      <InputGroup.Text style={{ cursor: 'pointer' }} onClick={handleClick}>
        <Clipboard height={20} width={20} />
      </InputGroup.Text>
    )
  }

  return (
    <Button className={styles.appendButton} {...props} onClick={handleClick}>
      {copied ? <Thumb width={18} height={18} /> : 'copy'}
    </Button>
  )
}

export function CopyInput (props) {
  return (
    <Input
      append={
        <CopyButton value={props.placeholder} size={props.size} />
      }
      {...props}
    />
  )
}

export function InputSkeleton ({ label, hint }) {
  return (
    <BootstrapForm.Group>
      {label && <BootstrapForm.Label>{label}</BootstrapForm.Label>}
      <div className='form-control clouds' style={{ color: 'transparent' }}>.</div>
      {hint &&
        <BootstrapForm.Text>
          {hint}
        </BootstrapForm.Text>}
    </BootstrapForm.Group>
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

export function SNInput ({ label, topLevel, groupClassName, onChange, ...props }) {
  return (
    <FormGroup label={label} className={groupClassName}>
      <SNEditor name={props.name} topLevel={topLevel} onChange={onChange} {...props} />
    </FormGroup>
  )
}

function FormGroup ({ className, label, children }) {
  return (
    <BootstrapForm.Group className={`form-group ${className}`}>
      {label && <BootstrapForm.Label>{label}</BootstrapForm.Label>}
      {children}
    </BootstrapForm.Group>
  )
}

function InputInner ({
  prepend, append, hint, warn, showValid, onChange, onBlur, overrideValue, appendValue,
  innerRef, noForm, clear, onKeyDown, inputGroupClassName, debounce: debounceTime, maxLength, hideError,
  AppendColumn, ...props
}) {
  const [field, meta, helpers] = noForm ? [{}, {}, {}] : useField(props)
  const formik = noForm ? null : useFormikContext()
  const storageKeyPrefix = useContext(StorageKeyPrefixContext)
  const isClient = useIsClient()

  const storageKey = storageKeyPrefix ? storageKeyPrefix + '-' + props.name : undefined

  const onKeyDownInner = useCallback((e) => {
    const metaOrCtrl = e.metaKey || e.ctrlKey
    if (metaOrCtrl) {
      if (e.key === 'Enter') formik?.submitForm()
    }

    if (onKeyDown) onKeyDown(e)
  }, [formik?.submitForm, onKeyDown])

  const onChangeInner = useCallback((e) => {
    field?.onChange(e)

    if (storageKey) {
      window.localStorage.setItem(storageKey, e.target.value)
    }

    if (onChange) {
      onChange(formik, e)
    }
  }, [field?.onChange, storageKey, onChange])

  const onBlurInner = useCallback((e) => {
    field?.onBlur?.(e)
    onBlur && onBlur(e)
  }, [field?.onBlur, onBlur])

  useEffect(() => {
    if (overrideValue) {
      helpers.setValue(overrideValue)
      if (storageKey) {
        window.localStorage.setItem(storageKey, overrideValue)
      }
      onChange && onChange(formik, { target: { value: overrideValue } })
    } else if (storageKey) {
      const draft = window.localStorage.getItem(storageKey)
      if (draft) {
        // for some reason we have to turn off validation to get formik to
        // not assume this is invalid
        const isNumeric = /^[0-9]+$/.test(draft)
        const numericExpected = typeof field.value === 'number'
        helpers.setValue(isNumeric && numericExpected ? parseInt(draft) : draft)
        onChange && onChange(formik, { target: { value: draft } })
      }
    }
  }, [overrideValue])

  useEffect(() => {
    if (appendValue) {
      const updatedValue = meta.value ? `${meta.value}\n${appendValue}` : appendValue
      helpers.setValue(updatedValue)
      if (storageKey) {
        window.localStorage.setItem(storageKey, updatedValue)
      }
      innerRef?.current?.focus()
    }
  }, [appendValue])

  const invalid = (!formik || formik.submitCount > 0) && meta.touched && meta.error

  useEffect(debounce(() => {
    if (!noForm && !isNaN(debounceTime) && debounceTime > 0) {
      formik.validateForm()
    }
  }, debounceTime), [noForm, formik, field.value])

  const remaining = maxLength && maxLength - (field.value || '').length

  return (
    <>
      <Row>
        <Col>
          <InputGroup hasValidation className={inputGroupClassName}>
            {prepend}
            <BootstrapForm.Control
              ref={innerRef}
              {...field}
              {...props}
              onKeyDown={onKeyDownInner}
              onChange={onChangeInner}
              onBlur={onBlurInner}
              isInvalid={!hideError && invalid} // if hideError is true, handle error showing separately
              isValid={showValid && meta.initialValue !== meta.value && meta.touched && !meta.error}
            />
            {(isClient && clear && field.value && !props.readOnly) &&
              <Button
                variant={null}
                onClick={(e) => {
                  helpers.setValue('')
                  if (storageKey) {
                    window.localStorage.removeItem(storageKey)
                  }
                  if (onChange) {
                    onChange(formik, { target: { value: '' } })
                  }
                }}
                className={`${styles.clearButton} ${styles.appendButton} ${invalid ? styles.isInvalid : ''}`}
              ><CloseIcon className='fill-grey' height={20} width={20} />
              </Button>}
            {append}
            <BootstrapForm.Control.Feedback type='invalid'>
              {meta.touched && meta.error}
            </BootstrapForm.Control.Feedback>
          </InputGroup>
        </Col>
        {AppendColumn && <AppendColumn className={meta.touched && meta.error ? 'invisible' : ''} />}
      </Row>
      {hint && (
        <BootstrapForm.Text>
          {hint}
        </BootstrapForm.Text>
      )}
      {warn && (
        <BootstrapForm.Text className='text-warning'>
          {warn}
        </BootstrapForm.Text>
      )}
      {!warn && maxLength && !(meta.touched && meta.error && invalid) && (
        <BootstrapForm.Text className={remaining < 0 ? 'text-danger' : 'text-muted'}>
          {`${numWithUnits(remaining, { abbreviate: false, unitSingular: 'character', unitPlural: 'characters' })} remaining`}
        </BootstrapForm.Text>
      )}
    </>
  )
}

const INITIAL_SUGGESTIONS = { array: [], index: 0 }

export function BaseSuggest ({
  query, onSelect, dropdownStyle,
  transformItem = item => item, selectWithTab = true, filterItems = () => true,
  getSuggestionsQuery, queryName, itemsField,
  children
}) {
  const [getSuggestions] = useLazyQuery(getSuggestionsQuery, {
    onCompleted: data => {
      query !== undefined && setSuggestions({
        array: data[itemsField]
          .filter((...args) => filterItems(query, ...args))
          .map(transformItem),
        index: 0
      })
    }
  })
  const [suggestions, setSuggestions] = useState(INITIAL_SUGGESTIONS)
  const resetSuggestions = useCallback(() => setSuggestions(INITIAL_SUGGESTIONS), [])
  useEffect(() => {
    if (query !== undefined) {
      // remove the leading character and any trailing spaces
      const q = query?.replace(/^[@ ~]+|[ ]+$/g, '').replace(/@[^\s]*$/, '').replace(/~[^\s]*$/, '')
      getSuggestions({ variables: { q, limit: 5 } })
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
  return (
    <>
      {children?.({ onKeyDown, resetSuggestions })}
      <Dropdown show={suggestions.array.length > 0} style={dropdownStyle}>
        <Dropdown.Menu className={styles.suggestionsMenu}>
          {suggestions.array.map((v, i) =>
            <Dropdown.Item
              key={v.name}
              active={suggestions.index === i}
              onClick={() => {
                onSelect(v.name)
                resetSuggestions()
              }}
            >
              {v.name}
            </Dropdown.Item>)}
        </Dropdown.Menu>
      </Dropdown>
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
    <FormGroup label={label} className={groupClassName}>
      <SuggestComponent
        transformItem={transformItem}
        filterItems={filterItems}
        selectWithTab={selectWithTab}
        onSelect={(v) => {
          // HACK ... ovalue does not trigger onChange
          onChange && onChange(undefined, { target: { value: v } })
          setOValue(v)
        }}
        query={query}
      >
        {({ onKeyDown, resetSuggestions }) => (
          <InputInner
            {...props}
            autoComplete='off'
            onChange={(formik, e) => {
              onChange && onChange(formik, e)
              if (e.target.value === ovalue) {
                // we don't need to set the ovalue or query if the value is the same
                return
              }
              setOValue(e.target.value)
              setQuery(e.target.value.replace(prefixRegex, ''))
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

export function InputTerritorySuggest ({
  transformSub, filterSubs, ...props
}) {
  return (
    <BaseInputSuggest
      transformItem={transformSub}
      filterItems={filterSubs}
      SuggestComponent={TerritorySuggest}
      prefixRegex={/^[~ ]+|[ ]+$/g}
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

export function Input ({ label, groupClassName, under, ...props }) {
  return (
    <FormGroup label={label} className={groupClassName}>
      <InputInner {...props} />
      {under}
    </FormGroup>
  )
}

export function VariableInput ({ label, groupClassName, name, hint, max, min, readOnlyLen, children, emptyItem = '', ...props }) {
  return (
    <FormGroup label={label} className={groupClassName}>
      <FieldArray name={name} hasValidation>
        {({ form, ...fieldArrayHelpers }) => {
          const options = form.values[name]

          return (
            <>
              {options?.map((_, i) => {
                const AppendColumn = ({ className }) => (
                  <Col className={`d-flex ps-0 ${className}`} xs='auto'>
                    {options.length - 1 === i && options.length !== max
                      // onMouseDown is used to prevent the blur event on text inputs from overriding the click event
                      ? <AddIcon className='fill-grey align-self-center justify-self-center pointer' onMouseDown={() => fieldArrayHelpers.push(emptyItem)} />
                      // filler div for col alignment across rows
                      : <div style={{ width: '24px', height: '24px' }} />}
                  </Col>
                )
                return (
                  <div key={i}>
                    <Row className='mb-2'>
                      <Col>
                        {children
                          ? children({ index: i, readOnly: i < readOnlyLen, placeholder: i >= min ? 'optional' : undefined, AppendColumn })
                          : <InputInner name={`${name}[${i}]`} {...props} readOnly={i < readOnlyLen} placeholder={i >= min ? 'optional' : undefined} AppendColumn={AppendColumn} />}
                      </Col>

                      {options.length - 1 === i &&
                        <>
                          {hint && <BootstrapForm.Text>{hint}</BootstrapForm.Text>}
                          {form.touched[name] && typeof form.errors[name] === 'string' &&
                            <div className='invalid-feedback d-block'>{form.errors[name]}</div>}
                        </>}
                    </Row>
                  </div>
                )
              })}
            </>
          )
        }}
      </FieldArray>
    </FormGroup>
  )
}

export function Checkbox ({
  children, label, groupClassName, type = 'checkbox',
  hiddenLabel, extra, handleChange, inline, disabled, ...props
}) {
  // React treats radios and checkbox inputs differently other input types, select, and textarea.
  // Formik does this too! When you specify `type` to useField(), it will
  // return the correct bag of props for you
  const [field, meta, helpers] = useField({ ...props, type })
  return (
    <FormGroup className={groupClassName}>
      {hiddenLabel && <BootstrapForm.Label className='invisible'>{label}</BootstrapForm.Label>}
      <BootstrapForm.Check
        id={props.id || props.name}
        inline={inline}
      >
        <BootstrapForm.Check.Input
          isInvalid={meta.touched && meta.error}
          {...field} {...props} disabled={disabled} type={type} onChange={(e) => {
            field.onChange(e)
            handleChange && handleChange(e.target.checked, helpers.setValue)
          }}
        />
        <BootstrapForm.Check.Label className={'d-inline-flex flex-nowrap align-items-center' + (disabled ? ' text-muted' : '')}>
          <div className='flex-grow-1'>{label}</div>
          {extra &&
            <div className={styles.checkboxExtra}>
              {extra}
            </div>}
        </BootstrapForm.Check.Label>
      </BootstrapForm.Check>
    </FormGroup>
  )
}

export function CheckboxGroup ({ label, groupClassName, children, ...props }) {
  const [, meta] = useField(props)
  return (
    <FormGroup label={label} className={groupClassName}>
      {children}
      {/* force the feedback to display with d-block */}
      <BootstrapForm.Control.Feedback className='d-block' type='invalid'>
        {meta.touched && meta.error}
      </BootstrapForm.Control.Feedback>
    </FormGroup>
  )
}

export const StorageKeyPrefixContext = createContext()

export function Form ({
  initial, validate, schema, onSubmit, children, initialError, validateImmediately,
  storageKeyPrefix, validateOnChange = true, requireSession, innerRef, enableReinitialize,
  ...props
}) {
  const toaster = useToast()
  const initialErrorToasted = useRef(false)
  const { me } = useMe()

  useEffect(() => {
    if (initialError && !initialErrorToasted.current) {
      toaster.danger('form error: ' + initialError.message || initialError.toString?.())
      initialErrorToasted.current = true
    }
  }, [])

  const clearLocalStorage = useCallback((values) => {
    Object.keys(values).forEach(v => {
      window.localStorage.removeItem(storageKeyPrefix + '-' + v)
      if (Array.isArray(values[v])) {
        values[v].forEach(
          (iv, i) => {
            Object.keys(iv).forEach(k => {
              window.localStorage.removeItem(`${storageKeyPrefix}-${v}[${i}].${k}`)
            })
            window.localStorage.removeItem(`${storageKeyPrefix}-${v}[${i}]`)
          })
      }
    })
  }, [storageKeyPrefix])

  const onSubmitInner = useCallback(async (values, ...args) => {
    if (requireSession && !me) {
      throw new SessionRequiredError()
    }

    try {
      if (onSubmit) {
        await onSubmit(values, ...args)
      }
    } catch (err) {
      console.log(err.message, err)
      toaster.danger(err.message ?? err.toString?.())
      return
    }

    if (!storageKeyPrefix) return
    clearLocalStorage(values)
  }, [me, onSubmit, clearLocalStorage, storageKeyPrefix])

  return (
    <Formik
      initialValues={initial}
      enableReinitialize={enableReinitialize}
      validateOnChange={validateOnChange}
      validate={validate}
      validationSchema={schema}
      initialTouched={validateImmediately && initial}
      validateOnBlur={false}
      onSubmit={onSubmitInner}
      innerRef={innerRef}
    >
      <FormikForm {...props} noValidate>
        <StorageKeyPrefixContext.Provider value={storageKeyPrefix}>
          {children}
        </StorageKeyPrefixContext.Provider>
      </FormikForm>
    </Formik>
  )
}

export function Select ({ label, items, info, groupClassName, onChange, noForm, overrideValue, hint, ...props }) {
  const [field, meta, helpers] = noForm ? [{}, {}, {}] : useField(props)
  const formik = noForm ? null : useFormikContext()
  const invalid = meta.touched && meta.error

  useEffect(() => {
    if (overrideValue) {
      helpers.setValue(overrideValue)
    }
  }, [overrideValue])

  return (
    <FormGroup label={label} className={groupClassName}>
      <span className='d-flex align-items-center'>
        <BootstrapForm.Select
          {...field} {...props}
          onChange={(e) => {
            if (field?.onChange) {
              field.onChange(e)
            }

            if (onChange) {
              onChange(formik, e)
            }
          }}
          isInvalid={invalid}
        >
          {items.map(item => {
            if (item && typeof item === 'object') {
              return (
                <optgroup key={item.label} label={item.label}>
                  {item.items.map(item => <option key={item}>{item}</option>)}
                </optgroup>
              )
            } else {
              return <option key={item}>{item}</option>
            }
          })}
        </BootstrapForm.Select>
        {info && <Info>{info}</Info>}
      </span>
      <BootstrapForm.Control.Feedback type='invalid'>
        {meta.touched && meta.error}
      </BootstrapForm.Control.Feedback>
      {hint &&
        <BootstrapForm.Text>
          {hint}
        </BootstrapForm.Text>}
    </FormGroup>
  )
}

function DatePickerSkeleton () {
  return (
    <div className='react-datepicker-wrapper'>
      <input className='form-control clouds fade-out p-0 px-2 mb-0' />
    </div>
  )
}

const ReactDatePicker = dynamic(() => import('react-datepicker').then(mod => mod.default), {
  ssr: false,
  loading: () => <DatePickerSkeleton />
})

export function DatePicker ({ fromName, toName, noForm, onChange, when, from, to, className, ...props }) {
  const formik = noForm ? null : useFormikContext()
  const [,, fromHelpers] = noForm ? [{}, {}, {}] : useField({ ...props, name: fromName })
  const [,, toHelpers] = noForm ? [{}, {}, {}] : useField({ ...props, name: toName })
  const { minDate, maxDate } = props

  const [[innerFrom, innerTo], setRange] = useState(whenRange(when, from, to))

  useEffect(() => {
    setRange(whenRange(when, from, to))
    if (!noForm) {
      fromHelpers.setValue(from)
      toHelpers.setValue(to)
    }
  }, [when, from, to])

  const dateFormat = useMemo(() => {
    const now = new Date(2013, 11, 31)
    let str = now.toLocaleDateString()
    str = str.replace('31', 'dd')
    str = str.replace('12', 'MM')
    str = str.replace('2013', 'yy')
    return str
  }, [])

  const innerOnChange = ([from, to], e) => {
    if (from) {
      from = new Date(new Date(from).setHours(0, 0, 0, 0))
    }
    if (to) {
      to = new Date(new Date(to).setHours(23, 59, 59, 999))
    }
    setRange([from, to])
    if (!noForm) {
      fromHelpers.setValue(from)
      toHelpers.setValue(to)
    }
    if (!from || !to) return
    onChange?.(formik, [from, to], e)
  }

  const onChangeRawHandler = (e) => {
    // raw user data can be incomplete while typing, so quietly bail on exceptions
    try {
      const dateStrings = e.target.value.split('-', 2)
      const dates = dateStrings.map(s => new Date(s))
      let [from, to] = dates
      if (from) {
        from = new Date(from.setHours(0, 0, 0, 0))
        if (minDate) from = new Date(Math.max(from.getTime(), minDate.getTime()))
        try {
          if (to) {
            to = new Date(to.setHours(23, 59, 59, 999))
            if (maxDate) to = new Date(Math.min(to.getTime(), maxDate.getTime()))
          }

          // if end date isn't valid, set it to the start date
          if (!(to instanceof Date && !isNaN(to)) || to < from) to = new Date(from.setHours(23, 59, 59, 999))
        } catch {
          to = new Date(from.setHours(23, 59, 59, 999))
        }
        innerOnChange([from, to], e)
      }
    } catch { }
  }

  return (
    <>
      {ReactDatePicker && (
        <ReactDatePicker
          className={`form-control text-center ${className}`}
          selectsRange
          maxDate={new Date()}
          minDate={new Date('2021-05-01')}
          {...props}
          selected={new Date(innerFrom)}
          startDate={new Date(innerFrom)}
          endDate={innerTo ? new Date(innerTo) : undefined}
          dateFormat={dateFormat}
          onChangeRaw={onChangeRawHandler}
          onChange={innerOnChange}
        />
      )}
    </>
  )
}

export function DateTimeInput ({ label, groupClassName, name, ...props }) {
  const [, meta] = useField({ ...props, name })
  return (
    <FormGroup label={label} className={groupClassName}>
      <div>
        <DateTimePicker name={name} {...props} />
        <BootstrapForm.Control.Feedback type='invalid' className='d-block'>
          {meta.error}
        </BootstrapForm.Control.Feedback>
      </div>
    </FormGroup>
  )
}

function DateTimePicker ({ name, className, ...props }) {
  const [field, , helpers] = useField({ ...props, name })
  const ReactDatePicker = dynamic(() => import('react-datepicker').then(mod => mod.default), {
    ssr: false,
    loading: () => <span>loading date picker</span>
  })
  return (
    <>
      {ReactDatePicker && (
        <ReactDatePicker
          {...field}
          {...props}
          showTimeSelect
          dateFormat='Pp'
          className={`form-control ${className}`}
          selected={(field.value && new Date(field.value)) || null}
          value={(field.value && new Date(field.value)) || null}
          onChange={(val) => {
            helpers.setValue(val)
          }}
        />
      )}
    </>
  )
}

function Client (Component) {
  return ({ initialValue, ...props }) => {
    // This component can be used for Formik fields
    // where the initial value is not available on first render.
    // Example: value is stored in localStorage which is fetched
    // after first render using an useEffect hook.
    const [,, helpers] = props.noForm ? [{}, {}, {}] : useField(props)

    useEffect(() => {
      initialValue && helpers.setValue(initialValue)
    }, [initialValue])

    return <Component {...props} />
  }
}

function PasswordHider ({ onClick, showPass }) {
  return (
    <InputGroup.Text
      style={{ cursor: 'pointer' }}
      onClick={onClick}
    >
      {!showPass
        ? <Eye
            fill='var(--bs-body-color)' height={16} width={16}
          />
        : <EyeClose
            fill='var(--bs-body-color)' height={16} width={16}
          />}
    </InputGroup.Text>
  )
}

function PasswordScanner ({ onScan, text }) {
  const showModal = useShowModal()
  const toaster = useToast()
  const Scanner = dynamic(() => import('@yudiel/react-qr-scanner').then(mod => mod.Scanner), {
    ssr: false,
    loading: () => <PageLoading />
  })

  return (
    <InputGroup.Text
      style={{ cursor: 'pointer' }}
      onClick={() => {
        showModal(onClose => {
          return (
            <div>
              {text && <h5 className='line-height-md mb-4 text-center'>{text}</h5>}
              {Scanner && (
                <Scanner
                  formats={['qr_code']}
                  onScan={([{ rawValue: result }]) => {
                    if (result) {
                      onScan(result)
                      onClose()
                    }
                  }}
                  styles={{
                    video: {
                      aspectRatio: '1 / 1'
                    }
                  }}
                  onError={(error) => {
                    if (error instanceof DOMException) {
                      console.log(error)
                    } else {
                      toaster.danger('qr scan: ' + error?.message || error?.toString?.())
                    }
                    onClose()
                  }}
                  components={{ audio: false }}
                />
              )}
            </div>
          )
        })
      }}
    >
      <QrScanIcon
        height={20} width={20} fill='var(--bs-body-color)'
      />
    </InputGroup.Text>
  )
}

export function PasswordInput ({ newPass, qr, copy, readOnly, append, value: initialValue, ...props }) {
  const [showPass, setShowPass] = useState(false)
  const [value, setValue] = useState(initialValue)
  const [field,, helpers] = props.noForm ? [{ value }, {}, { setValue }] : useField(props)

  const Append = useMemo(() => {
    return (
      <>
        <PasswordHider showPass={showPass} onClick={() => setShowPass(!showPass)} />
        {copy && (
          <CopyButton icon value={field?.value} />
        )}
        {qr && (
          <PasswordScanner
            text="Where'd you learn to square dance?"
            onScan={v => helpers.setValue(v)}
          />
        )}
        {append}
      </>
    )
  }, [showPass, copy, field?.value, helpers.setValue, qr, readOnly, append])

  const style = props.style ? { ...props.style } : {}
  if (props.as === 'textarea') {
    if (!showPass) {
      style.WebkitTextSecurity = 'disc'
    } else {
      if (style.WebkitTextSecurity) delete style.WebkitTextSecurity
    }
  }
  return (
    <ClientInput
      {...props}
      style={style}
      className={styles.passwordInput}
      type={showPass ? 'text' : 'password'}
      autoComplete={newPass ? 'new-password' : 'current-password'}
      readOnly={readOnly}
      append={props.as === 'textarea' ? undefined : Append}
      value={field?.value}
      under={props.as === 'textarea'
        ? (
          <div className='mt-2 d-flex justify-content-end' style={{ gap: '8px' }}>
            {Append}
          </div>)
        : undefined}
    />
  )
}

export function MultiInput ({
  name, label, groupClassName, length = 4, charLength = 1, upperCase, showSequence,
  onChange, autoFocus, hideError, inputType = 'text',
  ...props
}) {
  const formik = useFormikContext()
  const [inputs, setInputs] = useState(new Array(length).fill(''))
  const inputRefs = useRef(new Array(length).fill(null))
  const [, meta, helpers] = useField({ name })

  useEffect(() => {
    autoFocus && inputRefs.current[0].focus() // focus the first input if autoFocus is true
  }, [autoFocus])

  const updateInputs = useCallback((newInputs) => {
    setInputs(newInputs)
    const combinedValue = newInputs.join('') // join the inputs to get the value
    helpers.setValue(combinedValue) // set the value to the formik field
    onChange?.(combinedValue)
  }, [onChange, helpers])

  const handleChange = useCallback((formik, e, index) => { // formik is not used but it's required to get the value
    const value = e.target.value.slice(-charLength)
    const processedValue = upperCase ? value.toUpperCase() : value // convert the input to uppercase if upperCase is tru

    const newInputs = [...inputs]
    newInputs[index] = processedValue
    updateInputs(newInputs)

    // focus the next input if the current input is filled
    if (processedValue.length === charLength && index < length - 1) {
      inputRefs.current[index + 1].focus()
    }
  }, [inputs, charLength, upperCase, onChange, length])

  const handlePaste = useCallback((e) => {
    e.preventDefault()
    const pastedValues = e.clipboardData.getData('text').slice(0, length)
    const processedValues = upperCase ? pastedValues.toUpperCase() : pastedValues
    const chars = processedValues.split('')

    const newInputs = [...inputs]
    chars.forEach((char, i) => {
      newInputs[i] = char.slice(0, charLength)
    })

    updateInputs(newInputs)
    inputRefs.current[length - 1]?.focus() // simulating the paste by focusing the last input
  }, [inputs, length, charLength, upperCase, updateInputs])

  const handleKeyDown = useCallback((e, index) => {
    switch (e.key) {
      case 'Backspace': {
        e.preventDefault()
        const newInputs = [...inputs]
        // if current input is empty move focus to the previous input else clear the current input
        const targetIndex = inputs[index] === '' && index > 0 ? index - 1 : index
        newInputs[targetIndex] = ''
        updateInputs(newInputs)
        inputRefs.current[targetIndex]?.focus()
        break
      }
      case 'ArrowLeft': {
        if (index > 0) { // focus the previous input if it's not the first input
          e.preventDefault()
          inputRefs.current[index - 1]?.focus()
        }
        break
      }
      case 'ArrowRight': {
        if (index < length - 1) { // focus the next input if it's not the last input
          e.preventDefault()
          inputRefs.current[index + 1]?.focus()
        }
        break
      }
    }
  }, [inputs, length, updateInputs])

  return (
    <FormGroup label={label} className={groupClassName}>
      <div className='d-flex flex-row justify-content-center gap-2'>
        {inputs.map((value, index) => (
          <InputInner
            inputGroupClassName='w-auto'
            name={name}
            key={index}
            type={inputType}
            value={value}
            innerRef={(el) => { inputRefs.current[index] = el }}
            onChange={(formik, e) => handleChange(formik, e, index)}
            onKeyDown={e => handleKeyDown(e, index)}
            onPaste={e => handlePaste(e, index)}
            style={{
              textAlign: 'center',
              maxWidth: `${charLength * 44}px` // adjusts the max width of the input based on the charLength
            }}
            prepend={showSequence && <InputGroup.Text>{index + 1}</InputGroup.Text>} // show the index of the input
            hideError
            {...props}
          />
        ))}
      </div>
      <div>
        {hideError && formik.submitCount > 0 && meta.touched && meta.error && ( // custom error message is showed if hideError is true
          <BootstrapForm.Control.Feedback type='invalid' className='d-block'>
            {meta.error}
          </BootstrapForm.Control.Feedback>
        )}
      </div>
    </FormGroup>
  )
}

export const ClientInput = Client(Input)
export const ClientCheckbox = Client(Checkbox)
