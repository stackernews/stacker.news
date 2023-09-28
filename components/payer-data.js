import { useEffect, useState } from 'react'

export default function PayerData ({ data, className, header = false }) {
  const supportedPayerData = ['name', 'pubkey', 'email', 'identifier', 'auth']
  const [parsed, setParsed] = useState({})
  const [error, setError] = useState(false)

  useEffect(() => {
    setError(false)
    try {
      setParsed(JSON.parse(decodeURIComponent(data)))
    } catch (err) {
      console.error('error parsing payer data', err)
      setError(true)
    }
  }, [data])

  if (!data || error) {
    return null
  }
  return (
    <div className={className}>
      {header && <small className='fw-bold'>sender information:</small>}
      {Object.entries(parsed)
      // Don't display unsupported keys
        .filter(([key]) => supportedPayerData.includes(key))
        .map(([key, value]) => {
          if (key === 'auth') {
            // display the auth key, not the whole object
            return <div key={key}><small>{value.key} ({key})</small></div>
          }
          return <div key={key}><small>{value} ({key})</small></div>
        })}
    </div>
  )
}
