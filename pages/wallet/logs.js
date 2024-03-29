import { createContext, useEffect } from 'react'
import { CenterLayout } from '@/components/layout'
import LogMessage from '@/components/log-message'
import { useWalletLogger } from '@/components/logger'
import { getGetServerSideProps } from '@/api/ssrApollo'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { datePivot } from '@/lib/time'

export const getServerSideProps = getGetServerSideProps({ query: null })

export const WalletLogsContext = createContext()

const SKIP_BACK = { minutes: -5 }

export default function WalletLogs () {
  const { logs, loadLogs } = useWalletLogger()

  const router = useRouter()
  // TODO add filter by wallet, add sort by timestamp
  const since = router.query.since ? parseInt(router.query.since, 10) : +datePivot(new Date(), SKIP_BACK)
  const sinceRounded = Math.floor(since / 60e3) * 60e3
  const earlierTs = +datePivot(new Date(since), SKIP_BACK)

  useEffect(() => {
    loadLogs(sinceRounded)
  }, [sinceRounded])

  return (
    <>
      <CenterLayout>
        <h2 className='text-center'>wallet logs</h2>
        <div>
          <div>
            <Link href={`/wallet/logs?since=${earlierTs}`} className='mx-3 text-muted text-underline'>show earlier logs</Link>
          </div>
          <div>
            <div className='mx-3 text-muted' suppressHydrationWarning>{new Date(sinceRounded).toLocaleTimeString()}</div>
            {logs.map((log, i) => <LogMessage key={i} {...log} />)}
          </div>
        </div>
      </CenterLayout>
    </>
  )
}
