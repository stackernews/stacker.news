import { getGetServerSideProps } from '../../../api/ssrApollo'
import { Form, ClientInput, ClientCheckbox } from '../../../components/form'
import { CenterLayout } from '../../../components/layout'
import { WalletButtonBar, WalletCard } from '../../../components/wallet-card'
import { nwcSchema } from '../../../lib/validate'
import { useToast } from '../../../components/toast'
import { useRouter } from 'next/router'
import { useNWC } from '../../../components/webln/nwc'
import { WalletSecurityBanner } from '../../../components/banners'

export const getServerSideProps = getGetServerSideProps({ authRequired: true })

export default function NWC () {
  const { nwcUrl, saveConfig, clearConfig, enabled, isDefault } = useNWC()
  const toaster = useToast()
  const router = useRouter()

  return (
    <CenterLayout>
      <h2 className='pb-2'>nwc</h2>
      <h6 className='text-muted text-center pb-3'>use Nostr Wallet Connect for zapping</h6>
      <WalletSecurityBanner />
      <Form
        initial={{
          nwcUrl: nwcUrl || '',
          isDefault: isDefault || false
        }}
        schema={nwcSchema}
        onSubmit={async (values) => {
          try {
            await saveConfig(values)
            toaster.success('saved settings')
            router.push('/settings/wallets')
          } catch (err) {
            console.error(err)
            toaster.danger('failed to attach: ' + err.message || err.toString?.())
          }
        }}
      >
        <ClientInput
          initialValue={nwcUrl}
          label='connection'
          name='nwcUrl'
          required
          autoFocus
        />
        <ClientCheckbox
          disabled={!enabled}
          initialValue={isDefault}
          label='default payment method'
          name='isDefault'
        />
        <WalletButtonBar
          enabled={enabled} onDelete={async () => {
            try {
              await clearConfig()
              toaster.success('saved settings')
              router.push('/settings/wallets')
            } catch (err) {
              console.error(err)
              toaster.danger('failed to unattach: ' + err.message || err.toString?.())
            }
          }}
        />
      </Form>
    </CenterLayout>
  )
}

export function NWCCard () {
  const { enabled } = useNWC()
  return (
    <WalletCard
      title='nwc'
      badges={['send only', 'non-custodialish', 'budgetable']}
      provider='nwc'
      enabled={enabled}
    />
  )
}
