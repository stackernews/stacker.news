import { formatBytes } from '@/lib/format'
import { useEffect, useState } from 'react'
import { useKeyHash, useKeyUpdatedAt } from '@/wallets/client/context'
import { useDiagnostics, useRemoteKeyHash, useRemoteKeyHashUpdatedAt, useWalletsUpdatedAt } from '@/wallets/client/hooks'
import { timeSince } from '@/lib/time'

export function WalletDebugSettings () {
  const localKeyHash = useKeyHash()
  const localKeyUpdatedAt = useKeyUpdatedAt()
  const remoteKeyHash = useRemoteKeyHash()
  const remoteKeyHashUpdatedAt = useRemoteKeyHashUpdatedAt()
  const walletsUpdatedAt = useWalletsUpdatedAt()
  const [persistent, setPersistent] = useState(null)
  const [quota, setQuota] = useState(null)
  const [usage, setUsage] = useState(null)
  const [diagnostics, setDiagnostics] = useDiagnostics()

  useEffect(() => {
    async function init () {
      try {
        const persistent = await navigator.storage.persisted()
        setPersistent(persistent)
      } catch (err) {
        console.error('failed to check persistent storage:', err)
      }
      try {
        const estimate = await navigator.storage.estimate()
        setQuota(estimate.quota)
        setUsage(estimate.usage)
      } catch (err) {
        console.error('failed to get estimate:', err)
      }
    }
    init()
  }, [])

  return (
    <div className='d-grid column-gap-2 text-muted mt-3 mx-auto w-fit-content' style={{ gridTemplateColumns: '1fr 1fr' }}>
      <div className='text-nowrap'>persistent storage:</div>
      <div className='text-end'>{persistent !== null ? persistent?.toString() : 'unknown'}</div>
      <div className='text-nowrap'>storage quota:</div>
      <div className='text-end'>{quota !== null ? formatBytes(quota) : 'unknown'}</div>
      <div className='text-nowrap'>storage usage:</div>
      <div className='text-end'>{usage !== null ? formatBytes(usage) : 'unknown'}</div>
      <div className='text-nowrap'>storage remaining:</div>
      <div className='text-end'>{usage !== null && quota !== null ? formatBytes(quota - usage) : 'unknown'}</div>
      <div className='text-nowrap'>device key hash:</div>
      <div className='text-end'>{localKeyHash ? shortHash(localKeyHash) : 'unknown'}</div>
      <div className='text-nowrap'>server key hash:</div>
      <div className='text-end'>{remoteKeyHash ? shortHash(remoteKeyHash) : 'unknown'}</div>
      <div className='text-nowrap'>device key update:</div>
      <div className='text-end' suppressHydrationWarning>
        {localKeyUpdatedAt ? `${timeSince(new Date(localKeyUpdatedAt))}` : 'unknown'}
      </div>
      <div className='text-nowrap'>server key update:</div>
      <div className='text-end' suppressHydrationWarning>
        {remoteKeyHashUpdatedAt ? `${timeSince(new Date(remoteKeyHashUpdatedAt))}` : 'unknown'}
      </div>
      <div className='text-nowrap'>wallet update:</div>
      <div className='text-end' suppressHydrationWarning>
        {walletsUpdatedAt ? `${timeSince(new Date(walletsUpdatedAt))}` : 'unknown'}
      </div>
      <div className='text-nowrap'>diagnostics:</div>
      {/* not using Formik here because we want to submit immediately on change */}
      <input
        type='checkbox'
        checked={diagnostics}
        style={{ justifySelf: 'end', accentColor: 'var(--bs-primary)' }}
        onChange={(e) => setDiagnostics(e.target.checked)}
      />
    </div>
  )
}

function shortHash (hash) {
  return hash.slice(0, 6) + '...' + hash.slice(-6)
}
