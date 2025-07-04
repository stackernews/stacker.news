import { useCallback, useEffect, useState } from 'react'
import { useMe } from '@/components/me'
import { randInRange } from '@/lib/rand'

// import { LightningProvider, useLightning } from './lightning'
import { FireworksProvider, useFireworks } from './fireworks'
// import { SnowProvider, useSnow } from './snow'

const [SelectedAnimationProvider, useSelectedAnimation] = [
  // LightningProvider, useLightning
  FireworksProvider, useFireworks
  // SnowProvider, useSnow // TODO: the snow animation doesn't seem to work anymore
]

export function AnimationProvider ({ children }) {
  return (
    <SelectedAnimationProvider>
      <AnimationHooks>
        {children}
      </AnimationHooks>
    </SelectedAnimationProvider>
  )
}

export function useAnimation () {
  const animate = useSelectedAnimation()

  return useCallback(() => {
    const should = window.localStorage.getItem('lnAnimate') || 'yes'
    if (should !== 'yes') return false
    animate()
    return true
  }, [animate])
}

export function useAnimationEnabled () {
  const [enabled, setEnabled] = useState(undefined)

  useEffect(() => {
    const enabled = window.localStorage.getItem('lnAnimate') || 'yes'
    setEnabled(enabled === 'yes')
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
