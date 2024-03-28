import { createContext } from 'react'
import { CenterLayout } from '@/components/layout'
import LogMessage from '@/components/log-message'
import { useWalletLogger } from '@/components/logger'
import { getGetServerSideProps } from '@/api/ssrApollo'

export const getServerSideProps = getGetServerSideProps({ query: null })

export const WalletLogsContext = createContext()

export default function WalletLogs () {
  const { logs } = useWalletLogger()
  // TODO add filter by wallet, add sort by timestamp
  return (
    <>
      <CenterLayout>
        <h2 className='text-center'>wallet logs</h2>
        <div>
          {logs.map((log, i) => <LogMessage key={i} {...log} />)}
        </div>
      </CenterLayout>
    </>
  )
}
