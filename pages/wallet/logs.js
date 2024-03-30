import { createContext, useEffect } from 'react'
import { CenterLayout } from '@/components/layout'
import LogMessage from '@/components/log-message'
import { useWalletLogger } from '@/components/logger'
import { getGetServerSideProps } from '@/api/ssrApollo'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { datePivot } from '@/lib/time'
import styles from '@/styles/log.module.css'

export const getServerSideProps = getGetServerSideProps({ query: null })

export const WalletLogsContext = createContext()

export default function WalletLogs () {
  const { logs, loadLogs, logStart } = useWalletLogger()

  const more = logs.length > 0 ? logStart < logs[0].ts : false

  const router = useRouter()
  // TODO add filter by wallet, add sort by timestamp
  const since = router.query.since ? parseInt(router.query.since, 10) : +datePivot(new Date(), { minutes: -5 })
  const sinceRounded = Math.floor(since / 60e3) * 60e3
  const earlierTs5m = more ? +datePivot(new Date(since), { minutes: -5 }) : logStart
  const earlierTs1h = more ? +datePivot(new Date(since), { hours: -1 }) : logStart
  const earlierTs6h = more ? +datePivot(new Date(since), { hours: -6 }) : logStart

  useEffect(() => {
    loadLogs(sinceRounded)
  }, [sinceRounded])

  return (
    <>
      <CenterLayout>
        <h2 className='text-center'>wallet logs</h2>
        <div>
          <div className={styles.header}>
            <span>show earlier logs:</span>
            <Link href={`/wallet/logs?since=${earlierTs5m}`} className='mx-1 text-muted text-underline'>5m</Link>
            <Link href={`/wallet/logs?since=${earlierTs1h}`} className='mx-1 text-muted text-underline'>1h</Link>
            <Link href={`/wallet/logs?since=${earlierTs6h}`} className='mx-1 text-muted text-underline'>6h</Link>
            <span className='mx-1 text-muted' suppressHydrationWarning>{new Date(more ? sinceRounded : logStart).toLocaleTimeString()}</span>
          </div>
          <div className={styles.logBox}>
            {!more && <div className={styles.eol}>------ end of logs ------</div>}
            {logs.map((log, i) => <LogMessage key={i} {...log} />)}
          </div>
        </div>
      </CenterLayout>
    </>
  )
}
