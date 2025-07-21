import { formatBytes } from '@/lib/format'
import { useEffect, useState } from 'react'
import { useKeyHash } from '@/wallets/client/context'
import { useRemoteKeyHash } from '@/wallets/client/hooks'

export function WalletDebugSettings () {
  const localKeyHash = useKeyHash()
  const remoteKeyHash = useRemoteKeyHash()
  const [persistent, setPersistent] = useState(null)
  const [quota, setQuota] = useState(null)
  const [usage, setUsage] = useState(null)

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
    <div className='container text-muted mt-5'>
      <div className='row'>
        <div className='col text-nowrap'>persistent storage:</div>
        <div className='col'>{persistent !== null ? persistent?.toString() : 'unknown'}</div>
      </div>
      <div className='row'>
        <div className='col text-nowrap'>storage quota:</div>
        <div className='col'>{quota !== null ? formatBytes(quota) : 'unknown'}</div>
      </div>
      <div className='row'>
        <div className='col text-nowrap'>storage usage:</div>
        <div className='col'>{usage !== null ? formatBytes(usage) : 'unknown'}</div>
      </div>
      <div className='row'>
        <div className='col text-nowrap'>storage remaining:</div>
        <div className='col'>{usage !== null && quota !== null ? formatBytes(quota - usage) : 'unknown'}</div>
      </div>
      <div className='row'>
        <div className='col text-nowrap'>device key hash:</div>
        <div className='col'>{localKeyHash ? shortHash(localKeyHash) : 'unknown'}</div>
      </div>
      <div className='row'>
        <div className='col text-nowrap'>server key hash:</div>
        <div className='col'>{remoteKeyHash ? shortHash(remoteKeyHash) : 'unknown'}</div>
      </div>
    </div>
  )
}

function shortHash (hash) {
  return hash.slice(0, 6) + '...' + hash.slice(-6)
}
