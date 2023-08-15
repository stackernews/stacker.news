import Button from 'react-bootstrap/Button'
import InputGroup from 'react-bootstrap/InputGroup'
import BootstrapForm from 'react-bootstrap/Form'
import Alert from 'react-bootstrap/Alert'
import { Formik, Form as FormikForm, useFormikContext, useField, FieldArray } from 'formik'
import React, { createContext, useContext, useEffect, useRef, useState } from 'react'
import copy from 'clipboard-copy'
import Thumb from '../svgs/thumb-up-fill.svg'
import Col from 'react-bootstrap/Col'
import Dropdown from 'react-bootstrap/Dropdown'
import Nav from 'react-bootstrap/Nav'
import Row from 'react-bootstrap/Row'
import Markdown from '../svgs/markdown-line.svg'
import styles from './form.module.css'
import Text from '../components/text'
import AddIcon from '../svgs/add-fill.svg'
import { mdHas } from '../lib/md'
import CloseIcon from '../svgs/close-line.svg'
import { useLazyQuery } from '@apollo/client'
import { USER_SEARCH } from '../fragments/users'
import TextareaAutosize from 'react-textarea-autosize'

export function SubmitButton ({
  children, variant, value, onClick, disabled, ...props
}) {
  const { isSubmitting, setFieldValue } = useFormikContext()
  return (
    <Button
      variant={variant || 'main'}
      type='submit'
      disabled={disabled || isSubmitting}
      onClick={value
        ? e => {
          setFieldValue('submit', value)
          onClick && onClick(e)
        }
        : onClick}
      {...props}
    >
      {children}
    </Button>
  )
}

export function CopyInput (props) {
  const [copied, setCopied] = useState(false)

  const handleClick = () => {
    copy(props.placeholder)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <Input
      onClick={handleClick}
      append={
        <Button
          className={styles.appendButton}
          size={props.size}
          onClick={handleClick}
        >
          {copied ? <Thumb width={18} height={18} /> : 'copy'}
        </Button>
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

export function MarkdownInput ({ label, topLevel, groupClassName, onChange, setHasImgLink, onKeyDown, innerRef, ...props }) {
  const [tab, setTab] = useState('write')
  const [, meta, helpers] = useField(props)
  const [selectionRange, setSelectionRange] = useState({ start: 0, end: 0 })
  innerRef = innerRef || useRef(null)

  props.as ||= TextareaAutosize
  props.rows ||= props.minRows || 6

  useEffect(() => {
    !meta.value && setTab('write')
  }, [meta.value])

  useEffect(() => {
    if (selectionRange.start <= selectionRange.end && innerRef?.current) {
      const { start, end } = selectionRange
      const input = innerRef.current
      input.setSelectionRange(start, end)
    }
  }, [innerRef, selectionRange.start, selectionRange.end])

  return (
    <FormGroup label={label} className={groupClassName}>
      <div className={`${styles.markdownInput} ${tab === 'write' ? styles.noTopLeftRadius : ''}`}>
        <Nav variant='tabs' defaultActiveKey='write' activeKey={tab} onSelect={tab => setTab(tab)}>
          <Nav.Item>
            <Nav.Link eventKey='write'>write</Nav.Link>
          </Nav.Item>
          <Nav.Item>
            <Nav.Link eventKey='preview' disabled={!meta.value}>preview</Nav.Link>
          </Nav.Item>
          <a
            className='ms-auto text-muted d-flex align-items-center'
            href='https://guides.github.com/features/mastering-markdown/' target='_blank' rel='noreferrer'
          >
            <Markdown width={18} height={18} />
          </a>
        </Nav>
        {tab === 'write'
          ? (
            <div>
              <InputInner
                {...props} onChange={(formik, e) => {
                  if (onChange) onChange(formik, e)
                  if (setHasImgLink) {
                    setHasImgLink(mdHas(e.target.value, ['link', 'image']))
                  }
                }}
                innerRef={innerRef}
                onKeyDown={(e) => {
                  const metaOrCtrl = e.metaKey || e.ctrlKey
                  if (metaOrCtrl) {
                    if (e.key === 'k') {
                      // some browsers use CTRL+K to focus search bar so we have to prevent that behavior
                      e.preventDefault()
                      insertMarkdownLinkFormatting(innerRef.current, helpers.setValue, setSelectionRange)
                    }
                    if (e.key === 'b') {
                      // some browsers use CTRL+B to open bookmarks so we have to prevent that behavior
                      e.preventDefault()
                      insertMarkdownBoldFormatting(innerRef.current, helpers.setValue, setSelectionRange)
                    }
                    if (e.key === 'i') {
                      // some browsers might use CTRL+I to do something else so prevent that behavior too
                      e.preventDefault()
                      insertMarkdownItalicFormatting(innerRef.current, helpers.setValue, setSelectionRange)
                    }
                    if (e.key === 'Tab' && e.altKey) {
                      e.preventDefault()
                      insertMarkdownTabFormatting(innerRef.current, helpers.setValue, setSelectionRange)
                    }
                  }

                  if (onKeyDown) onKeyDown(e)
                }}
              />
            </div>)
          : (
            <div className='form-group'>
              <div className={`${styles.text} form-control`}>
                <Text topLevel={topLevel} noFragments onlyImgProxy={false}>{meta.value}</Text>
              </div>
            </div>
            )}

      </div>
    </FormGroup>
  )
}

function insertMarkdownFormatting (replaceFn, selectFn) {
  return function (input, setValue, setSelectionRange) {
    const start = input.selectionStart
    const end = input.selectionEnd
    const val = input.value
    const selectedText = val.substring(start, end)
    const mdFormatted = replaceFn(selectedText)
    const newVal = val.substring(0, start) + mdFormatted + val.substring(end)
    setValue(newVal)
    // required for undo, see https://stackoverflow.com/a/27028258
    document.execCommand('insertText', false, mdFormatted)
    // see https://github.com/facebook/react/issues/6483
    // for why we don't use `input.setSelectionRange` directly (hint: event order)
    setSelectionRange(selectFn ? selectFn(start, end, mdFormatted) : { start: start + mdFormatted.length, end: start + mdFormatted.length })
  }
}

const insertMarkdownTabFormatting = insertMarkdownFormatting(
  val => `\t${val}`,
  (start, end, mdFormatted) => ({ start: start + 1, end: end + 1 }) // move inside tab
)
const insertMarkdownLinkFormatting = insertMarkdownFormatting(
  val => `[${val}](url)`,
  (start, end, mdFormatted) => (
    start === end
      ? { start: start + 1, end: end + 1 } // move inside brackets
      : { start: start + mdFormatted.length - 4, end: start + mdFormatted.length - 1 }) // move to select url part
)
const insertMarkdownBoldFormatting = insertMarkdownFormatting(
  val => `**${val}**`,
  (start, end, mdFormatted) => ({ start: start + 2, end: end + 2 }) // move inside bold
)
const insertMarkdownItalicFormatting = insertMarkdownFormatting(
  val => `_${val}_`,
  (start, end, mdFormatted) => ({ start: start + 1, end: end + 1 }) // move inside italic
)

function FormGroup ({ className, label, children }) {
  return (
    <BootstrapForm.Group className={`form-group ${className}`}>
      {label && <BootstrapForm.Label>{label}</BootstrapForm.Label>}
      {children}
    </BootstrapForm.Group>
  )
}

function InputInner ({
  prepend, append, hint, showValid, onChange, overrideValue,
  innerRef, noForm, clear, onKeyDown, debounce, ...props
}) {
  const [field, meta, helpers] = noForm ? [{}, {}, {}] : useField(props)
  const formik = noForm ? null : useFormikContext()
  const storageKeyPrefix = useContext(StorageKeyPrefixContext)

  const storageKey = storageKeyPrefix ? storageKeyPrefix + '-' + props.name : undefined

  useEffect(() => {
    if (overrideValue) {
      helpers.setValue(overrideValue)
      if (storageKey) {
        window.localStorage.setItem(storageKey, overrideValue)
      }
    } else if (storageKey) {
      const draft = window.localStorage.getItem(storageKey)
      if (draft) {
        // for some reason we have to turn off validation to get formik to
        // not assume this is invalid
        helpers.setValue(draft, false)
      }
    }
  }, [overrideValue])

  const invalid = (!formik || formik.submitCount > 0) && meta.touched && meta.error

  const debounceRef = useRef(-1)

  useEffect(() => {
    if (debounceRef.current !== -1) {
      clearTimeout(debounceRef.current)
    }
    if (!noForm && !isNaN(debounce) && debounce > 0) {
      debounceRef.current = setTimeout(() => formik.validateForm(), debounce)
    }
    return () => clearTimeout(debounceRef.current)
  }, [noForm, formik, field.value])

  return (
    <>
      <InputGroup hasValidation>
        {prepend}
        <BootstrapForm.Control
          onKeyDown={(e) => {
            const metaOrCtrl = e.metaKey || e.ctrlKey
            if (metaOrCtrl) {
              if (e.key === 'Enter') formik?.submitForm()
            }

            if (onKeyDown) onKeyDown(e)
          }}
          ref={innerRef}
          {...field} {...props}
          onChange={(e) => {
            field.onChange(e)

            if (storageKey) {
              window.localStorage.setItem(storageKey, e.target.value)
            }

            if (onChange) {
              onChange(formik, e)
            }
          }}
          isInvalid={invalid}
          isValid={showValid && meta.initialValue !== meta.value && meta.touched && !meta.error}
        />
        {(clear && field.value) &&
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
      {hint && (
        <BootstrapForm.Text>
          {hint}
        </BootstrapForm.Text>
      )}
    </>
  )
}

export function InputUserSuggest ({ label, groupClassName, ...props }) {
  const [getSuggestions] = useLazyQuery(USER_SEARCH, {
    onCompleted: data => {
      setSuggestions({ array: data.searchUsers, index: 0 })
    }
  })

  const INITIAL_SUGGESTIONS = { array: [], index: 0 }
  const [suggestions, setSuggestions] = useState(INITIAL_SUGGESTIONS)
  const [ovalue, setOValue] = useState()

  return (
    <FormGroup label={label} className={groupClassName}>
      <InputInner
        {...props}
        autoComplete='off'
        onChange={(_, e) => getSuggestions({ variables: { q: e.target.value } })}
        overrideValue={ovalue}
        onKeyDown={(e) => {
          switch (e.code) {
            case 'ArrowUp':
              e.preventDefault()
              setSuggestions(
                {
                  ...suggestions,
                  index: Math.max(suggestions.index - 1, 0)
                })
              break
            case 'ArrowDown':
              e.preventDefault()
              setSuggestions(
                {
                  ...suggestions,
                  index: Math.min(suggestions.index + 1, suggestions.array.length - 1)
                })
              break
            case 'Enter':
              e.preventDefault()
              setOValue(suggestions.array[suggestions.index].name)
              setSuggestions(INITIAL_SUGGESTIONS)
              break
            case 'Escape':
              e.preventDefault()
              setSuggestions(INITIAL_SUGGESTIONS)
              break
            default:
              break
          }
        }}
      />
      <Dropdown show={suggestions.array.length > 0}>
        <Dropdown.Menu className={styles.suggestionsMenu}>
          {suggestions.array.map((v, i) =>
            <Dropdown.Item
              key={v.name}
              active={suggestions.index === i}
              onClick={() => {
                setOValue(v.name)
                setSuggestions(INITIAL_SUGGESTIONS)
              }}
            >
              {v.name}
            </Dropdown.Item>)}
        </Dropdown.Menu>
      </Dropdown>
    </FormGroup>
  )
}

export function Input ({ label, groupClassName, ...props }) {
  return (
    <FormGroup label={label} className={groupClassName}>
      <InputInner {...props} />
    </FormGroup>
  )
}

export function VariableInput ({ label, groupClassName, name, hint, max, min, readOnlyLen, ...props }) {
  return (
    <FormGroup label={label} className={groupClassName}>
      <FieldArray name={name}>
        {({ form, ...fieldArrayHelpers }) => {
          const options = form.values[name]
          return (
            <>
              {options?.map((_, i) => (
                <div key={i}>
                  <Row className='mb-2'>
                    <Col>
                      <InputInner name={`${name}[${i}]`} {...props} readOnly={i < readOnlyLen} placeholder={i >= min ? 'optional' : undefined} />
                    </Col>
                    {options.length - 1 === i && options.length !== max
                      ? <Col className='d-flex ps-0' xs='auto'><AddIcon className='fill-grey align-self-center justify-self-center pointer' onClick={() => fieldArrayHelpers.push('')} /></Col>
                      : null}
                  </Row>
                </div>
              ))}
            </>
          )
        }}
      </FieldArray>
      {hint && (
        <BootstrapForm.Text>
          {hint}
        </BootstrapForm.Text>
      )}
    </FormGroup>
  )
}

export function Checkbox ({ children, label, groupClassName, hiddenLabel, extra, handleChange, inline, disabled, ...props }) {
  // React treats radios and checkbox inputs differently other input types, select, and textarea.
  // Formik does this too! When you specify `type` to useField(), it will
  // return the correct bag of props for you
  const [field,, helpers] = useField({ ...props, type: 'checkbox' })
  return (
    <FormGroup className={groupClassName}>
      {hiddenLabel && <BootstrapForm.Label className='invisible'>{label}</BootstrapForm.Label>}
      <BootstrapForm.Check
        id={props.id || props.name}
        inline={inline}
      >
        <BootstrapForm.Check.Input
          {...field} {...props} disabled={disabled} type='checkbox' onChange={(e) => {
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

const StorageKeyPrefixContext = createContext()

export function Form ({
  initial, schema, onSubmit, children, initialError, validateImmediately, storageKeyPrefix, validateOnChange = true, ...props
}) {
  const [error, setError] = useState(initialError)

  return (
    <Formik
      initialValues={initial}
      validateOnChange={validateOnChange}
      validationSchema={schema}
      initialTouched={validateImmediately && initial}
      validateOnBlur={false}
      onSubmit={async (values, ...args) =>
        onSubmit && onSubmit(values, ...args).then((options) => {
          if (!storageKeyPrefix || options?.keepLocalStorage) return
          Object.keys(values).forEach(v => {
            window.localStorage.removeItem(storageKeyPrefix + '-' + v)
            if (Array.isArray(values[v])) {
              values[v].forEach(
                (_, i) => window.localStorage.removeItem(`${storageKeyPrefix}-${v}[${i}]`))
            }
          }
          )
        }).catch(e => setError(e.message || e))}
    >
      <FormikForm {...props} noValidate>
        {error && <Alert variant='danger' onClose={() => setError(undefined)} dismissible>{error}</Alert>}
        <StorageKeyPrefixContext.Provider value={storageKeyPrefix}>
          {children}
        </StorageKeyPrefixContext.Provider>
      </FormikForm>
    </Formik>
  )
}

export function Select ({ label, items, groupClassName, onChange, noForm, overrideValue, ...props }) {
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
        {items.map(item => <option key={item}>{item}</option>)}
      </BootstrapForm.Select>
      <BootstrapForm.Control.Feedback type='invalid'>
        {meta.touched && meta.error}
      </BootstrapForm.Control.Feedback>
    </FormGroup>
  )
}
