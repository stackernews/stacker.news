import { getGetServerSideProps } from '@/api/ssrApollo'
import { Checkbox, Form, Input, SubmitButton } from '@/components/form'
import Info from '@/components/info'
import { useData } from '@/components/use-data'
import { utf8ByteLength, walletInvoiceSchema } from '@/lib/validate'
import { CREATE_WALLET_INVOICE, WALLET_SETTINGS } from '@/wallets/client/fragments'
import { WalletActionEmpty, WalletActionShell, WalletBottomBar, WalletRoutePage } from '@/wallets/client/components'
import { useRouteWallet, useWalletCapabilities } from '@/wallets/client/hooks'
import {
  MAX_INVOICE_DESCRIPTION_LENGTH,
  MAX_WALLET_INVOICE_SATS,
  PROXY_PAYER_MAX_MSATS,
  PROXY_PAYER_MIN_MSATS
} from '@/lib/constants'
import sharedStyles from '@/wallets/client/components/wallet.module.css'
import sendStyles from '@/wallets/client/components/send/send.module.css'
import classNames from 'classnames'
import { useMutation, useQuery } from '@apollo/client/react'
import { InputGroup } from 'react-bootstrap'
import { useRouter } from 'next/router'
import { FormikConsumer } from 'formik'
const styles = { ...sharedStyles, ...sendStyles }

export const getServerSideProps = getGetServerSideProps({ query: WALLET_SETTINGS, authRequired: true })

export default function WalletReceivePage ({ ssrData }) {
  const { wallet, ready } = useRouteWallet()
  const { data } = useQuery(WALLET_SETTINGS)
  const settings = useData(data, ssrData)?.walletSettings

  return (
    <WalletRoutePage ready={ready} resource={wallet}>
      {wallet => <WalletReceive wallet={wallet} defaultProxyReceive={settings?.proxyReceive ?? false} />}
    </WalletRoutePage>
  )
}

function WalletReceive ({ wallet, defaultProxyReceive }) {
  const { canReceive } = useWalletCapabilities(wallet)
  const [createWalletInvoice] = useMutation(CREATE_WALLET_INVOICE)
  const router = useRouter()

  if (!canReceive) {
    return (
      <WalletActionShell wallet={wallet} title='receive'>
        <WalletActionEmpty
          message="This wallet cannot receive right now. Check this wallet's configure page and logs."
          backHref={`/wallets/${wallet.id}`}
        />
      </WalletActionShell>
    )
  }

  return (
    <WalletActionShell wallet={wallet} title='receive'>
      <Form
        enableReinitialize
        initial={{
          amount: 10000,
          description: '',
          proxyReceive: defaultProxyReceive
        }}
        schema={walletInvoiceSchema}
        onSubmit={async ({ amount, description, proxyReceive }) => {
          const normalizedDescription = (description || '').trim()
          const { data } = await createWalletInvoice({
            variables: {
              walletId: wallet.id,
              amount: Number(amount),
              description: normalizedDescription || undefined,
              proxyReceive
            }
          })
          // the QR + live settlement status now live on the transaction page
          await router.push(proxyReceive
            ? `/transactions/${data.createWalletInvoice}`
            : `/wallets/transactions/${data.createWalletInvoice}`)
        }}
      >
        <div className={classNames(styles.fields, styles.formResponsiveReset, 'd-flex flex-column')}>
          <FormikConsumer>
            {({ values }) => {
              const bytes = utf8ByteLength((values.description || '').trim())
              const remaining = MAX_INVOICE_DESCRIPTION_LENGTH - bytes
              const min = values.proxyReceive ? Number(PROXY_PAYER_MIN_MSATS / 1000n) : 1
              const max = values.proxyReceive ? Number(PROXY_PAYER_MAX_MSATS / 1000n) : MAX_WALLET_INVOICE_SATS
              return (
                <>
                  <Input
                    label='amount'
                    name='amount'
                    type='number'
                    step={1}
                    min={min}
                    max={max}
                    required
                    autoFocus
                    append={<InputGroup.Text className='text-monospace'>sats</InputGroup.Text>}
                  />
                  <Input
                    label='memo'
                    name='description'
                    as='textarea'
                    rows={3}
                    hint={
                      <span className={remaining < 0 ? 'text-danger' : 'text-muted'}>
                        {remaining < 0
                          ? 'description is too long'
                          : `${remaining} memo space remaining`}
                      </span>
                    }
                  />
                  <Checkbox
                    name='proxyReceive'
                    label={
                      <span className='d-flex align-items-center'>
                        proxy receive for enhanced privacy
                        <Info>
                          <ul>
                            <li>Stacker News wraps the invoice so the payer cannot identify your external wallet</li>
                            <li>the payer pays the entered amount and your wallet receives about 97%</li>
                            <li>if proxying fails, we will not expose your wallet by falling back to a direct invoice</li>
                          </ul>
                        </Info>
                      </span>
                    }
                  />
                </>
              )
            }}
          </FormikConsumer>
        </div>
        <WalletBottomBar className={styles.footer}>
          <SubmitButton variant='primary' className={styles.submit}>
            make invoice
          </SubmitButton>
        </WalletBottomBar>
      </Form>
    </WalletActionShell>
  )
}
