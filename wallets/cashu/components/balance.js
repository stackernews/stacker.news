import { numWithUnits } from '@/lib/format'
import { useCashuBalance } from '@/wallets/cashu/components/context'

export default function Balance (wallet, { showModal }) {
  const balance = useCashuBalance()
  return (
    <div className='text-muted'>
      {numWithUnits(balance, { abbreviate: false })}
    </div>
  )
}
