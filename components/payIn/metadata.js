import AccordianItem from '@/components/accordian-item'

export function PayInMetadata ({ payInBolt11 }) {
  const { nostrNote, lud18Data, comment } = payInBolt11

  return (
    <>
      <div className='w-100'>
        {nostrNote &&
          <AccordianItem
              header='Nostr Zap Request'
              body={
                <pre>
                  <code>
                    {JSON.stringify(nostrNote.note, null, 2)}
                  </code>
                </pre>
            }
            />
        }
      </div>
      {lud18Data &&
          <AccordianItem
            header='sender information'
            body={<PayerData data={lud18Data} className='text-muted ms-3' />}
            className='mb-3'
          />
        }
      {comment &&
          <AccordianItem
            header='sender comments'
            body={<span className='text-muted ms-3'>{comment.comment}</span>}
            className='mb-3'
          />
        }
    </>
  )
}

export default function PayerData ({ data, className, header = false }) {
  const supportedPayerData = ['name', 'pubkey', 'email', 'identifier']

  if (!data) {
    return null
  }
  return (
    <div className={className}>
      {header && <small className='fw-bold'>sender information:</small>}
      {Object.entries(data)
      // Don't display unsupported keys
        .filter(([key]) => supportedPayerData.includes(key))
        .map(([key, value]) => {
          return <div key={key}><small>{value} ({key})</small></div>
        })}
    </div>
  )
}
