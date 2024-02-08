import { getGetServerSideProps } from '../../../api/ssrApollo'
import { Form, ClientInput, ClientCheckbox } from '../../../components/form'
import { CenterLayout } from '../../../components/layout'
import { WalletButtonBar, WalletCard } from '../../../components/wallet-card'
import { lnbitsSchema } from '../../../lib/validate'
import { useToast } from '../../../components/toast'
import { useRouter } from 'next/router'
import { useLNbits } from '../../../components/webln/lnbits'
import { WalletSecurityBanner } from '../../../components/banners'

export const getServerSideProps = getGetServerSideProps({ authRequired: true })

export default function LNbits () {
  const { url, adminKey, saveConfig, clearConfig, enabled, isDefault } = useLNbits()
  const toaster = useToast()
  const router = useRouter()

  return (
    <CenterLayout>
      <h2 className='pb-2'>LNbits</h2>
      <h6 className='text-muted text-center pb-3'>use LNbits for payments</h6>
      <WalletSecurityBanner />
      <Form
        initial={{
          url: url || '',
          adminKey: adminKey || '',
          isDefault: isDefault || false
        }}
        schema={lnbitsSchema}
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
          initialValue={url}
          label='lnbits url'
          name='url'
          required
          autoFocus
        />
        <ClientInput
          initialValue={adminKey}
          type='password'
          autoComplete='false'
          label='admin key'
          name='adminKey'
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

export function LNbitsCard () {
  const { enabled } = useLNbits()
  return (
    <WalletCard
      title='LNbits'
      badges={['send only', 'non-custodialish']}
      provider='lnbits'
      enabled={enabled}
    />
  )
}
