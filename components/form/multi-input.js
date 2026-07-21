import { useCallback, useEffect, useRef, useState } from 'react'
import { useField, useFormikContext } from 'formik'
import BootstrapForm from 'react-bootstrap/Form' // C9b carve-out (§18.3-a): the custom feedback block below
import { FormGroup } from './field'
import { InputInner } from './input'
import InputGroup from './input-group'

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
      <div className='flex flex-row justify-center gap-2'>
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
          <BootstrapForm.Control.Feedback type='invalid' className='block'>
            {meta.error}
          </BootstrapForm.Control.Feedback>
        )}
      </div>
    </FormGroup>
  )
}
