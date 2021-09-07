import QRCode from 'qrcode.react'
import { CopyInput, InputSkeleton } from './form'
import InvoiceStatus from './invoice-status'
import { requestProvider } from 'webln'
import { useEffect } from 'react'

export default function LnQR ({ value, webLn, statusVariant, status }) {
  const qrValue = 'lightning:' + value.toUpperCase()

  useEffect(async () => {
    if (webLn) {
      try {
        const provider = await requestProvider()
        provider.sendPayment(value)
      } catch (e) {
        console.log(e)
      }
    }
  }, [])

  return (
    <>
      <a className='d-block' href={qrValue}>
        <QRCode className='h-auto mw-100' value={qrValue} renderAs='svg' size={300} />
      </a>
      <div className='mt-3 w-100'>
        <CopyInput type='text' placeholder={value} readOnly />
      </div>
      <InvoiceStatus variant={statusVariant} status={status} />
    </>
  )
}

export function LnQRSkeleton ({ status }) {
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
