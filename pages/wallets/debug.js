import { getGetServerSideProps } from '@/api/ssrApollo'
import { WalletLayout, WalletLayoutHeader, WalletDebugSettings, WalletLogs } from '@/wallets/client/components'

export const getServerSideProps = getGetServerSideProps({ authRequired: true })

export default function WalletDebug () {
  return (
    <WalletLayout>
      <div className='py-5 mx-auto w-100' style={{ maxWidth: '600px' }}>
        <WalletLayoutHeader>wallet debug</WalletLayoutHeader>
        <WalletDebugSettings />
        <WalletLogs className='mt-3' debug />
      </div>
    </WalletLayout>
  )
}
