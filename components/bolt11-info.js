import { decode } from 'bolt11'
import AccordianItem from './accordian-item'
import { CopyInput } from './form'

export default ({ bolt11, preimage }) => {
  let description, paymentHash
  try {
    ({ tagsObject: { description, payment_hash: paymentHash } } = decode(bolt11))
  } catch { }
  if (!description && !paymentHash && !preimage) {
    return null
  }

  return (
    <div className='w-100'>
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
          </>
          }
      />
    </div>
  )
}
