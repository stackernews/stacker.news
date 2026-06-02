import { getGetServerSideProps } from '@/api/ssrApollo'
import { WalletLayoutHeader, WalletLogs, WalletShellMain } from '@/wallets/client/components'

export const getServerSideProps = getGetServerSideProps({ authRequired: true })

export default function WalletLogsPage () {
  return (
    <WalletShellMain>
      <div className='py-5'>
        <WalletLayoutHeader>wallet logs</WalletLayoutHeader>
        <WalletLogs />
      </div>
    </WalletShellMain>
  )
}
