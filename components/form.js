import Button from 'react-bootstrap/Button'
import InputGroup from 'react-bootstrap/InputGroup'
import BootstrapForm from 'react-bootstrap/Form'
import Alert from 'react-bootstrap/Alert'
import { Formik, Form as FormikForm, useFormikContext, useField } from 'formik'
import { useEffect, useRef, useState } from 'react'
import copy from 'clipboard-copy'
import Thumb from '../svgs/thumb-up-fill.svg'
import { Nav } from 'react-bootstrap'
import Markdown from '../svgs/markdown-line.svg'
import styles from './form.module.css'
import Text from '../components/text'

export function SubmitButton ({ children, variant, ...props }) {
  const { isSubmitting } = useFormikContext()
  return (
    <Button
      variant={variant || 'main'}
      type='submit'
      disabled={isSubmitting}
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

export function InputSkeleton ({ label }) {
  return (
    <BootstrapForm.Group>
      {label && <BootstrapForm.Label>{label}</BootstrapForm.Label>}
      <div className='clouds form-control' />
    </BootstrapForm.Group>
  )
}

export function MarkdownInput ({ label, groupClassName, ...props }) {
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
            {...props}
          />
        </div>
        <div className={tab !== 'preview' ? 'd-none' : 'form-group'}>
          <div className={`${styles.text} form-control`}>
            <Text>{meta.value}</Text>
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

function InputInner ({ prepend, append, hint, showValid, ...props }) {
  const [field, meta] = props.readOnly ? [{}, {}] : useField(props)
  const formik = props.readOnly ? null : useFormikContext()
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
          }}
          {...field} {...props}
          isInvalid={meta.touched && meta.error}
          isValid={showValid && meta.touched && !meta.error}
        />
        {append && (
          <InputGroup.Append>
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

export function Input ({ label, groupClassName, ...props }) {
  return (
    <FormGroup label={label} className={groupClassName}>
      <InputInner {...props} />
    </FormGroup>
  )
}

export function Form ({
  initial, schema, onSubmit, children, initialError, validateImmediately, ...props
}) {
  const [error, setError] = useState(initialError)

  return (
    <Formik
      initialValues={initial}
      validationSchema={schema}
      initialTouched={validateImmediately && initial}
      validateOnBlur={false}
      onSubmit={async (...args) =>
        onSubmit && onSubmit(...args).catch(e => setError(e.message || e))}
    >
      <FormikForm {...props} noValidate>
        {error && <Alert variant='danger' onClose={() => setError(undefined)} dismissible>{error}</Alert>}
        {children}
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
