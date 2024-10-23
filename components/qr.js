import { QRCodeSVG } from 'qrcode.react'
import { CopyInput, InputSkeleton } from './form'
import InvoiceStatus from './invoice-status'
import { useEffect } from 'react'
import { useWallet } from '@/wallets/index'
import Bolt11Info from './bolt11-info'

export default function Qr ({ asIs, value, useWallet: automated, statusVariant, description, status }) {
  const qrValue = asIs ? value : 'lightning:' + value.toUpperCase()
  const wallet = useWallet()

  useEffect(() => {
    async function effect () {
      if (automated && wallet) {
        try {
          await wallet.sendPayment(value)
        } catch (e) {
          console.log(e?.message)
        }
      }
    }
    effect()
  }, [wallet])

  return (
    <>
      <a className='d-block p-3 mx-auto' style={{ background: 'white', maxWidth: '300px' }} href={qrValue}>
        <QRCodeSVG
          className='h-auto mw-100' value={qrValue} size={300} imageSettings={{
            src: 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 256 256\'%3E%3Cpath fill-rule=\'evenodd\' d=\'m46.7 96.4 37.858 53.837-71.787 62.934L117.5 155.4l-40.075-52.854 49.412-59.492Zm156.35 41.546-49.416-58.509-34.909 116.771 44.25-67.358 58.509 59.25L241.4 47.725Z\'/%3E%3C/svg%3E',
            x: undefined,
            y: undefined,
            height: 60,
            width: 60,
            excavate: true
          }}
        />
      </a>
      {description && <div className='mt-1 text-center text-muted'>{description}</div>}
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
      {bolt11Info && <Bolt11Info />}
    </>
  )
}
