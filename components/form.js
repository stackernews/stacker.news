import Button from 'react-bootstrap/Button'
import InputGroup from 'react-bootstrap/InputGroup'
import BootstrapForm from 'react-bootstrap/Form'
import Alert from 'react-bootstrap/Alert'
import { Formik, Form as FormikForm, useFormikContext, useField } from 'formik'
import { useRef, useState } from 'react'
import copy from 'clipboard-copy'
import Thumb from '../svgs/thumb-up-fill.svg'

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

export function Input ({ label, prepend, append, hint, showValid, groupClassName, ...props }) {
  const [field, meta] = props.readOnly ? [{}, {}] : useField(props)
  return (
    <BootstrapForm.Group className={groupClassName}>
      {label && <BootstrapForm.Label>{label}</BootstrapForm.Label>}
      <InputGroup hasValidation>
        {prepend && (
          <InputGroup.Prepend>
            {prepend}
          </InputGroup.Prepend>
        )}
        <BootstrapForm.Control
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
    </BootstrapForm.Group>
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
