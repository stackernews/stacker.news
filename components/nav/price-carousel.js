import { createContext, useCallback, useContext, useEffect, useState } from 'react'

const STORAGE_KEY = 'asSats'
const DEFAULT_SELECTION = 'fiat'

const carousel = [
  'fiat',
  'yep',
  '1btc',
  'blockHeight',
  'chainFee',
  'halving'
]

export const PriceCarouselContext = createContext({
  selection: undefined,
  handleClick: () => {}
})

export function PriceCarouselProvider ({ children }) {
  const [selection, setSelection] = useState(undefined)
  const [pos, setPos] = useState(0)

  useEffect(() => {
    const selection = window.localStorage.getItem(STORAGE_KEY) ?? DEFAULT_SELECTION
    setSelection(selection)
    setPos(carousel.findIndex((item) => item === selection))
  }, [])

  const handleClick = useCallback(() => {
    const nextPos = (pos + 1) % carousel.length
    window.localStorage.setItem(STORAGE_KEY, carousel[nextPos])
    setSelection(carousel[nextPos])
    setPos(nextPos)
  }, [pos])

  return (
    <PriceCarouselContext.Provider value={[selection, handleClick]}>
      {children}
    </PriceCarouselContext.Provider>
  )
}

export function usePriceCarousel () {
  return useContext(PriceCarouselContext)
}
