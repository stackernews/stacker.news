import { useCallback, createContext, useContext, useState, useEffect } from 'react'
import Particles from 'react-particles'
import { loadFireworksPreset } from 'tsparticles-preset-fireworks'
import styles from './fireworks.module.css'
import {
  rgbToHsl,
  setRangeValue,
  stringToRgb
} from 'tsparticles-engine'
import useDarkMode from '@/components/dark-mode'

export const FireworksContext = createContext({
  strike: () => {}
})

export const FireworksConsumer = FireworksContext.Consumer
export function useFireworks () {
  const { strike } = useContext(FireworksContext)
  return strike
}

export function FireworksProvider ({ children }) {
  const [cont, setCont] = useState()
  const [context, setContext] = useState({ strike: () => {} })
  const [darkMode] = useDarkMode()

  useEffect(() => {
    setContext({
      strike: () => {
        cont?.addEmitter(
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
  }, [cont])

  const particlesLoaded = useCallback((container) => {
    setCont(container)
  }, [])

  const particlesInit = useCallback(async engine => {
    // you can initiate the tsParticles instance (engine) here, adding custom shapes or presets
    // this loads the tsparticles package bundle, it's the easiest method for getting everything ready
    // starting from v2 you can add only the features you need reducing the bundle size
    await loadFireworksPreset(engine)
  }, [])

  return (
    <FireworksContext.Provider value={context}>
      <Particles
        className={styles.fireworks}
        init={particlesInit}
        loaded={particlesLoaded}
        options={darkMode ? darkOptions : lightOptions}
      />
      {children}
    </FireworksContext.Provider>
  )
}

const fixRange = (value, min, max) => {
  const diffSMax = value.max > max ? value.max - max : 0
  let res = setRangeValue(value)

  if (diffSMax) {
    res = setRangeValue(value.min - diffSMax, max)
  }

  const diffSMin = value.min < min ? value.min : 0

  if (diffSMin) {
    res = setRangeValue(0, value.max + diffSMin)
  }

  return res
}

const fireworksOptions = ['#ff595e', '#ffca3a', '#8ac926', '#1982c4', '#6a4c93']
  .map((color) => {
    const rgb = stringToRgb(color)

    if (!rgb) {
      return undefined
    }

    const hsl = rgbToHsl(rgb)
    const sRange = fixRange({ min: hsl.s - 30, max: hsl.s + 30 }, 0, 100)
    const lRange = fixRange({ min: hsl.l - 30, max: hsl.l + 30 }, 0, 100)

    return {
      color: {
        value: {
          h: hsl.h,
          s: sRange,
          l: lRange
        }
      },
      stroke: {
        width: 0
      },
      number: {
        value: 0
      },
      opacity: {
        value: {
          min: 0.1,
          max: 1
        },
        animation: {
          enable: true,
          speed: 0.7,
          sync: false,
          startValue: 'max',
          destroy: 'min'
        }
      },
      shape: {
        type: 'circle'
      },
      size: {
        value: { min: 1, max: 2 },
        animation: {
          enable: true,
          speed: 5,
          count: 1,
          sync: false,
          startValue: 'min',
          destroy: 'none'
        }
      },
      life: {
        count: 1,
        duration: {
          value: {
            min: 1,
            max: 2
          }
        }
      },
      move: {
        decay: { min: 0.075, max: 0.1 },
        enable: true,
        gravity: {
          enable: true,
          inverse: false,
          acceleration: 5
        },
        speed: { min: 5, max: 15 },
        direction: 'none',
        outMode: {
          top: 'destroy',
          default: 'bounce'
        }
      }
    }
  })
  .filter((t) => t !== undefined)

const particlesOptions = (theme) => ({
  number: {
    value: 0
  },
  destroy: {
    mode: 'split',
    bounds: {
      top: { min: 5, max: 40 }
    },
    split: {
      sizeOffset: false,
      count: 1,
      factor: {
        value: 0.333333
      },
      rate: {
        value: { min: 75, max: 150 }
      },
      particles: fireworksOptions
    }
  },
  life: {
    count: 1
  },
  shape: {
    type: 'line'
  },
  size: {
    value: {
      min: 0.1,
      max: 50
    },
    animation: {
      enable: true,
      sync: true,
      speed: 90,
      startValue: 'max',
      destroy: 'min'
    }
  },
  rotate: {
    path: true
  },
  stroke: {
    color: {
      value: theme === 'dark' ? '#fff' : '#aaa'
    },
    width: 1
  },
  move: {
    enable: true,
    gravity: {
      acceleration: 15,
      enable: true,
      inverse: true,
      maxSpeed: 100
    },
    speed: {
      min: 10,
      max: 20
    },
    outModes: {
      default: 'split',
      top: 'none'
    },
    trail: {
      fillColor: theme === 'dark' ? '#000' : '#f5f5f7',
      enable: true,
      length: 10
    }
  }
})

const darkOptions = {
  fullScreen: { enable: true, zIndex: -1 },
  detectRetina: true,
  background: {
    color: '#000',
    opacity: 0
  },
  fpsLimit: 120,
  emitters: [],
  particles: particlesOptions('dark')
}

const lightOptions = {
  fullScreen: { enable: true, zIndex: -1 },
  detectRetina: true,
  background: {
    color: '#fff',
    opacity: 0
  },
  fpsLimit: 120,
  emitters: [],
  particles: particlesOptions('light')
}
