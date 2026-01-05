import { useEffect } from 'react'
import BootstrapForm from 'react-bootstrap/Form'
import { useFormikContext, useField } from 'formik'
import ReactSelect, { components as ReactSelectComponents } from 'react-select'
import ArrowDownSFill from '@/svgs/arrow-down-s-fill.svg'
import CloseIcon from '@/svgs/close-line.svg'
import Info from './info'
import styles from './multi-select.module.css'
import classNames from 'classnames'

function FormGroup ({ className, label, children }) {
  return (
    <BootstrapForm.Group className={`form-group ${className}`}>
      {label && <BootstrapForm.Label>{label}</BootstrapForm.Label>}
      {children}
    </BootstrapForm.Group>
  )
}

const DropdownIndicator = (props) => {
  const { selectProps } = props
  const size = selectProps.size || 'md'
  const iconSize = size === 'sm' ? 16 : size === 'lg' ? 24 : 20
  return (
    <div className={styles.dropdownIndicator}>
      <ArrowDownSFill width={iconSize} height={iconSize} className='fill-grey' />
    </div>
  )
}

const ClearIndicator = (props) => {
  const { innerProps, selectProps } = props
  const size = selectProps.size || 'md'
  const iconSize = size === 'sm' ? 14 : size === 'lg' ? 20 : 16
  return (
    <div {...innerProps} className={styles.clearIndicator}>
      <CloseIcon width={iconSize} height={iconSize} className='fill-grey' />
    </div>
  )
}

const MultiValueRemove = (props) => {
  const { innerProps } = props
  return (
    <div {...innerProps} className={styles.multiValueRemove}>
      <CloseIcon width={14} height={14} className='fill-grey' />
    </div>
  )
}

export function MultiSelect ({ label, items, size = 'lg', info, groupClassName, onChange, noForm, overrideValue, hint, placeholder, onValueClick, ...props }) {
  const [field, meta, helpers] = noForm ? [{}, {}, {}] : useField(props)
  const formik = noForm ? null : useFormikContext()
  const invalid = meta.touched && meta.error

  useEffect(() => {
    if (overrideValue) {
      helpers.setValue(overrideValue)
    }
  }, [overrideValue])

  // Convert items to react-select option format, handling grouped items
  const options = items.map(item => {
    if (item && typeof item === 'object' && item.label && item.items) {
      // Handle grouped items (e.g., muted subs)
      return {
        label: item.label,
        options: item.items.map(subItem => ({ label: subItem, value: subItem }))
      }
    }
    return { label: item, value: item }
  })

  // Flatten options to get all possible values for matching
  const flatOptions = options.flatMap(opt =>
    opt.options ? opt.options : [opt]
  )

  // Convert formik's string array to react-select's object array format for display
  const currentValue = field.value || props.value || []
  const selectValue = flatOptions.filter(option => currentValue.includes(option.value))

  const MultiValueLabel = (props) => {
    const { data } = props

    const handleMouseDown = (e) => {
      if (onValueClick) {
        e.preventDefault()
        e.stopPropagation()
        onValueClick(data.value)
      }
    }

    return (
      <div
        onMouseDown={handleMouseDown}
        className={onValueClick ? styles.multiValueLabelClickable : styles.multiValueLabelDefault}
      >
        <ReactSelectComponents.MultiValueLabel {...props} />
      </div>
    )
  }

  return (
    <FormGroup label={label} className={groupClassName}>
      <span className='d-flex align-items-center'>
        <ReactSelect
          instanceId={field.name + '-multi-select'}
          name={field.name}
          className={classNames(styles.multiSelect, styles[size], invalid && styles.isInvalid)}
          classNamePrefix='ms'
          value={selectValue}
          placeholder={placeholder}
          defaultValue={[]}
          isMulti
          size={size}
          options={options}
          components={{ DropdownIndicator, ClearIndicator, MultiValueRemove, MultiValueLabel }}
          onChange={(selectedOptions) => {
            // Extract just the string values for formik
            const values = selectedOptions ? selectedOptions.map(item => item.value) : []
            helpers?.setValue?.(values)

            if (onChange) {
              onChange(formik, values)
            }
          }}
          unstyled={false}
        />
        {info && <Info>{info}</Info>}
      </span>
      <BootstrapForm.Control.Feedback type='invalid' className={meta.touched && meta.error ? 'd-block' : ''}>
        {meta.touched && meta.error}
      </BootstrapForm.Control.Feedback>
      {hint &&
        <BootstrapForm.Text>
          {hint}
        </BootstrapForm.Text>}
    </FormGroup>
  )
}
