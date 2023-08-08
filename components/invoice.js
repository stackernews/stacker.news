import AccordianItem from './accordian-item'
import Qr from './qr'
import { numWithUnits } from '../lib/format'

export function Invoice ({ invoice }) {
  let variant = 'default'
  let status = 'waiting for you'
  let webLn = true
  if (invoice.confirmedAt) {
    variant = 'confirmed'
    status = `${numWithUnits(invoice.satsReceived, { abbreviate: false })} deposited`
    webLn = false
  } else if (invoice.cancelled) {
    variant = 'failed'
    status = 'cancelled'
    webLn = false
  } else if (invoice.expiresAt <= new Date()) {
    variant = 'failed'
    status = 'expired'
    webLn = false
  }

  const { nostr } = invoice

  return (
    <>
      <Qr webLn={webLn} value={invoice.bolt11} statusVariant={variant} status={status} />
      <div className='w-100'>
        {nostr
          ? <AccordianItem
              header='Nostr Zap Request'
              body={
                <pre>
                  <code>
                    {JSON.stringify(nostr, null, 2)}
                  </code>
                </pre>
            }
            />
          : null}
      </div>
    </>
  )
}
