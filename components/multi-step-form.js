import { createContext, Fragment, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import classNames from 'classnames'
import { useRouter } from 'next/router'

const MultiStepFormContext = createContext()

export function MultiStepForm ({ children, initial, steps }) {
  const [stepIndex, setStepIndex] = useState(0)
  const [formState, setFormState] = useState({})
  const router = useRouter()

  useEffect(() => {
    // initial state might not be available on first render so we sync changes
    if (initial) setFormState(initial)
  }, [initial])

  useEffect(() => {
    const idx = Math.max(0, steps.indexOf(router.query.step))
    setStepIndex(idx)
    router.replace({
      pathname: router.pathname,
      query: { type: router.query.type, step: steps[idx] }
    }, null, { shallow: true })
  }, [router.query.step, steps])

  const next = useCallback(() => {
    const idx = Math.min(stepIndex + 1, steps.length - 1)
    router.push(
      { pathname: router.pathname, query: { type: router.query.type, step: steps[idx] } },
      null,
      { shallow: true }
    )
  }, [stepIndex, steps, router])

  const prev = useCallback(() => router.back(), [router])

  const updateFormState = useCallback((id, state) => {
    setFormState(formState => {
      return id ? { ...formState, [id]: state } : state
    })
  }, [])

  const value = useMemo(
    () => ({ stepIndex, steps, next, prev, formState, updateFormState }),
    [stepIndex, steps, next, prev, formState, updateFormState])
  return (
    <MultiStepFormContext.Provider value={value}>
      <Progress />
      {children[stepIndex]}
    </MultiStepFormContext.Provider>
  )
}

function Progress () {
  const steps = useSteps()
  const stepIndex = useStepIndex()

  const style = (index) => {
    switch (index) {
      case 0: return { marginLeft: '-4px', marginRight: '-13px' }
      case 1: return { marginLeft: '-13px', marginRight: '-15px' }
      default: return {}
    }
  }

  return (
    <div className='d-flex my-3 mx-auto'>
      {
        steps.map((label, i) => {
          const last = i === steps.length - 1
          return (
            <Fragment key={i}>
              <ProgressNumber number={i + 1} label={label} active={stepIndex >= i} />
              {!last && <ProgressLine style={style(i)} active={stepIndex >= i + 1} />}
            </Fragment>
          )
        })
      }
    </div>
  )
}
function ProgressNumber ({ number, label, active }) {
  return (
    <div className={classNames('z-1 text-center', { 'text-info': active })}>
      <NumberSVG number={number} active={active} />
      <div className={classNames('small pt-1', active ? 'text-info' : 'text-muted')}>
        {label}
      </div>
    </div>
  )
}

function NumberSVG ({ number, active }) {
  const width = 24
  const height = 24

  const Wrapper = ({ children }) => (
    <div style={{ position: 'relative', width: `${width}px`, height: `${height}px`, margin: '0 auto' }}>
      {children}
    </div>
  )

  const Circle = () => {
    const circleProps = {
      fill: active ? 'var(--bs-info)' : 'var(--bs-body-bg)',
      stroke: active ? 'var(--bs-info)' : 'var(--theme-grey)'
    }
    return (
      <svg
        xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'
        width={width} height={height}
        style={{ position: 'absolute', top: 0, left: 0 }}
      >
        <circle cx='12' cy='12' r='11' strokeWidth='1' {...circleProps} />
      </svg>
    )
  }

  const Number = () => {
    const svgProps = {
      xmlns: 'http://www.w3.org/2000/svg',
      viewBox: '0 0 24 24',
      // we scale the number down and render it in the center of the circle
      width: 0.5 * width,
      height: 0.5 * height,
      style: { position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }
    }
    const numberColor = active ? 'var(--bs-white)' : 'var(--theme-grey)'
    // svgs are from https://remixicon.com/icon/number-1 etc.
    switch (number) {
      case 1:
        return (
          <svg {...svgProps}>
            <path fill={numberColor} d='M14 1.5V22H12V3.704L7.5 4.91V2.839L12.5 1.5H14Z' />
          </svg>
        )
      case 2:
        return (
          <svg {...svgProps}>
            <path
              fill={numberColor}
              d='M16.0002 7.5C16.0002 5.29086 14.2094 3.5 12.0002 3.5C9.7911 3.5 8.00024 5.29086 8.00024 7.5H6.00024C6.00024 4.18629 8.68653 1.5 12.0002 1.5C15.314 1.5 18.0002 4.18629 18.0002 7.5C18.0002 8.93092 17.4993 10.2448 16.6633 11.276L9.344 19.9991L18.0002 20V22H6.00024L6 20.8731L15.0642 10.071C15.6485 9.37595 16.0002 8.47905 16.0002 7.5Z'
            />
          </svg>
        )
      case 3:
        return (
          <svg {...svgProps}>
            <path fill={numberColor} d='M18.0001 2V3.36217L12.8087 9.54981C16.0169 9.94792 18.5001 12.684 18.5001 16C18.5001 19.5899 15.5899 22.5 12.0001 22.5C8.95434 22.5 6.39789 20.4052 5.69287 17.5778L7.63351 17.0922C8.12156 19.0497 9.89144 20.5 12.0001 20.5C14.4853 20.5 16.5001 18.4853 16.5001 16C16.5001 13.5147 14.4853 11.5 12.0001 11.5C11.2795 11.5 10.5985 11.6694 9.99465 11.9705L9.76692 12.0923L9.07705 10.8852L14.8551 3.99917L6.50006 4V2H18.0001Z' />
          </svg>
        )
      default:
        return null
    }
  }

  return (
    <Wrapper>
      <Circle />
      <Number />
    </Wrapper>
  )
}

function ProgressLine ({ style, active }) {
  return (
    <div style={style}>
      <svg width='100%' height='1' viewBox='0 0 100 1' preserveAspectRatio='none'>
        <path
          d='M 0 1 L 100 1'
          stroke={active ? 'var(--bs-info)' : 'var(--theme-grey)'}
          strokeWidth='1'
          fill='none'
        />
      </svg>
    </div>
  )
}

function useSteps () {
  const { steps } = useContext(MultiStepFormContext)
  return steps
}

export function useStepIndex () {
  const { stepIndex } = useContext(MultiStepFormContext)
  return stepIndex
}

export function useMaxSteps () {
  const steps = useSteps()
  return steps.length
}

export function useStep () {
  const stepIndex = useStepIndex()
  const steps = useSteps()
  return steps[stepIndex]
}

export function useNext () {
  const { next } = useContext(MultiStepFormContext)
  return next
}

export function usePrev () {
  const { prev } = useContext(MultiStepFormContext)
  return prev
}

export function useFormState (id) {
  const { formState, updateFormState } = useContext(MultiStepFormContext)
  const setFormState = useCallback(state => updateFormState(id, state), [id, updateFormState])
  return useMemo(
    () => [
      id ? formState[id] : formState,
      setFormState
    ], [formState, id, setFormState])
}
