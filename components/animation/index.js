import { useCallback, useEffect, useState } from 'react'
import { useMe } from '@/components/me'
import { randInRange } from '@/lib/rand'
import { useBlockHeight } from '@/components/block-height'

import { ThunderstormProvider, useThunderstorm } from '@/components/thunderstorm/provider'
import { ForkProvider, useFork } from './fork'
import { isBip110ForkHeight } from './bip110'

export function AnimationProvider ({ children }) {
  return (
    <ThunderstormProvider>
      <ForkProvider>
        <AnimationHooks>
          {children}
        </AnimationHooks>
      </ForkProvider>
    </ThunderstormProvider>
  )
}

export function useAnimation () {
  const start = useThunderstorm()
  const dropFork = useFork()
  const { height } = useBlockHeight()
  const forkHeight = isBip110ForkHeight(height, {
    preview: process.env.NODE_ENV === 'development'
  })

  return useCallback((type = 'strike') => {
    if (!getAnimationDefault()) return false
    if (forkHeight && type === 'strike') {
      dropFork()
    } else {
      start(type)
    }
    return true
  }, [dropFork, forkHeight, start])
}

function getAnimationDefault () {
  if (typeof window === 'undefined') return undefined
  const stored = window.localStorage.getItem('lnAnimate')
  if (stored) return stored === 'yes'
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function useAnimationEnabled () {
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    setEnabled(getAnimationDefault())
  }, [])

  const toggleEnabled = useCallback(() => {
    setEnabled(enabled => {
      const newEnabled = !enabled
      window.localStorage.setItem('lnAnimate', newEnabled ? 'yes' : 'no')
      return newEnabled
    })
  }, [])

  return [enabled, toggleEnabled]
}

function AnimationHooks ({ children }) {
  const { me } = useMe()
  const animate = useAnimation()

  useEffect(() => {
    if (me || window.localStorage.getItem('striked') || window.localStorage.getItem('lnAnimated')) return

    const timeout = setTimeout(() => {
      const animated = animate()
      if (animated) {
        window.localStorage.setItem('lnAnimated', 'yep')
      }
    }, randInRange(3000, 10000))
    return () => clearTimeout(timeout)
  }, [me?.id, animate])

  return children
}
