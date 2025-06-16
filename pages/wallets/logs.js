import { getGetServerSideProps } from '@/api/ssrApollo'
import { WalletLayout, WalletLayoutHeader, WalletLogs } from '@/wallets/client/components'

export const getServerSideProps = getGetServerSideProps({ authRequired: true })

export default function WalletLogsPage () {
  return (
    <WalletLayout>
      <div className='py-5'>
        <WalletLayoutHeader>wallet logs</WalletLayoutHeader>
        <WalletLogs />
      </div>
    </WalletLayout>
  )
}
