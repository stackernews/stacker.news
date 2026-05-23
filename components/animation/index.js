import { useCallback, useEffect, useState } from 'react'
import { useMe } from '@/components/me'
import { randInRange } from '@/lib/rand'

import { ThunderstormProvider, useThunderstrike } from '@/components/thunderstorm/provider'

export function AnimationProvider ({ children }) {
  return (
    <ThunderstormProvider>
      <AnimationHooks>
        {children}
      </AnimationHooks>
    </ThunderstormProvider>
  )
}

export function useAnimation () {
  const strike = useThunderstrike()

  return useCallback(() => {
    if (!getAnimationDefault()) return false
    strike()
    return true
  }, [strike])
}

function getAnimationDefault () {
  if (typeof window === 'undefined') return undefined
  const stored = window.localStorage.getItem('lnAnimate')
  if (stored) return stored === 'yes'
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function useAnimationEnabled () {
  const [enabled, setEnabled] = useState(getAnimationDefault)

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
