import React, { useContext, useMemo } from 'react'
import { useQuery } from '@apollo/client'
import { fixedDecimal } from '@/lib/format'
import { useMe } from './me'
import { PRICE } from '@/fragments/price'
import { CURRENCY_SYMBOLS } from '@/lib/currency'
import { NORMAL_POLL_INTERVAL, SSR } from '@/lib/constants'
import { useBlockHeight } from './block-height'
import { useChainFee } from './chain-fee'
import { CompactLongCountdown } from './countdown'
import { usePriceCarousel } from './nav/price-carousel'

export const PriceContext = React.createContext({
  price: null,
  fiatSymbol: null
})

export function usePrice () {
  return useContext(PriceContext)
}

export function PriceProvider ({ price, children }) {
  const { me } = useMe()
  const fiatCurrency = me?.privates?.fiatCurrency
  const { data } = useQuery(PRICE, {
    variables: { fiatCurrency },
    ...(SSR
      ? {}
      : {
          pollInterval: NORMAL_POLL_INTERVAL,
          nextFetchPolicy: 'cache-and-network'
        })
  })

  const contextValue = useMemo(() => ({
    price: data?.price || price,
    fiatSymbol: CURRENCY_SYMBOLS[fiatCurrency] || '$'
  }), [data?.price, price, me?.privates?.fiatCurrency])

  return (
    <PriceContext.Provider value={contextValue}>
      {children}
    </PriceContext.Provider>
  )
}

export default function Price ({ className }) {
  const [selection, handleClick] = usePriceCarousel()

  const { price, fiatSymbol } = usePrice()
  const { height: blockHeight, halving } = useBlockHeight()
  const { fee: chainFee } = useChainFee()

  const compClassName = (className || '') + ' text-reset pointer'

  if (selection === 'yep') {
    if (!price || price < 0) return null
    return (
      <div>
        <button className={compClassName} onClick={handleClick} variant='link' aria-describedby='yep-hint'>
          {fixedDecimal(100000000 / price, 0) + ` sats/${fiatSymbol}`}
        </button>
        <div id='yep-hint' className='visually-hidden'>Show 1 satoshi equals 1 satoshi</div>
      </div>
    )
  }

  if (selection === '1btc') {
    return (
      <div>
        <button className={compClassName} onClick={handleClick} variant='link' aria-describedby='1btc-hint'>
          1sat=1sat
        </button>
        <div id='1btc-hint' className='visually-hidden'>Show blockheight</div>
      </div>
    )
  }

  if (selection === 'blockHeight') {
    if (blockHeight <= 0) return null
    return (
      <div>
        <button className={compClassName} onClick={handleClick} variant='link' aria-describedby='blockHeight-hint'>
          {blockHeight}
        </button>
        <div id='blockHeight-hint' className='visually-hidden'>Show fee rate</div>
      </div>
    )
  }

  if (selection === 'halving') {
    if (!halving) return null
    return (
      <div>
        <button className={compClassName} onClick={handleClick} variant='link' aria-describedby='halving-hint'>
          <CompactLongCountdown date={halving} />
        </button>
        <div id='halving-hint' className='visually-hidden'>Show fiat price</div>
      </div>
    )
  }

  if (selection === 'chainFee') {
    if (chainFee <= 0) return null
    return (
      <div>
        <button className={compClassName} onClick={handleClick} variant='link' aria-describedby='chainFee-hint'>
          {chainFee} sat/vB
        </button>
        <div id='chainFee-hint' className='visually-hidden'>Show time until halving</div>
      </div>
    )
  }

  if (selection === 'fiat') {
    if (!price || price < 0) return null
    return (
      <div>
        <button className={compClassName} onClick={handleClick} variant='link' aria-describedby='fiat-hint'>
          {fiatSymbol + fixedDecimal(price, 0)}
        </button>
        <div id='fiat-hint' className='visually-hidden'>Show price in satoshis per fiat unit</div>
      </div>
    )
  }
}
