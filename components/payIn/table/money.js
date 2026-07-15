import { formatMsatsToCCs, formatMsatsToSats, isNumber } from '@/lib/format'
import { getPayInViewerAmounts } from '@/lib/pay-in'
import Plug from '@/svgs/plug.svg'

export function PayInMoney ({ payIn }) {
  const { SATS, CREDITS, bolt11Mtokens } = getPayInViewerAmounts(payIn)

  if (payIn.mcost === 0 || (!payIn.payerPrivates && payIn.payInState !== 'PAID')) {
    return <>N/A</>
  }

  return (
    <>
      {SATS.mtokens !== 0 && <Money mtokens={SATS.mtokens} mtokensAfter={SATS.mtokensAfter} format={formatMsatsToSats} />}
      {CREDITS.mtokens !== 0 && <Money mtokens={CREDITS.mtokens} mtokensAfter={CREDITS.mtokensAfter} format={formatMsatsToCCs} />}
      {bolt11Mtokens !== 0 && <Bolt11Money mtokens={bolt11Mtokens} />}
    </>
  )
}

export function Bolt11Money ({ mtokens }) {
  return (
    <div className='d-flex align-items-center gap-1 justify-content-end'>
      {formatMsatsToSats(mtokens)}<Plug className='fill-muted' width={10} height={10} />
    </div>
  )
}

function Money ({ mtokens, mtokensAfter, format }) {
  return (
    <div className='d-grid'>
      <div>{format(mtokens)}</div>
      {isNumber(mtokensAfter) && <small className='text-muted'>{format(mtokensAfter)}</small>}
    </div>
  )
}
