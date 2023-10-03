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
