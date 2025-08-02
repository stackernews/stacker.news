import { getGetServerSideProps } from '@/api/ssrApollo'
import { WalletLayout, WalletLayoutHeader, WalletLayoutSubHeader, WalletSettings as WalletSettingsComponent } from '@/wallets/client/components'
import { WALLET_SETTINGS } from '@/wallets/client/fragments'

export const getServerSideProps = getGetServerSideProps({ query: WALLET_SETTINGS, authRequired: true })

export default function WalletSettings ({ ssrData }) {
  return (
    <WalletLayout>
      <div className='py-5 mx-auto w-100' style={{ maxWidth: '600px' }}>
        <WalletLayoutHeader>wallet settings</WalletLayoutHeader>
        <WalletLayoutSubHeader>apply globally to all wallets</WalletLayoutSubHeader>
        <WalletSettingsComponent ssrData={ssrData} />
      </div>
    </WalletLayout>
  )
}
