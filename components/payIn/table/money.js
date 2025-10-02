import { useMemo } from 'react'
import { useMe } from '../../me'
import { isNumber, numWithUnits, msatsToSatsDecimal } from '@/lib/format'
import Plug from '@/svgs/plug.svg'
import classNames from 'classnames'
import styles from './index.module.css'

export function PayInMoney ({ payIn }) {
  const { me } = useMe()
  const { SATS, CREDITS } = useMemo(() => reduceCustodialTokenCosts(payIn, me.id), [payIn, me.id])
  const bolt11Cost = useMemo(() => reduceBolt11Cost(payIn, me.id), [payIn, me.id])

  if (payIn.mcost === 0 || (!payIn.payerPrivates && payIn.payInState !== 'PAID')) {
    return <>N/A</>
  }

  return (
    <>
      {isNumber(SATS?.mtokens) && SATS.mtokens !== 0 && <Money mtokens={SATS.mtokens} mtokensAfter={SATS.mtokensAfter} singular='sat' plural='sats' />}
      {isNumber(CREDITS?.mtokens) && CREDITS.mtokens !== 0 && <Money mtokens={CREDITS.mtokens} mtokensAfter={CREDITS.mtokensAfter} singular='CC' plural='CCs' />}
      {isNumber(bolt11Cost) && bolt11Cost !== 0 && payIn.isSend &&
        <div
          className={classNames('d-flex align-items-center gap-1 justify-content-end',
            { [styles.strikethrough]: payIn.payInState === 'FAILED' })}
        >{formatCost(bolt11Cost, 'sat', 'sats')}<Plug className='fill-muted' width={10} height={10} />
        </div>}
    </>
  )
}

function Money ({ mtokens, mtokensAfter, singular, plural }) {
  return (
    <div className='d-grid'>
      <div>{formatCost(mtokens, singular, plural)}</div>
      {isNumber(mtokensAfter) && <small className='text-muted'>{numWithUnits(msatsToSatsDecimal(mtokensAfter), { unitSingular: singular, unitPlural: plural, abbreviate: false })}</small>}
    </div>
  )
}

function formatCost (mtokens, unitSingular, unitPlural) {
  const sign = ''
  // if (mtokens > 0) {
  //   sign = '+'
  // }

  return `${sign}${numWithUnits(msatsToSatsDecimal(mtokens), { unitSingular, unitPlural, abbreviate: false })}`
}

function reduceBolt11Cost (payIn, userId) {
  let cost = 0
  if (payIn.payerPrivates && payIn.payerPrivates.payInBolt11 && payIn.payInType !== 'PROXY_PAYMENT') {
    cost -= payIn.payerPrivates.payInBolt11.msatsReceived || payIn.payerPrivates.payInBolt11.msatsRequested
  }
  if (payIn.payeePrivates && payIn.payeePrivates.payOutBolt11) {
    cost += payIn.payeePrivates.payOutBolt11.msats
  }
  return cost
}

function reduceCustodialTokenCosts (payIn, userId) {
  // on a payin, the mtokensAfter is going to be the maximum
  let costs = { SATS: { mtokens: 0, mtokensAfter: null }, CREDITS: { mtokens: 0, mtokensAfter: null } }
  console.log('payerPrivates', payIn.payerPrivates)

  if (payIn.isSend) {
    costs = payIn.payerPrivates?.payInCustodialTokens?.reduce((acc, token) => {
      acc[token.custodialTokenType] = {
        mtokens: acc[token.custodialTokenType]?.mtokens - token.mtokens,
        mtokensAfter: acc[token.custodialTokenType]?.mtokensAfter ? Math.min(acc[token.custodialTokenType].mtokensAfter, token.mtokensAfter) : token.mtokensAfter
      }
      return acc
    }, costs) || costs

    return costs
  } else if (payIn.payInState === 'FAILED') {
    return payIn.payerPrivates?.refundCustodialTokens?.reduce((acc, token) => {
      acc[token.custodialTokenType] = {
        mtokens: acc[token.custodialTokenType]?.mtokens + token.mtokens,
        mtokensAfter: acc[token.custodialTokenType]?.mtokensAfter ? Math.max(acc[token.custodialTokenType].mtokensAfter, token.mtokensAfter) : token.mtokensAfter
      }
      return acc
    }, costs) || costs
  }

  // on a payout, the mtokensAfter is going to be the maximum
  const totalCost = payIn.payOutCustodialTokens?.reduce((acc, token) => {
    if (!token.privates) {
      return acc
    }
    acc[token.custodialTokenType] = {
      mtokens: acc[token.custodialTokenType]?.mtokens + token.mtokens,
      mtokensAfter: acc[token.custodialTokenType]?.mtokensAfter ? Math.max(acc[token.custodialTokenType].mtokensAfter, token.privates?.mtokensAfter) : token.privates?.mtokensAfter
    }
    console.log(token.custodialTokenType, token, acc)
    return acc
  }, { ...costs })

  return totalCost
}
