import AccordianItem from './accordian-item'
import Qr from './qr'

export function Invoice ({ invoice }) {
  let variant = 'default'
  let status = 'waiting for you'
  if (invoice.confirmedAt) {
    variant = 'confirmed'
    status = `${invoice.satsReceived} sats deposited`
  } else if (invoice.cancelled) {
    variant = 'failed'
    status = 'cancelled'
  } else if (invoice.expiresAt <= new Date()) {
    variant = 'failed'
    status = 'expired'
  }

  const { nostr } = invoice

  return (
    <>
      <Qr webLn value={invoice.bolt11} statusVariant={variant} status={status} />
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
