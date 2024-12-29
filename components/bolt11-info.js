import AccordianItem from './accordian-item'
import { CopyInput } from './form'
import { bolt11Tags, isBolt11 } from '@/lib/bolt/bolt11-tags'
import { bolt12Info } from '@/lib/bolt/bolt12-info'

export default ({ bolt11, preimage, children }) => {
  let description, paymentHash
  if (bolt11) {
    ({ description, payment_hash: paymentHash } = isBolt11(bolt11) ? bolt11Tags(bolt11) : bolt12Info(bolt11))
  }

  return (
    <div className={`w-100 ${!description && !paymentHash && !preimage ? 'invisible' : ''}`}>
      <AccordianItem
        header='BOLT11 information'
        body={
          <>
            {description &&
              <CopyInput
                label='description'
                size='sm'
                groupClassName='w-100'
                readOnly
                noForm
                placeholder={description}
              />}
            {paymentHash &&
              <CopyInput
                label='payment hash'
                size='sm'
                groupClassName='w-100'
                readOnly
                noForm
                placeholder={paymentHash}
              />}
            {preimage &&
              <CopyInput
                label='preimage'
                size='sm'
                groupClassName='w-100'
                readOnly
                noForm
                placeholder={preimage}
              />}
            {children}
          </>
          }
      />
    </div>
  )
}
