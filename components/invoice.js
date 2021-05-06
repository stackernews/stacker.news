import QRCode from 'qrcode.react'
import { InputGroup } from 'react-bootstrap'
import Moon from '../svgs/moon-fill.svg'
import copy from 'clipboard-copy'
import Thumb from '../svgs/thumb-up-fill.svg'
import { useState } from 'react'
import BootstrapForm from 'react-bootstrap/Form'
import Button from 'react-bootstrap/Button'

export function Invoice ({ invoice }) {
  const [copied, setCopied] = useState(false)
  const qrValue = 'lightning:' + invoice.toUpperCase()

  return (
    <>
      <div>
        <QRCode className='h-auto mw-100' value={qrValue} size={300} />
      </div>
      <div className='mt-3 w-100'>
        <InputGroup onClick={() => {
          copy(invoice)
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        }}
        >
          <BootstrapForm.Control type='text' placeholder={invoice} readOnly />
          <InputGroup.Append>
            <Button>{copied ? <Thumb width={20} height={20} /> : 'copy'}</Button>
          </InputGroup.Append>
        </InputGroup>
      </div>
      <InvoiceStatus />
    </>
  )
}

export function InvoiceStatus ({ skeleton }) {
  return (
    <div className='d-flex mt-4'>
      <Moon className='spin fill-grey' />
      <div className='ml-3 text-muted' style={{ fontWeight: '600' }}>{skeleton ? 'generating' : 'waiting for you'}</div>
    </div>
  )
}

export function InvoiceSkeleton () {
  return (
    <>
      <div className='h-auto w-100 clouds' style={{ paddingTop: 'min(300px, 100%)', maxWidth: '300px' }} />
      <div className='mt-3 w-100'>
        <div className='w-100 clouds form-control' />
      </div>
      <InvoiceStatus skeleton />
    </>
  )
}
