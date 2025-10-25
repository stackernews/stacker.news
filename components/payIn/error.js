import { WalletConfigurationError, WalletPaymentAggregateError } from '@/wallets/client/errors'

export default function PayInError ({ error }) {
  if (!error || error instanceof WalletConfigurationError) return null

  if (!(error instanceof WalletPaymentAggregateError)) {
    console.error('unexpected wallet error:', error)
    return null
  }

  return (
    <div className='text-center fw-bold text-info mb-3' style={{ lineHeight: 1.25 }}>
      <div className='text-info mb-2'>Paying from attached wallets failed:</div>
      {error.errors.map((e, i) => (
        <div key={i}>
          <code>{e.wallet}: {e.reason || e.message}</code>
        </div>
      ))}
    </div>
  )
}
