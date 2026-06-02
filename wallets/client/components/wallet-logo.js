import { useState } from 'react'
import { useWalletImage } from '@/wallets/client/hooks'
import { walletDisplayName } from '@/wallets/lib/util'

// Shared wallet-logo-with-fallback. Wires onError so a 404'd logo falls back
// instead of rendering broken. `fallback`: 'initial' (first letter) or 'name'
// (full display name). Callers pass their own CSS classes so this stays
// CSS-module agnostic. Tracking the errored src (vs a reset effect) lets a
// changed src — e.g. a dark-mode swap — retry.
export function WalletLogo ({ name, fallback = 'initial', className, fallbackClassName, height }) {
  const image = useWalletImage(name)
  const [erroredSrc, setErroredSrc] = useState(null)

  if (image && erroredSrc !== image.src) {
    return (
      <img
        className={className}
        src={image.src}
        alt={image.alt}
        onError={() => setErroredSrc(image.src)}
        style={height ? { height, width: 'auto', maxWidth: '100%' } : undefined}
      />
    )
  }

  const display = walletDisplayName(name)
  return <span className={fallbackClassName}>{fallback === 'name' ? display : display.slice(0, 1)}</span>
}
