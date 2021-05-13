import QRCode from 'qrcode.react'
import { CopyInput, InputSkeleton } from './form'
import InvoiceStatus from './invoice-status'

export function Invoice ({ invoice }) {
  const qrValue = 'lightning:' + invoice.bolt11.toUpperCase()

  let variant = 'default'
  let status = 'waiting for you'
  if (invoice.confirmedAt) {
    variant = 'confirmed'
    status = `${invoice.msatsReceived / 1000} sats deposited`
  } else if (invoice.cancelled) {
    variant = 'failed'
    status = 'cancelled'
  } else if (invoice.expiresAt <= new Date()) {
    variant = 'failed'
    status = 'expired'
  }

  return (
    <>
      <div>
        <QRCode className='h-auto mw-100' value={qrValue} renderAs='svg' size={300} />
      </div>
      <div className='mt-3 w-100'>
        <CopyInput type='text' placeholder={invoice.bolt11} readOnly />
      </div>
      <InvoiceStatus variant={variant} status={status} />
    </>
  )
}

export function InvoiceSkeleton ({ status }) {
  return (
    <>
      <div className='h-auto w-100 clouds' style={{ paddingTop: 'min(300px, 100%)', maxWidth: '300px' }} />
      <div className='mt-3 w-100'>
        <InputSkeleton />
      </div>
      <InvoiceStatus variant='default' status={status} />
    </>
  )
}
