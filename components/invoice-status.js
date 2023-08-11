import Moon from '../svgs/moon-fill.svg'
import Check from '../svgs/check-double-line.svg'
import ThumbDown from '../svgs/thumb-down-fill.svg'

function InvoiceDefaultStatus ({ status }) {
  return (
    <div className='d-flex mt-2 justify-content-center align-items-center'>
      <Moon className='spin fill-grey' />
      <div className='ms-3 text-muted' style={{ fontWeight: '600' }}>{status}</div>
    </div>
  )
}

function InvoiceConfirmedStatus ({ status }) {
  return (
    <div className='d-flex mt-2 justify-content-center align-items-center'>
      <Check className='fill-success' />
      <div className='ms-3 text-success' style={{ fontWeight: '600' }}>{status}</div>
    </div>
  )
}

function InvoiceFailedStatus ({ status }) {
  return (
    <div className='d-flex mt-2 justify-content-center align-items-center'>
      <ThumbDown className='fill-danger' />
      <div className='ms-3 text-danger' style={{ fontWeight: '600' }}>{status}</div>
    </div>
  )
}

export default function InvoiceStatus ({ variant, status }) {
  switch (variant) {
    case 'confirmed':
      return <InvoiceConfirmedStatus status={status} />
    case 'failed':
      return <InvoiceFailedStatus status={status} />
    default:
      return <InvoiceDefaultStatus status={status} />
  }
}
