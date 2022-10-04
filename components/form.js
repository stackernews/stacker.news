import Button from 'react-bootstrap/Button'
import InputGroup from 'react-bootstrap/InputGroup'
import BootstrapForm from 'react-bootstrap/Form'
import Alert from 'react-bootstrap/Alert'
import { Formik, Form as FormikForm, useFormikContext, useField, FieldArray } from 'formik'
import React, { useEffect, useRef, useState } from 'react'
import copy from 'clipboard-copy'
import Thumb from '../svgs/thumb-up-fill.svg'
import { Col, Dropdown, Nav } from 'react-bootstrap'
import Markdown from '../svgs/markdown-line.svg'
import styles from './form.module.css'
import Text from '../components/text'
import AddIcon from '../svgs/add-fill.svg'
import { mdHas } from '../lib/md'
import CloseIcon from '../svgs/close-line.svg'
import { useLazyQuery } from '@apollo/client'
import { USER_SEARCH } from '../fragments/users'

export function SubmitButton ({
  children, variant, value, onClick, ...props
}) {
  const { isSubmitting, setFieldValue } = useFormikContext()
  return (
    <Button
      variant={variant || 'main'}
      type='submit'
      disabled={isSubmitting}
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
      <div className='form-control clouds' />
      {hint &&
        <BootstrapForm.Text>
          {hint}
        </BootstrapForm.Text>}
    </BootstrapForm.Group>
  )
}

export function MarkdownInput ({ label, topLevel, groupClassName, onChange, setHasImgLink, ...props }) {
  const [tab, setTab] = useState('write')
  const [, meta] = useField(props)

  useEffect(() => {
    !meta.value && setTab('write')
  }, [meta.value])

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
            className='ml-auto text-muted d-flex align-items-center'
            href='https://guides.github.com/features/mastering-markdown/' target='_blank' rel='noreferrer'
          >
            <Markdown width={18} height={18} />
          </a>
        </Nav>
        <div className={tab !== 'write' ? 'd-none' : ''}>
          <InputInner
            {...props} onChange={(formik, e) => {
              if (onChange) onChange(formik, e)
              if (setHasImgLink) {
                setHasImgLink(mdHas(e.target.value, ['link', 'image']))
              }
            }}
          />
        </div>
        <div className={tab !== 'preview' ? 'd-none' : 'form-group'}>
          <div className={`${styles.text} form-control`}>
            {tab === 'preview' && <Text topLevel={topLevel} noFragments>{meta.value}</Text>}
          </div>
        </div>
      </div>
    </FormGroup>
  )
}

function FormGroup ({ className, label, children }) {
  return (
    <BootstrapForm.Group className={className}>
      {label && <BootstrapForm.Label>{label}</BootstrapForm.Label>}
      {children}
    </BootstrapForm.Group>
  )
}

function InputInner ({
  prepend, append, hint, showValid, onChange, overrideValue,
  innerRef, storageKeyPrefix, noForm, clear, onKeyDown, ...props
}) {
  const [field, meta, helpers] = noForm ? [{}, {}, {}] : useField(props)
  const formik = noForm ? null : useFormikContext()

  const storageKey = storageKeyPrefix ? storageKeyPrefix + '-' + props.name : undefined

  useEffect(() => {
    if (overrideValue) {
      helpers.setValue(overrideValue)
      if (storageKey) {
        localStorage.setItem(storageKey, overrideValue)
      }
    } else if (storageKey) {
      const draft = localStorage.getItem(storageKey)
      if (draft) {
        // for some reason we have to turn off validation to get formik to
        // not assume this is invalid
        helpers.setValue(draft, false)
      }
    }
  }, [overrideValue])

  const invalid = meta.touched && meta.error

  return (
    <>
      <InputGroup hasValidation>
        {prepend && (
          <InputGroup.Prepend>
            {prepend}
          </InputGroup.Prepend>
        )}
        <BootstrapForm.Control
          onKeyDown={(e) => {
            if (e.keyCode === 13 && (e.metaKey || e.ctrlKey)) {
              formik?.submitForm()
            }
            if (onKeyDown) onKeyDown(e)
          }}
          ref={innerRef}
          {...field} {...props}
          onChange={(e) => {
            field.onChange(e)

            if (storageKey) {
              localStorage.setItem(storageKey, e.target.value)
            }

            if (onChange) {
              onChange(formik, e)
            }
          }}
          isInvalid={invalid}
          isValid={showValid && meta.initialValue !== meta.value && meta.touched && !meta.error}
        />
        {(append || (clear && field.value)) && (
          <InputGroup.Append>
            {(clear && field.value) &&
              <Button
                variant={null}
                onClick={() => {
                  helpers.setValue('')
                  if (storageKey) {
                    localStorage.removeItem(storageKey)
                  }
                }}
                className={`${styles.clearButton} ${invalid ? styles.isInvalid : ''}`}
              ><CloseIcon className='fill-grey' height={20} width={20} />
              </Button>}
            {append}
          </InputGroup.Append>
        )}
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
    fetchPolicy: 'network-only',
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
        onChange={(_, e) => getSuggestions({ variables: { name: e.target.value } })}
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

export function VariableInput ({ label, groupClassName, name, hint, max, readOnlyLen, ...props }) {
  return (
    <FormGroup label={label} className={groupClassName}>
      <FieldArray name={name}>
        {({ form, ...fieldArrayHelpers }) => {
          const options = form.values[name]
          return (
            <>
              {options.map((_, i) => (
                <div key={i}>
                  <BootstrapForm.Row className='mb-2'>
                    <Col>
                      <InputInner name={`${name}[${i}]`} {...props} readOnly={i < readOnlyLen} placeholder={i > 1 ? 'optional' : undefined} />
                    </Col>
                    {options.length - 1 === i && options.length !== max
                      ? <AddIcon className='fill-grey align-self-center pointer mx-2' onClick={() => fieldArrayHelpers.push('')} />
                      : null}
                  </BootstrapForm.Row>
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

export function Checkbox ({ children, label, groupClassName, hiddenLabel, extra, handleChange, inline, ...props }) {
  // React treats radios and checkbox inputs differently other input types, select, and textarea.
  // Formik does this too! When you specify `type` to useField(), it will
  // return the correct bag of props for you
  const [field] = useField({ ...props, type: 'checkbox' })
  return (
    <BootstrapForm.Group className={groupClassName}>
      {hiddenLabel && <BootstrapForm.Label className='invisible'>{label}</BootstrapForm.Label>}
      <BootstrapForm.Check
        custom
        id={props.id || props.name}
        inline={inline}
      >
        <BootstrapForm.Check.Input
          {...field} {...props} type='checkbox' onChange={(e) => {
            field.onChange(e)
            handleChange && handleChange(e.target.checked)
          }}
        />
        <BootstrapForm.Check.Label className='d-flex'>
          <div className='flex-grow-1'>{label}</div>
          {extra &&
            <div className={styles.checkboxExtra}>
              {extra}
            </div>}
        </BootstrapForm.Check.Label>
      </BootstrapForm.Check>
    </BootstrapForm.Group>
  )
}

export function Form ({
  initial, schema, onSubmit, children, initialError, validateImmediately, storageKeyPrefix, ...props
}) {
  const [error, setError] = useState(initialError)

  return (
    <Formik
      initialValues={initial}
      validationSchema={schema}
      initialTouched={validateImmediately && initial}
      validateOnBlur={false}
      onSubmit={async (values, ...args) =>
        onSubmit && onSubmit(values, ...args).then(() => {
          if (!storageKeyPrefix) return
          Object.keys(values).forEach(v => {
            localStorage.removeItem(storageKeyPrefix + '-' + v)
            if (Array.isArray(values[v])) {
              values[v].forEach(
                (_, i) => localStorage.removeItem(`${storageKeyPrefix}-${v}[${i}]`))
            }
          }
          )
        }).catch(e => setError(e.message || e))}
    >
      <FormikForm {...props} noValidate>
        {error && <Alert variant='danger' onClose={() => setError(undefined)} dismissible>{error}</Alert>}
        {storageKeyPrefix
          ? React.Children.map(children, (child) => {
              // if child has a type that's a string, it's a dom element and can't get a prop
              if (child) {
                let childProps = {}
                if (typeof child.type !== 'string') {
                  childProps = { storageKeyPrefix }
                }
                return React.cloneElement(child, childProps)
              }
            })
          : children}
      </FormikForm>
    </Formik>
  )
}

export function SyncForm ({
  initial, schema, children, action, ...props
}) {
  const ref = useRef(null)
  return (
    <Formik
      initialValues={initial}
      validationSchema={schema}
      validateOnBlur={false}
      onSubmit={() => ref.current.submit()}
    >
      {props => (
        <form
          ref={ref}
          onSubmit={props.handleSubmit}
          onReset={props.handleReset}
          action={action}
          method='POST'
          noValidate
        >
          {children}
        </form>
      )}
    </Formik>
  )
}
