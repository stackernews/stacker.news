import AccordianItem from './accordian-item'
import { CopyInput } from './form'
import { getInvoiceDescription, getInvoicePaymentHash } from '@/lib/bolt/bolt-info'

export default ({ bolt11, preimage, children }) => {
  let description, paymentHash
  if (bolt11) {
    description = getInvoiceDescription(bolt11)
    paymentHash = getInvoicePaymentHash(bolt11)
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
