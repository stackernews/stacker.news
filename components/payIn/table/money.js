import { useMemo } from 'react'
import { useMe } from '../../me'
import { isNumber, numWithUnits, msatsToSats } from '@/lib/format'
import Plug from '@/svgs/plug.svg'

export function PayInMoney ({ payIn }) {
  const { me } = useMe()
  const { SATS, CREDITS } = useMemo(() => reduceCustodialTokenCosts(payIn, me.id), [payIn, me.id])
  const bolt11Cost = useMemo(() => reduceBolt11Cost(payIn, me.id), [payIn, me.id])

  if (payIn.payInState === 'FAILED' || (Number(payIn.userId) !== Number(me.id) && payIn.payInState !== 'PAID')) {
    return <>N/A</>
  }

  return (
    <>
      {isNumber(SATS?.mtokens) && SATS.mtokens !== 0 && <Money mtokens={SATS.mtokens} mtokensAfter={SATS.mtokensAfter} singular='sat' plural='sats' />}
      {isNumber(CREDITS?.mtokens) && CREDITS.mtokens !== 0 && <Money mtokens={CREDITS.mtokens} mtokensAfter={CREDITS.mtokensAfter} singular='CC' plural='CCs' />}
      {isNumber(bolt11Cost) && bolt11Cost !== 0 && <div className='d-flex align-items-center gap-1 justify-content-end'><Plug className='fill-muted' width={10} height={10} />{numWithUnits(msatsToSats(bolt11Cost), { unitSingular: 'sat', unitPlural: 'sats' })}</div>}
    </>
  )
}

function Money ({ mtokens, mtokensAfter, singular, plural }) {
  return (
    <div className='d-grid line-height-1'>
      <div>{numWithUnits(msatsToSats(mtokens), { unitSingular: singular, unitPlural: plural })}</div>
      {isNumber(mtokensAfter) && <small className='text-muted'>{numWithUnits(msatsToSats(mtokensAfter), { unitSingular: singular, unitPlural: plural })}</small>}
    </div>
  )
}

function reduceBolt11Cost (payIn, userId) {
  let cost = 0
  if (Number(payIn.userId) === Number(userId) && payIn.payInBolt11) {
    cost -= payIn.payInBolt11.msatsReceived
  }
  if (Number(payIn.payOutBolt11?.userId) === Number(userId)) {
    cost += payIn.payOutBolt11.msats
  }
  return cost
}

function reduceCustodialTokenCosts (payIn, userId) {
  // on a payin, the mtokensAfter is going to be the maximum
  const payInCosts = payIn.payInCustodialTokens?.reduce((acc, token) => {
    if (Number(payIn.userId) !== Number(userId)) {
      return acc
    }

    acc[token.custodialTokenType] = {
      mtokens: acc[token.custodialTokenType]?.mtokens - token.mtokens,
      mtokensAfter: acc[token.custodialTokenType]?.mtokensAfter ? Math.min(acc[token.custodialTokenType].mtokensAfter, token.mtokensAfter) : token.mtokensAfter
    }
    return acc
  }, { SATS: { mtokens: 0, mtokensAfter: null }, CREDITS: { mtokens: 0, mtokensAfter: null } })

  // on a payout, the mtokensAfter is going to be the maximum
  const totalCost = payIn.payOutCustodialTokens?.reduce((acc, token) => {
    if (Number(token.userId) !== Number(userId)) {
      return acc
    }

    acc[token.custodialTokenType] = {
      mtokens: acc[token.custodialTokenType]?.mtokens + token.mtokens,
      mtokensAfter: acc[token.custodialTokenType]?.mtokensAfter ? Math.max(acc[token.custodialTokenType].mtokensAfter, token.mtokensAfter) : token.mtokensAfter
    }
    return acc
  }, { ...payInCosts })

  return totalCost
}
