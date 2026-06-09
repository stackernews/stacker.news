import { CopyInput } from '@/components/form'

export default ({ bolt11, hash, preimage, description, children }) => {
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
      {hash &&
        <>
          <div>hash</div>
          <CopyInput
            size='sm'
            groupClassName='w-100 mb-0'
            readOnly
            noForm
            placeholder={hash}
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
