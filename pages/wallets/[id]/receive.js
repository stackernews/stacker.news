import { getGetServerSideProps } from '@/api/ssrApollo'
import { Form, Input, SubmitButton } from '@/components/form'
import { utf8ByteLength, walletInvoiceSchema } from '@/lib/validate'
import { CREATE_WALLET_INVOICE } from '@/wallets/client/fragments'
import { WalletActionEmpty, WalletActionShell, WalletBottomBar, WalletRoutePage } from '@/wallets/client/components'
import { useRouteWallet, useWalletCapabilities } from '@/wallets/client/hooks'
import { MAX_INVOICE_DESCRIPTION_LENGTH, MAX_WALLET_INVOICE_SATS } from '@/lib/constants'
import sharedStyles from '@/wallets/client/components/wallet.module.css'
import sendStyles from '@/wallets/client/components/send/send.module.css'
import classNames from 'classnames'
import { useMutation } from '@apollo/client/react'
import { InputGroup } from 'react-bootstrap'
import { useRouter } from 'next/router'
import { FormikConsumer } from 'formik'
const styles = { ...sharedStyles, ...sendStyles }

export const getServerSideProps = getGetServerSideProps({ authRequired: true })

export default function WalletReceivePage () {
  const { wallet, ready } = useRouteWallet()

  return (
    <WalletRoutePage ready={ready} resource={wallet}>
      {wallet => <WalletReceive wallet={wallet} />}
    </WalletRoutePage>
  )
}

function WalletReceive ({ wallet }) {
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
        initial={{
          amount: 10000,
          description: ''
        }}
        schema={walletInvoiceSchema}
        onSubmit={async ({ amount, description }) => {
          const normalizedDescription = (description || '').trim()
          const { data } = await createWalletInvoice({
            variables: {
              walletId: wallet.id,
              amount: Number(amount),
              description: normalizedDescription || undefined
            }
          })
          // the QR + live settlement status now live on the transaction page
          await router.push(`/wallets/transactions/${data.createWalletInvoice.transaction.id}`)
        }}
      >
        <div className={classNames(styles.fields, styles.formResponsiveReset, 'd-flex flex-column')}>
          <Input
            label='amount'
            name='amount'
            type='number'
            step={10}
            max={MAX_WALLET_INVOICE_SATS}
            required
            autoFocus
            append={<InputGroup.Text className='text-monospace'>sats</InputGroup.Text>}
          />
          <FormikConsumer>
            {({ values }) => {
              const bytes = utf8ByteLength((values.description || '').trim())
              const remaining = MAX_INVOICE_DESCRIPTION_LENGTH - bytes
              return (
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
