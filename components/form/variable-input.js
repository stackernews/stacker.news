import { FieldArray } from 'formik'
import { useId } from 'react'
import AddIcon from '@/svgs/add-fill.svg'
import { FormGroup, hintClasses, errorClasses } from './field'
import { InputInner } from './input'
import classNames from 'classnames'

export function VariableInput ({ label, groupClassName, name, hint, max, min, readOnlyLen, children, emptyItem = '', ...props }) {
  const labelId = useId()
  return (
    <FormGroup label={label} labelId={labelId} className={groupClassName}>
      <div role='group' aria-labelledby={label ? labelId : undefined}>
        <FieldArray name={name} hasValidation>
          {({ form, ...fieldArrayHelpers }) => {
            const options = form.values[name]

            return (
              <>
                {options?.map((_, i) => {
                  const AppendColumn = ({ className }) => (
                    <div className={classNames('flex', className)}>
                      {options.length - 1 === i && options.length !== max
                        // onMouseDown is used to prevent the blur event on text inputs from overriding the click event
                        ? (
                          <button
                            type='button'
                            aria-label='add another'
                            className='self-center justify-self-center'
                            onMouseDown={e => e.preventDefault()}
                            onClick={() => fieldArrayHelpers.push(emptyItem)}
                          >
                            <AddIcon className='fill-muted' />
                          </button>
                          )
                        // filler div for col alignment across rows
                        : <div style={{ width: '24px', height: '24px' }} />}
                    </div>
                  )
                  return (
                    <div key={i} className='mb-2'>
                      {children
                        ? children({ index: i, readOnly: i < readOnlyLen, placeholder: i >= min ? 'optional' : undefined, AppendColumn })
                        : <InputInner name={`${name}[${i}]`} {...props} readOnly={i < readOnlyLen} placeholder={i >= min ? 'optional' : undefined} AppendColumn={AppendColumn} />}

                      {options.length - 1 === i &&
                        <>
                          {hint && <small className={hintClasses()}>{hint}</small>}
                          {form.touched[name] && typeof form.errors[name] === 'string' &&
                            <div className={errorClasses()}>{form.errors[name]}</div>}
                        </>}
                    </div>
                  )
                })}
              </>
            )
          }}
        </FieldArray>
      </div>
    </FormGroup>
  )
}
