import React, { useCallback, useContext, useState } from 'react'
import { randInRange } from '@/lib/rand'

export const SnowContext = React.createContext(() => {})

// maximum amount of flakes that can get rendered at the same time
const MAX_FLAKES = 1024

export const SnowProvider = ({ children }) => {
  const [startIndex, setStartIndex] = useState(0)
  const [flakes, setFlakes] = useState(Array(1024))

  const snow = useCallback(() => {
    // amount of flakes to add
    const n = Math.floor(randInRange(5, 30))
    const newFlakes = [...flakes]
    let i
    for (i = startIndex; i < (startIndex + n); ++i) {
      const key = startIndex + i
      newFlakes[i % MAX_FLAKES] = <Snow key={key} />
    }
    setStartIndex(i % MAX_FLAKES)
    setFlakes(newFlakes)
  }, [flakes, startIndex])

  return (
    <SnowContext.Provider value={snow}>
      {flakes}
      {children}
    </SnowContext.Provider>
  )
}

function Snow () {
  return <div className='snow' />
}

export const SnowConsumer = SnowContext.Consumer

export function useSnow () {
  return useContext(SnowContext)
}
