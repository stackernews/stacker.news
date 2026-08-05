import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { BIP_110_FORK_START_HEIGHT, getBip110Ticker } from '@/components/animation/bip110'
import { useBlockHeight } from '@/components/block-height'

const STORAGE_KEY = 'asSats'
const DEFAULT_SELECTION = 'fiat'
const BIP_110_SELECTION = 'bip110'
const BIP_110_DISMISSED_KEY = 'bip110TickerDismissed'

const carousel = [
  'fiat',
  'yep',
  '1btc',
  'blockHeight',
  'chainFee',
  'halving'
]
const bip110Carousel = [BIP_110_SELECTION, ...carousel]

export const PriceCarouselContext = createContext({
  selection: undefined,
  handleClick: () => {}
})

export function PriceCarouselProvider ({ children }) {
  const [selection, setSelection] = useState(undefined)
  const { height } = useBlockHeight()
  const forkTickerActive = Boolean(getBip110Ticker(height, {
    preview: process.env.NODE_ENV === 'development'
  }))

  useEffect(() => {
    const preferredSelection = window.localStorage.getItem(STORAGE_KEY) ?? DEFAULT_SELECTION
    const dismissed = window.localStorage.getItem(BIP_110_DISMISSED_KEY) === String(BIP_110_FORK_START_HEIGHT)

    setSelection(forkTickerActive && !dismissed ? BIP_110_SELECTION : preferredSelection)
  }, [forkTickerActive])

  const handleClick = useCallback(() => {
    const activeCarousel = forkTickerActive ? bip110Carousel : carousel
    const pos = activeCarousel.findIndex(item => item === selection)
    const nextPos = (pos + 1) % activeCarousel.length
    const nextSelection = activeCarousel[nextPos]

    if (selection === BIP_110_SELECTION) {
      window.localStorage.setItem(BIP_110_DISMISSED_KEY, String(BIP_110_FORK_START_HEIGHT))
    } else if (nextSelection !== BIP_110_SELECTION) {
      window.localStorage.setItem(STORAGE_KEY, nextSelection)
    }
    setSelection(nextSelection)
  }, [forkTickerActive, selection])

  return (
    <PriceCarouselContext.Provider value={[selection, handleClick]}>
      {children}
    </PriceCarouselContext.Provider>
  )
}

export function usePriceCarousel () {
  return useContext(PriceCarouselContext)
}
