import { getGetServerSideProps } from '@/api/ssrApollo'
import { Form, ClientInput, ClientCheckbox, PasswordInput } from '@/components/form'
import { CenterLayout } from '@/components/layout'
import { WalletSecurityBanner } from '@/components/banners'
import { WalletLogs } from '@/components/wallet-logger'
import { useToast } from '@/components/toast'
import { useRouter } from 'next/router'
import { useWallet, Status } from 'wallets'
import Info from '@/components/info'
import Text from '@/components/text'
import { AutowithdrawSettings } from '@/components/autowithdraw-shared'
import dynamic from 'next/dynamic'
import { object, string } from 'yup'
import { autowithdrawSchemaMembers } from '@/lib/validate'
import { useMe } from '@/components/me'
import { TOR_REGEXP } from '@/lib/url'

const WalletButtonBar = dynamic(() => import('@/components/wallet-buttonbar.js'), { ssr: false })

export const getServerSideProps = getGetServerSideProps({ authRequired: true })

export default function WalletSettings () {
  const toaster = useToast()
  const router = useRouter()
  const { wallet: name } = router.query
  const wallet = useWallet(name)
  const me = useMe()

  const initial = wallet.fields.reduce((acc, field) => {
    // We still need to run over all wallet fields via reduce
    // even though we use wallet.config as the initial value
    // since wallet.config is empty when wallet is not configured.
    // Also, wallet.config includes general fields like
    // 'enabled' and 'priority' which are not defined in wallet.fields.
    return {
      ...acc,
      [field.name]: wallet.config?.[field.name] || ''
    }
  }, wallet.config)

  const schema = generateSchema(wallet, { me })

  return (
    <CenterLayout>
      <h2 className='pb-2'>{wallet.card.title}</h2>
      <h6 className='text-muted text-center pb-3'><Text>{wallet.card.subtitle}</Text></h6>
      {!wallet.walletType && <WalletSecurityBanner />}
      <Form
        initial={initial}
        schema={schema}
        onSubmit={async (values) => {
          try {
            const newConfig = !wallet.isConfigured

            // enable wallet if wallet was just configured
            if (newConfig) {
              values.enabled = true
            }

            await wallet.save(values)

            if (values.enabled) wallet.enable()
            else wallet.disable()

            toaster.success('saved settings')
            router.push('/settings/wallets')
          } catch (err) {
            console.error(err)
            const message = 'failed to attach: ' + err.message || err.toString?.()
            toaster.danger(message)
          }
        }}
      >
        <WalletFields wallet={wallet} />
        {wallet.walletType
          ? <AutowithdrawSettings wallet={wallet} />
          : (
            <ClientCheckbox
              disabled={!wallet.isConfigured}
              initialValue={wallet.status === Status.Enabled}
              label='enabled'
              name='enabled'
            />
            )}
        <WalletButtonBar
          wallet={wallet} onDelete={async () => {
            try {
              await wallet.delete()
              toaster.success('saved settings')
              router.push('/settings/wallets')
            } catch (err) {
              console.error(err)
              const message = 'failed to detach: ' + err.message || err.toString?.()
              toaster.danger(message)
            }
          }}
        />
      </Form>
      <div className='mt-3 w-100'>
        <WalletLogs wallet={wallet} embedded />
      </div>
    </CenterLayout>
  )
}

function WalletFields ({ wallet: { config, fields } }) {
  return fields.map(({ name, label, type, help, optional, ...props }, i) => {
    const rawProps = {
      ...props,
      name,
      initialValue: config?.[name],
      label: (
        <div className='d-flex align-items-center'>
          {label}
          {/* help can be a string or object to customize the label */}
          {help && (
            <Info label={help.label || 'help'}>
              <Text>{help.text || help}</Text>
            </Info>
          )}
          {optional && (
            <small className='text-muted ms-2'>
              {typeof optional === 'boolean' ? 'optional' : <Text>{optional}</Text>}
            </small>
          )}
        </div>
      ),
      required: !optional,
      autoFocus: i === 0
    }
    if (type === 'text') {
      return <ClientInput key={i} {...rawProps} />
    }
    if (type === 'password') {
      return <PasswordInput key={i} {...rawProps} newPass />
    }
    return null
  })
}

function generateSchema (wallet, { me }) {
  if (wallet.schema) return wallet.schema

  const fieldValidator = (field) => {
    if (!field.validate) {
      // default validation
      let validator = string()
      if (!field.optional) validator = validator.required('required')
      return validator
    }

    if (field.validate.schema) {
      // complex validation
      return field.validate.schema
    }

    const { type: validationType } = field.validate

    let validator

    const stringTypes = ['url', 'string']

    if (stringTypes.includes(validationType)) {
      validator = string()

      if (field.validate.length) {
        validator = validator.length(field.validate.length)
      }
    }

    if (validationType === 'url') {
      validator = process.env.NODE_ENV === 'development'
        ? validator
          .or([string().matches(/^(http:\/\/)?localhost:\d+$/), string().url()], 'invalid url')
        : validator
          .url()
          .test(async (url, context) => {
            if (field.validate.onionAllowed && TOR_REGEXP.test(url)) {
              // allow HTTP and HTTPS over Tor
              if (!/^https?:\/\//.test(url)) {
                return context.createError({ message: 'http or https required' })
              }
              return true
            }
            try {
              // force HTTPS over clearnet
              await string().https().validate(url)
            } catch (err) {
              return context.createError({ message: err.message })
            }
            return true
          })
    }

    if (!field.optional) validator = validator.required('required')

    return validator
  }

  return object(
    wallet.fields.reduce((acc, field) => {
      return {
        ...acc,
        [field.name]: fieldValidator(field)
      }
    }, wallet.walletType ? autowithdrawSchemaMembers({ me }) : {})
  )
}
