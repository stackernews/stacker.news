import { createContext, useCallback, useContext, useState } from 'react'
import Thunderstorm from './index'

const ThunderstrikeContext = createContext(() => {})

export function ThunderstormProvider ({ children }) {
  const [bolts, setBolts] = useState([])

  const strike = useCallback(() => {
    const id = Date.now() + Math.random()
    setBolts(prev => [...prev, id])
  }, [])

  const remove = useCallback((id) => {
    setBolts(prev => prev.filter(b => b !== id))
  }, [])

  return (
    <ThunderstrikeContext.Provider value={strike}>
      {bolts.map(id => (
        <Thunderstorm key={id} intensity='strike' onDone={() => remove(id)} />
      ))}
      {children}
    </ThunderstrikeContext.Provider>
  )
}

export function useThunderstrike () {
  return useContext(ThunderstrikeContext)
}
