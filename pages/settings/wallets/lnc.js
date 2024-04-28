import { getGetServerSideProps } from '@/api/ssrApollo'
import { WalletSecurityBanner } from '@/components/banners'
import { ClientCheckbox, Form, PasswordInput } from '@/components/form'
import Info from '@/components/info'
import { CenterLayout } from '@/components/layout'
import Text from '@/components/text'
import { useToast } from '@/components/toast'
import { WalletButtonBar, WalletCard, isConfigured } from '@/components/wallet-card'
import WalletLogs from '@/components/wallet-logs'
import { Status, useWebLNConfigurator } from '@/components/webln'
import { XXX_DEFAULT_PASSWORD, useLNC } from '@/components/webln/lnc'
import { lncSchema } from '@/lib/validate'
import { useRouter } from 'next/router'
import { useEffect, useRef } from 'react'
import { Wallet } from '@/lib/constants'

export const getServerSideProps = getGetServerSideProps({ authRequired: true })

export default function LNC () {
  const { provider, enabledProviders, setProvider } = useWebLNConfigurator()
  const toaster = useToast()
  const router = useRouter()
  const lnc = useLNC()
  const { status, clearConfig, saveConfig, config, name, unlock } = lnc
  const isDefault = provider?.name === name
  const unlocking = useRef(false)
  const configured = isConfigured(status)

  useEffect(() => {
    if (!unlocking.current && status === Status.Locked) {
      unlocking.current = true
      unlock()
    }
  }, [status, unlock])

  const defaultPassword = config?.password === XXX_DEFAULT_PASSWORD

  return (
    <CenterLayout>
      <h2>Lightning Node Connect for LND</h2>
      <h6 className='text-muted text-center pb-3'>use Lightning Node Connect for LND payments</h6>
      <WalletSecurityBanner />
      <Form
        initial={{
          pairingPhrase: config?.pairingPhrase || '',
          password: (!config?.password || defaultPassword) ? '' : config.password
        }}
        schema={lncSchema}
        onSubmit={async ({ isDefault, ...values }) => {
          try {
            await saveConfig(values)
            if (isDefault) setProvider(lnc)
            toaster.success('saved settings')
            router.push('/settings/wallets')
          } catch (err) {
            console.error(err)
            toaster.danger('failed to attach: ' + err.message || err.toString?.())
          }
        }}
      >
        <PasswordInput
          label={
            <div className='d-flex align-items-center'>pairing phrase
              <Info label='help'>
                <Text>
                  {'We only need permissions for the uri `/lnrpc.Lightning/SendPaymentSync`\n\nCreate a budgeted account with narrow permissions:\n\n```$ litcli accounts create --balance <budget>```\n\n```$ litcli sessions add --type custom --account_id <account_id> --uri /lnrpc.Lightning/SendPaymentSync```'}
                </Text>
              </Info>
            </div>
          }
          name='pairingPhrase'
          initialValue={config?.pairingPhrase}
          newPass={config?.pairingPhrase === undefined}
          readOnly={configured}
          required
          autoFocus
        />
        <PasswordInput
          label={<>password <small className='text-muted ms-2'>optional</small></>}
          name='password'
          initialValue={defaultPassword ? '' : config?.password}
          newPass={config?.password === undefined || defaultPassword}
          readOnly={configured}
          hint='encrypts your pairing phrase when stored locally'
        />
        <ClientCheckbox
          disabled={!configured || isDefault || enabledProviders?.length === 1}
          initialValue={isDefault}
          label='default payment method'
          name='isDefault'
        />
        <WalletButtonBar
          status={status} onDelete={async () => {
            try {
              await clearConfig()
              toaster.success('saved settings')
              router.push('/settings/wallets')
            } catch (err) {
              console.error(err)
              toaster.danger('failed to detach: ' + err.message || err.toString?.())
            }
          }}
        />
      </Form>
      <div className='mt-3 w-100'>
        <WalletLogs wallet={Wallet.LNC} embedded />
      </div>
    </CenterLayout>
  )
}

export function LNCCard () {
  const { status } = useLNC()
  return (
    <WalletCard
      title='LNC'
      badges={['send only', 'non-custodial', 'budgetable']}
      provider='lnc'
      status={status}
    />
  )
}
