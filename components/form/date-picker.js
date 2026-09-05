import { useEffect, useMemo, useState } from 'react'
import { useField, useFormikContext } from 'formik'
import dynamic from 'next/dynamic'
import 'react-datepicker/dist/react-datepicker.css'
import { whenRange } from '@/lib/time'
import { cn } from '@/lib/cn'
import { FormGroup, inputClasses, errorClasses } from './field'

function DatePickerSkeleton () {
  return (
    <div className='react-datepicker-wrapper'>
      <input className={cn(inputClasses(), 'clouds p-0 px-2 mb-0')} />
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
          className={cn(inputClasses(), 'text-center', className)}
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
    <FormGroup label={label} htmlFor={props.id || name} className={groupClassName}>
      <div>
        <DateTimePicker id={props.id || name} name={name} {...props} />
        <div className={errorClasses()}>
          {meta.error}
        </div>
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
          className={cn(inputClasses(), className)}
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
