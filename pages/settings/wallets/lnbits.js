import { getGetServerSideProps } from '../../../api/ssrApollo'
import { Form, Input } from '../../../components/form'
import { CenterLayout } from '../../../components/layout'
import { WalletButtonBar, WalletCard } from '../../../components/wallet-card'
import { lnbitsSchema } from '../../../lib/validate'
import { useToast } from '../../../components/toast'
import { useRouter } from 'next/router'
import { useCallback, useEffect, useState } from 'react'

export const getServerSideProps = getGetServerSideProps({ authRequired: true })

const useLNbits = () => {
  const [config, setConfig] = useState(null)
  const storageKey = 'lnbitsConfig'

  useEffect(() => {
    const config = window.localStorage.getItem(storageKey)
    if (config) setConfig(JSON.parse(config))
  }, [])

  const setLNbits = useCallback(({ url, adminKey }) => {
    const config = { url, adminKey }
    // TODO encrypt credentials / see how mutiny encrypts wallets
    window.localStorage.setItem(storageKey, JSON.stringify(config))
    setConfig(config)
  }, [])

  const removeLNbits = useCallback(() => {
    window.localStorage.removeItem(storageKey)
    setConfig(null)
  })

  return { config, isEnabled: !!config, setLNbits, removeLNbits }
}

export default function LNbits () {
  const { config, isEnabled, setLNbits, removeLNbits } = useLNbits()
  const toaster = useToast()
  const router = useRouter()

  return (
    <CenterLayout>
      <h2 className='pb-2'>lnbits</h2>
      <h6 className='text-muted text-center pb-3'>use lnbits for zapping</h6>
      <Form
        // FIXME initial values are empty since we config is initialized after first render
        initial={{
          url: config?.url || '',
          adminKey: config?.adminKey || ''
        }}
        schema={lnbitsSchema}
        onSubmit={async (values) => {
          try {
            await setLNbits(values)
            toaster.success('saved settings')
            router.push('/settings/wallets')
          } catch (err) {
            console.error(err)
            toaster.danger('failed to attach:' + err.message || err.toString?.())
          }
        }}
      >
        <Input
          label='lnbits url'
          name='url'
          required
          autoFocus
        />
        <Input
          type='password'
          autoComplete='false'
          label='admin key'
          name='adminKey'
        />
        <WalletButtonBar
          enabled={isEnabled} onDelete={async () => {
            try {
              await removeLNbits()
              toaster.success('saved settings')
              router.push('/settings/wallets')
            } catch (err) {
              console.error(err)
              toaster.danger('failed to unattach:' + err.message || err.toString?.())
            }
          }}
        />
      </Form>
    </CenterLayout>
  )
}

export function LNbitsCard () {
  const { isEnabled } = useLNbits()
  return (
    <WalletCard
      title='lnbits'
      badges={['send only', 'non-custodialish']}
      provider='lnbits'
      enabled={isEnabled}
    />
  )
}
