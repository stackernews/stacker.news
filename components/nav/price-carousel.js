import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
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

export const PriceCarouselContext = createContext({
  selection: undefined,
  handleClick: () => {}
})

export function PriceCarouselProvider ({ children }) {
  const [selection, setSelection] = useState(undefined)
  const { height } = useBlockHeight()
  const forkTickerActive = Boolean(getBip110Ticker(height))
  const wasForkTickerActive = useRef(false)

  useEffect(() => {
    const preferredSelection = window.localStorage.getItem(STORAGE_KEY) ?? DEFAULT_SELECTION
    const dismissed = window.localStorage.getItem(BIP_110_DISMISSED_KEY) === String(BIP_110_FORK_START_HEIGHT)
    const enteringForkTicker = forkTickerActive && !wasForkTickerActive.current
    const leavingForkTicker = !forkTickerActive && wasForkTickerActive.current

    if (selection === undefined || (enteringForkTicker && !dismissed)) {
      setSelection(forkTickerActive && !dismissed ? BIP_110_SELECTION : preferredSelection)
    } else if (leavingForkTicker && selection === BIP_110_SELECTION) {
      setSelection(preferredSelection)
    }

    wasForkTickerActive.current = forkTickerActive
  }, [forkTickerActive, selection])

  const handleClick = useCallback(() => {
    if (selection === BIP_110_SELECTION) {
      window.localStorage.setItem(BIP_110_DISMISSED_KEY, String(BIP_110_FORK_START_HEIGHT))
      setSelection(window.localStorage.getItem(STORAGE_KEY) ?? DEFAULT_SELECTION)
      return
    }

    const pos = carousel.findIndex(item => item === selection)
    const nextPos = (pos + 1) % carousel.length
    window.localStorage.setItem(STORAGE_KEY, carousel[nextPos])
    setSelection(carousel[nextPos])
  }, [selection])

  return (
    <PriceCarouselContext.Provider value={[selection, handleClick]}>
      {children}
    </PriceCarouselContext.Provider>
  )
}

export function usePriceCarousel () {
  return useContext(PriceCarouselContext)
}
