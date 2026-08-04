import React, { useCallback, useContext, useEffect, useRef, useState } from 'react'
import ForkIcon from '@/svgs/fork.svg'
import { randInRange } from '@/lib/rand'
import styles from './fork.module.css'

const MIN_DURATION_MS = 2000
const MAX_DURATION_MS = 3400
const MIN_THROW_ANGLE_DEGREES = 6
const MAX_THROW_ANGLE_DEGREES = 34

export const ForkContext = React.createContext(() => {})

export function addFork (forks, fork) {
  return [...forks, fork]
}

export function removeFork (forks, id) {
  return forks.filter(fork => fork.id !== id)
}

export function ForkProvider ({ children }) {
  const nextId = useRef(0)
  const [forks, setForks] = useState([])

  const drop = useCallback(() => {
    const size = randInRange(180, 240)
    const tiltDirection = Math.random() < 0.5 ? -1 : 1
    const throwAngle = tiltDirection * randInRange(
      MIN_THROW_ANGLE_DEGREES,
      MAX_THROW_ANGLE_DEGREES
    )
    const landingRotation = 180 + throwAngle
    const stuckRotation = landingRotation - tiltDirection * randInRange(1, 3)
    const contactDrift = randInRange(-10, 10)
    const impactDepth = 24
    const stuckDrift = contactDrift -
      tiltDirection * Math.tan(Math.abs(throwAngle) * Math.PI / 180) * impactDepth
    const fallDistance = window.innerHeight + size * 0.2
    const entryDrift = contactDrift +
      tiltDirection * Math.tan(Math.abs(throwAngle) * Math.PI / 180) * fallDistance
    const fork = {
      id: nextId.current++,
      left: tiltDirection > 0 ? randInRange(15, 65) : randInRange(35, 85),
      size,
      entryDrift,
      contactDrift,
      stuckDrift,
      startRotation: landingRotation,
      landingRotation,
      stuckRotation,
      duration: randInRange(MIN_DURATION_MS, MAX_DURATION_MS)
    }
    setForks(forks => addFork(forks, fork))
  }, [])

  const remove = useCallback(id => {
    setForks(forks => removeFork(forks, id))
  }, [])

  return (
    <ForkContext.Provider value={drop}>
      {forks.map(fork => <FallingFork key={fork.id} {...fork} onDone={remove} />)}
      {children}
    </ForkContext.Provider>
  )
}

export function useFork () {
  return useContext(ForkContext)
}

function FallingFork ({
  id,
  left,
  size,
  entryDrift,
  contactDrift,
  stuckDrift,
  startRotation,
  landingRotation,
  stuckRotation,
  duration,
  onDone
}) {
  useEffect(() => {
    const timeout = setTimeout(() => onDone(id), duration)
    return () => clearTimeout(timeout)
  }, [duration, id, onDone])

  const width = size / 4

  return (
    <ForkIcon
      aria-hidden='true'
      className={styles.fork}
      style={{
        left: `clamp(${width / 2}px, ${left}vw, calc(100vw - ${width / 2}px))`,
        marginLeft: `${-width / 2}px`,
        width: `${width}px`,
        height: `${size}px`,
        animationDuration: `${duration}ms`,
        '--fork-entry-drift': `${entryDrift}px`,
        '--fork-contact-drift': `${contactDrift}px`,
        '--fork-stuck-drift': `${stuckDrift}px`,
        '--fork-start-rotation': `${startRotation}deg`,
        '--fork-landing-rotation': `${landingRotation}deg`,
        '--fork-stuck-rotation': `${stuckRotation}deg`
      }}
    />
  )
}
