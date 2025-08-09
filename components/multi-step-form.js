import { createContext, Fragment, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import classNames from 'classnames'
import styles from '@/styles/multi-step-form.module.css'
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
  return (
    <div className='d-flex my-3 mx-auto'>
      {
        steps.map((label, i) => {
          const last = i === steps.length - 1
          return (
            <Fragment key={i}>
              <ProgressNumber number={i + 1} label={label} active={stepIndex >= i} />
              {!last && <ProgressLine style={{ marginLeft: '-4px', marginRight: '-13px' }} active={stepIndex >= i + 1} />}
            </Fragment>
          )
        })
      }
    </div>
  )
}

function ProgressNumber ({ number, label, active }) {
  return (
    <div className={classNames('text-center z-1', { 'text-info': active })}>
      <div className={classNames(styles.progressNumber, active ? 'bg-info text-white' : 'border text-muted')}>
        {number}
      </div>
      <div className={classNames('small pt-1', active ? 'text-info' : 'text-muted')}>
        {label}
      </div>
    </div>
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
