import { createContext } from 'react'
import { CenterLayout } from '@/components/layout'
import LogMessage from '@/components/log-message'
import { useWalletLogger } from '@/components/logger'
import { getGetServerSideProps } from '@/api/ssrApollo'
import styles from '@/styles/log.module.css'

export const getServerSideProps = getGetServerSideProps({ query: null })

export const WalletLogsContext = createContext()

export default function WalletLogs () {
  const { logs } = useWalletLogger()

  // TODO add filter by wallet
  return (
    <>
      <CenterLayout>
        <h2 className='text-center'>wallet logs</h2>
        <div>
          <div className={styles.logTable}>
            <table>
              <tbody>
                <tr><td colSpan='4' className='text-center'>------ start of logs ------</td></tr>
                {logs.map((log, i) => <LogMessage key={i} {...log} />)}
              </tbody>
            </table>
          </div>
        </div>
      </CenterLayout>
    </>
  )
}
