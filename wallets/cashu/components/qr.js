import { useEffect, useState } from 'react'
import { useWalletLogger } from '@/wallets/logger'
import { numWithUnits } from '@/lib/format'
import { CompactLongCountdown } from '@/components/countdown'
import Qr from '@/components/qr'
import { useCashuProofs } from '@/wallets/cashu/components/context'

export default function CashuQr ({ wallet, cashu, mintQuote, amount, onClose }) {
  const logger = useWalletLogger(wallet)
  const [paid, setPaid] = useState(false)
  const { addProofs } = useCashuProofs()

  const amt = numWithUnits(amount, { abbreviate: false })
  const expiresAt = new Date(mintQuote.expiry * 1000).toISOString()

  useEffect(() => {
    const interval = setInterval(async () => {
      const { paid } = await cashu.checkMintQuote(mintQuote.quote)
      setPaid(paid)
      if (paid) {
        const newProofs = await cashu.mintProofs(amount, mintQuote.quote)
        await addProofs(newProofs)
        logger.ok(`minted ${amt} of tokens`, { quote: mintQuote.quote, request: mintQuote.request })
        clearInterval(interval)
        onClose()
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [mintQuote.id, addProofs, logger])

  let statusVariant = 'pending'
  let status = <CompactLongCountdown date={expiresAt} />

  if (paid) {
    statusVariant = 'confirmed'
    status = <>{amt} received</>
  }

  return (
    <Qr
      value={mintQuote.request}
      description={numWithUnits(amount, { abbreviate: false })}
      statusVariant={statusVariant}
      status={status}
    />
  )
}
