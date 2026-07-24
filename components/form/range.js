import { useEffect } from 'react'
import { useField } from 'formik'
import { Slider as BaseSlider } from '@base-ui/react/slider'
import { NumberField } from '@base-ui/react/number-field'
import { cn } from '@/lib/cn'
import { FormGroup, inputClasses, hintClasses, errorClasses } from './field'
import styles from './range.module.css'

// the formik-less skinned primitive; avatar composes it bare and Range below
// wires it to formik
export function Slider ({ className, ...props }) {
  return (
    <BaseSlider.Root {...props}>
      <BaseSlider.Control className={cn('flex w-full items-center py-2 touch-none select-none', className)}>
        <BaseSlider.Track className={cn(styles.track, 'w-full relative select-none')}>
          <BaseSlider.Thumb className={cn(styles.thumb, 'select-none')} />
        </BaseSlider.Track>
      </BaseSlider.Control>
    </BaseSlider.Root>
  )
}

export function Range ({
  label, groupClassName, hint, min, max, step = 1, onChange,
  suffix, allOption, labels, ...props
}) {
  const [field, meta, helpers] = useField(props)
  const isAll = allOption && field.value == null
  const sliderMin = allOption ? min - step : min

  // Clamp value when min/max changes
  useEffect(() => {
    if (field.value == null) return
    if (field.value < min) {
      helpers.setValue(min)
    } else if (field.value > max) {
      helpers.setValue(max)
    }
  }, [min, max])

  const numberField = (
    <NumberField.Root
      value={field.value}
      min={min}
      max={max}
      step={step}
      format={{ useGrouping: false }}
      onValueChange={(v) => {
        // Base UI parses empty text to null on change and blur; never write
        // the infinity sentinel from the number field
        if (v == null) return
        helpers.setValue(v)
        onChange && onChange(v)
      }}
    >
      <NumberField.Input
        onBlur={() => helpers.setTouched(true)}
        className={inputClasses({ className: cn('w-16 px-2 text-end', suffix && 'rounded-e-none') })}
      />
    </NumberField.Root>
  )

  return (
    <FormGroup label={label} className={groupClassName}>
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto auto', columnGap: '1rem', alignItems: 'center' }}>
        {allOption
          ? <span className='text-muted' style={{ whiteSpace: 'nowrap' }}>- <span style={{ display: 'inline-block', transform: 'scale(1.4)', transformOrigin: 'center' }}>∞</span></span>
          : <small className='text-muted font-mono'>{min}</small>}
        <Slider
          value={isAll ? sliderMin : field.value}
          min={sliderMin}
          max={max}
          step={step}
          onValueChange={(v) => {
            if (allOption && v <= sliderMin) {
              helpers.setValue(null)
            } else {
              helpers.setValue(v)
            }
            onChange && onChange(v)
          }}
          onBlur={() => helpers.setTouched(true)} // touched on blur, not on every value commit
        />
        <small className='text-muted font-mono'>{max}</small>
        {/* number plus suffix mini-group: a plain flex row with call-site
            corner utilities, not the shared InputGroup, whose structural
            sibling rules would flatten NumberField.Root's wrapper div instead
            of the input */}
        <div className='flex flex-nowrap items-stretch' style={{ width: 'auto' }}>
          {isAll
            ? <span className={inputClasses({ className: cn('flex w-16 items-center justify-end gap-1 px-2 whitespace-nowrap', suffix && 'rounded-e-none') })}>-<span style={{ display: 'inline-block', transform: 'scale(1.4)', transformOrigin: 'center' }}>∞</span></span>
            : numberField}
          {suffix && <span className={cn(styles.addon, 'flex items-center px-4 py-1.5 text-base max-md:text-[1rem] rounded-s-none')}>{suffix.trim()}</span>}
        </div>
        {labels?.length > 0 && (
          <div className='relative' style={{ gridColumn: 2, height: '1.2em' }}>
            {labels.map(({ value, label: tickLabel }) => {
              const pct = ((value - sliderMin) / (max - sliderMin)) * 100
              return (
                <span
                  key={value}
                  className='text-muted'
                  style={{
                    position: 'absolute',
                    left: `${pct}%`,
                    transform: 'translateX(-50%)',
                    fontSize: '80%',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {tickLabel}
                </span>
              )
            })}
          </div>
        )}
      </div>
      {hint && <small className={hintClasses()}>{hint}</small>}
      <div className={errorClasses({ className: 'block' })}>
        {meta.touched && meta.error}
      </div>
    </FormGroup>
  )
}
