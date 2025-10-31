import { CopyInput } from '@/components/form'
import { bolt11Tags } from '@/lib/bolt11'

export default ({ bolt11, preimage, children }) => {
  let description, paymentHash
  if (bolt11) {
    ({ description, payment_hash: paymentHash } = bolt11Tags(bolt11))
  }

  return (
    <div className='d-grid align-items-center w-100' style={{ gridTemplateColumns: 'auto 1fr', gap: '0.5rem' }}>
      {bolt11 &&
        <>
          <div>bolt11</div>
          <CopyInput
            size='sm'
            groupClassName='w-100 mb-0'
            readOnly
            noForm
            placeholder={bolt11}
          />
        </>}
      {paymentHash &&
        <>
          <div>hash</div>
          <CopyInput
            size='sm'
            groupClassName='w-100 mb-0'
            readOnly
            noForm
            placeholder={paymentHash}
          />
        </>}
      {preimage &&
        <>
          <div>preimage</div>
          <CopyInput
            size='sm'
            groupClassName='w-100 mb-0'
            readOnly
            noForm
            placeholder={preimage}
          />
        </>}
      {description &&
        <>
          <div>description</div>
          <CopyInput
            size='sm'
            groupClassName='w-100 mb-0'
            readOnly
            noForm
            placeholder={description}
          />
        </>}
      {children}
    </div>
  )
}
