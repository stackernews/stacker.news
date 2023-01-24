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

  return <Qr webLn value={invoice.bolt11} statusVariant={variant} status={status} />
}
