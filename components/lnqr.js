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
        await provider.sendPayment(value)
      } catch (e) {
        console.log(e.message)
      }
    }
  }, [])

  return (
    <>
      <a className='d-block p-3' style={{ background: 'white' }} href={qrValue}>
        <QRCode
          className='h-auto mw-100' value={qrValue} renderAs='svg' size={300}
        />
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
      <div className='h-auto w-100 clouds' style={{ paddingTop: 'min(300px + 2rem, 100%)', maxWidth: 'calc(300px + 2rem)' }} />
      <div className='mt-3 w-100'>
        <InputSkeleton />
      </div>
      <InvoiceStatus variant='default' status={status} />
    </>
  )
}
