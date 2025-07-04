import { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react'
import Particles, { initParticlesEngine } from '@tsparticles/react'
import { loadFireworksPreset } from '@tsparticles/preset-fireworks'
import styles from './fireworks.module.css'
import useDarkMode from './dark-mode'

export const FireworksContext = createContext({
  strike: () => {}
})

export const FireworksConsumer = FireworksContext.Consumer
export function useFireworks () {
  const { strike } = useContext(FireworksContext)
  return strike
}

export function FireworksProvider ({ children }) {
  const containerRef = useRef()
  const [context, setContext] = useState({ strike: () => {} })
  const [darkMode] = useDarkMode()

  useEffect(() => {
    setContext({
      strike: () => {
        containerRef.current?.addEmitter(
          {
            direction: 'top',
            life: {
              count: 1,
              duration: 0.1,
              delay: 0.1
            },
            rate: {
              delay: 0,
              quantity: 1
            },
            size: {
              width: 10,
              height: 0
            },
            position: {
              y: 100,
              x: 50
            }
          })
        return true
      }
    })
  }, [])

  useEffect(() => {
    initParticlesEngine(async (engine) => {
      await loadFireworksPreset(engine)
    })
  }, [])

  const particlesLoaded = useCallback(async (container) => {
    containerRef.current = container
  }, [])

  const options = useMemo(
    () => (darkMode ? darkOptions : lightOptions),
    [darkMode]
  )

  return (
    <FireworksContext.Provider value={context}>
      <Particles
        id='tsparticles'
        className={styles.fireworks}
        options={options}
        particlesLoaded={particlesLoaded}
      />
      {children}
    </FireworksContext.Provider>
  )
}

const options = {
  fullScreen: { enable: true, zIndex: -1 },
  detectRetina: true,
  background: {
    color: 'transparent'
  },
  backgroundMask: {
    enable: true,
    composite: 'source-over'
  },
  fpsLimit: 120,
  emitters: [],
  sounds: {
    enable: false
  },
  preset: 'fireworks'
}

const darkOptions = {
  ...options,
  particles: {
    stroke: {
      color: {
        value: '#fff'
      },
      width: 1
    },
    move: {
      outModes: {
        default: 'split',
        top: 'none'
      },
      trail: {
        enable: true,
        fill: {
          color: '#000'
        },
        length: 10
      }
    }
  }
}

const lightOptions = {
  ...options,
  particles: {
    stroke: {
      color: {
        value: '#aaa'
      },
      width: 1
    },
    move: {
      outModes: {
        default: 'split',
        top: 'none'
      },
      trail: {
        fill: {
          color: '#f5f5f7'
        },
        enable: true,
        length: 10
      }
    }
  }
}
