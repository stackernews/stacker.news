import QRCode from 'qrcode.react'
import { InputGroup } from 'react-bootstrap'
import Moon from '../svgs/moon-fill.svg'
import copy from 'clipboard-copy'
import Thumb from '../svgs/thumb-up-fill.svg'
import { useState } from 'react'
import BootstrapForm from 'react-bootstrap/Form'
import Button from 'react-bootstrap/Button'
import Check from '../svgs/check-double-line.svg'
import Fail from '../svgs/close-line.svg'

export function Invoice ({ invoice }) {
  const [copied, setCopied] = useState(false)
  const qrValue = 'lightning:' + invoice.bolt11.toUpperCase()

  let InvoiceStatus = InvoiceDefaultStatus
  let status = 'waiting for you'
  if (invoice.confirmedAt) {
    InvoiceStatus = InvoiceConfirmedStatus
    status = `${invoice.msatsReceived / 1000} sats deposited`
  } else if (invoice.cancelled) {
    InvoiceStatus = InvoiceFailedStatus
    status = 'cancelled'
  } else if (invoice.expiresAt <= new Date()) {
    InvoiceStatus = InvoiceFailedStatus
    status = 'expired'
  }

  return (
    <>
      <div>
        <QRCode className='h-auto mw-100' value={qrValue} renderAs='svg' size={300} />
      </div>
      <div className='mt-3 w-100'>
        <InputGroup onClick={() => {
          copy(invoice.bolt11)
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        }}
        >
          <BootstrapForm.Control type='text' placeholder={invoice.bolt11} readOnly />
          <InputGroup.Append>
            <Button>{copied ? <Thumb width={20} height={20} /> : 'copy'}</Button>
          </InputGroup.Append>
        </InputGroup>
      </div>
      <InvoiceStatus status={status} />
    </>
  )
}

export function InvoiceDefaultStatus ({ status }) {
  return (
    <div className='d-flex mt-4'>
      <Moon className='spin fill-grey' />
      <div className='ml-3 text-muted' style={{ fontWeight: '600' }}>{status}</div>
    </div>
  )
}

export function InvoiceConfirmedStatus ({ status }) {
  return (
    <div className='d-flex mt-4'>
      <Check className='fill-success' />
      <div className='ml-3 text-success' style={{ fontWeight: '600' }}>{status}</div>
    </div>
  )
}

export function InvoiceFailedStatus ({ status }) {
  return (
    <div className='d-flex mt-4'>
      <Fail className='fill-danger' />
      <div className='ml-3 text-danger' style={{ fontWeight: '600' }}>{status}</div>
    </div>
  )
}

export function InvoiceSkeleton ({ status }) {
  return (
    <>
      <div className='h-auto w-100 clouds' style={{ paddingTop: 'min(300px, 100%)', maxWidth: '300px' }} />
      <div className='mt-3 w-100'>
        <div className='w-100 clouds form-control' />
      </div>
      <InvoiceDefaultStatus status={status} />
    </>
  )
}
