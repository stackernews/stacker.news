import { createContext, useCallback, useContext, useState } from 'react'
import Thunderstorm from './index'

const ThunderstormContext = createContext(() => {})

export function ThunderstormProvider ({ children }) {
  const [storms, setStorms] = useState([])

  const start = useCallback((type = 'strike') => {
    const id = Date.now() + Math.random()
    setStorms(prev => [...prev, {
      id,
      type: type === 'settlement' ? 'settlement' : 'strike'
    }])
  }, [])

  return (
    <ThunderstormContext.Provider value={start}>
      {storms.map(({ id, type }) => (
        <Thunderstorm
          key={id}
          type={type}
          onDone={() => setStorms(prev => prev.filter(storm => storm.id !== id))}
        />
      ))}
      {children}
    </ThunderstormContext.Provider>
  )
}

export function useThunderstorm () {
  return useContext(ThunderstormContext)
}
