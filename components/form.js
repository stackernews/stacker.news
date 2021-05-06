import Button from 'react-bootstrap/Button'
import InputGroup from 'react-bootstrap/InputGroup'
import BootstrapForm from 'react-bootstrap/Form'
import Alert from 'react-bootstrap/Alert'
import { Formik, Form as FormikForm, useFormikContext, useField } from 'formik'
import { useRef, useState } from 'react'

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

export function Input ({ label, prepend, append, hint, ...props }) {
  const [field, meta] = useField(props)

  return (
    <BootstrapForm.Group>
      {label && <BootstrapForm.Label>{label}</BootstrapForm.Label>}
      <InputGroup hasValidation>
        {prepend && (
          <InputGroup.Prepend>
            <InputGroup.Text>{prepend}</InputGroup.Text>
          </InputGroup.Prepend>
        )}
        <BootstrapForm.Control
          {...field} {...props}
          isInvalid={meta.touched && meta.error}
        />
        {append && (
          <InputGroup.Append>
            <InputGroup.Text>{append}</InputGroup.Text>
          </InputGroup.Append>
        )}
        <BootstrapForm.Control.Feedback type='invalid'>
          {meta.touched && meta.error}
        </BootstrapForm.Control.Feedback>
        {hint && (
          <BootstrapForm.Text>
            {hint}
          </BootstrapForm.Text>
        )}
      </InputGroup>
    </BootstrapForm.Group>
  )
}

export function Form ({
  initial, schema, onSubmit, children, ...props
}) {
  const [error, setError] = useState()

  return (
    <Formik
      initialValues={initial}
      validationSchema={schema}
      validateOnBlur={false}
      onSubmit={async (...args) =>
        onSubmit && onSubmit(...args).catch(e => setError(e.message))}
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
