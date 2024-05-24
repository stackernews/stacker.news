import QRCode from 'qrcode.react'
import { CopyInput, InputSkeleton } from './form'
import InvoiceStatus from './invoice-status'
import { useEffect } from 'react'
import { useWebLN } from './webln'
import SimpleCountdown from './countdown'
import Bolt11Info from './bolt11-info'

export default function Qr ({ asIs, value, webLn, statusVariant, description, status }) {
  const qrValue = asIs ? value : 'lightning:' + value.toUpperCase()
  const provider = useWebLN()

  useEffect(() => {
    async function effect () {
      if (webLn && provider) {
        try {
          await provider.sendPayment({ bolt11: value })
        } catch (e) {
          console.log(e?.message)
        }
      }
    }
    effect()
  }, [provider])

  return (
    <>
      <a className='d-block p-3 mx-auto' style={{ background: 'white', maxWidth: '300px' }} href={qrValue}>
        <QRCode
          className='h-auto mw-100' value={qrValue} renderAs='svg' size={300}
        />
      </a>
      {description && <div className='mt-1 fst-italic text-center text-muted'>{description}</div>}
      <div className='mt-3 w-100'>
        <CopyInput type='text' placeholder={value} readOnly noForm />
      </div>
      <InvoiceStatus variant={statusVariant} status={status} />
    </>
  )
}

export function QrSkeleton ({ status, description, bolt11Info }) {
  return (
    <>
      <div className='h-auto mx-auto w-100 clouds' style={{ paddingTop: 'min(300px, 100%)', maxWidth: 'calc(300px)' }} />
      {description && <div className='mt-1 fst-italic text-center text-muted invisible'>i'm invisible</div>}
      <div className='my-3 w-100'>
        <InputSkeleton />
      </div>
      <InvoiceStatus variant='default' status={status} />
      <div className='text-muted text-center invisible'>
        <SimpleCountdown date={Date.now()} />
      </div>
      {bolt11Info && <Bolt11Info />}
    </>
  )
}
