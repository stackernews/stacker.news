import { getGetServerSideProps } from '@/api/ssrApollo'
import { CopyInput, Form, Input, SubmitButton } from '@/components/form'
import Qr from '@/components/qr'
import { walletInvoiceSchema } from '@/lib/validate'
import { msatsToSats, numWithUnits } from '@/lib/format'
import { CREATE_WALLET_INVOICE } from '@/wallets/client/fragments'
import { WalletErrorShell, WalletLayoutImageOrName, WalletLoadingShell, WalletRouteGateShell, WalletShell } from '@/wallets/client/components'
import { useWalletStatus, useWalletSupport, useWallets } from '@/wallets/client/hooks'
import { MAX_INVOICE_DESCRIPTION_LENGTH, MAX_WALLET_INVOICE_SATS } from '@/lib/constants'
import styles from '@/styles/wallet.module.css'
import { useMutation } from '@apollo/client/react'
import { InputGroup } from 'react-bootstrap'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useFormikContext } from 'formik'

export const getServerSideProps = getGetServerSideProps({ authRequired: true })

export default function WalletReceivePage () {
  const router = useRouter()
  const wallets = useWallets()
  const wallet = useMemo(() => {
    const id = Number(router.query.id)
    if (!Number.isSafeInteger(id)) return null
    return wallets.find(wallet => Number(wallet.id) === id) ?? null
  }, [router.query.id, wallets])

  return (
    <WalletRouteGateShell>
      {!router.isReady
        ? <WalletLoadingShell />
        : !wallet
            ? <WalletErrorShell title='wallet not found' message='this wallet could not be found' />
            : <WalletReceive wallet={wallet} />}
    </WalletRouteGateShell>
  )
}

function WalletReceive ({ wallet }) {
  const support = useWalletSupport(wallet)
  const status = useWalletStatus(wallet)
  const [invoice, setInvoice] = useState()
  const [createWalletInvoice] = useMutation(CREATE_WALLET_INVOICE)
  const protocol = useMemo(() => {
    return wallet.protocols.find(protocol => !protocol.send && protocol.enabled)
  }, [wallet.protocols])
  const canReceive = support.receive && protocol && !['ERROR', 'DISABLED'].includes(status.receive)

  if (!canReceive) {
    return (
      <WalletActionShell wallet={wallet} title='receive'>
        <div className='text-muted text-center'>
          This wallet cannot receive right now. Check this wallet's configure page and logs.
        </div>
      </WalletActionShell>
    )
  }

  return (
    <WalletActionShell wallet={wallet} title='receive'>
      <Form
        style={{ display: invoice ? 'none' : undefined }}
        initial={{
          amount: 10000,
          description: ''
        }}
        schema={walletInvoiceSchema}
        onSubmit={async ({ amount, description }) => {
          const { data } = await createWalletInvoice({
            variables: {
              walletId: wallet.id,
              amount: Number(amount),
              description: description || undefined
            }
          })
          setInvoice(data.createWalletInvoice)
        }}
      >
        <div className={styles.walletActionFields}>
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
          <InvoiceDescriptionInput />
        </div>
        <div className={styles.walletActionFooter}>
          <Link href={`/wallets/${wallet.id}`} className={styles.walletFooterBackButton}>
            back
          </Link>
          <SubmitButton variant='primary' className={styles.walletActionSubmit}>
            make invoice
          </SubmitButton>
        </div>
      </Form>
      {invoice && (
        <div className={styles.walletActionResult}>
          <Qr
            value={invoice.bolt11}
            qrTransform={value => `lightning:${value.toUpperCase()}`}
            description={numWithUnits(msatsToSats(invoice.msats), { abbreviate: false })}
          />
          <InvoiceDetails invoice={invoice} />
        </div>
      )}
    </WalletActionShell>
  )
}

function InvoiceDetails ({ invoice }) {
  if (!invoice.hash && !invoice.description) return null

  return (
    <details className={styles.walletActionDetails}>
      <summary>invoice details</summary>
      <div className={styles.walletActionDetailsBody}>
        {invoice.hash && (
          <>
            <div>hash</div>
            <CopyInput
              size='sm'
              groupClassName='w-100 mb-0'
              readOnly
              noForm
              placeholder={invoice.hash}
            />
          </>
        )}
        {invoice.description && (
          <>
            <div>memo</div>
            <CopyInput
              size='sm'
              groupClassName='w-100 mb-0'
              readOnly
              noForm
              placeholder={invoice.description}
            />
          </>
        )}
      </div>
    </details>
  )
}

function InvoiceDescriptionInput () {
  const { values } = useFormikContext()
  const innerRef = useRef(null)
  const bytes = invoiceDescriptionBytes(values.description)
  const remaining = MAX_INVOICE_DESCRIPTION_LENGTH - bytes
  const resize = useCallback(() => {
    const el = innerRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [])

  useEffect(() => {
    resize()
  }, [resize, values.description])

  return (
    <Input
      label='memo'
      name='description'
      as='textarea'
      rows={3}
      innerRef={innerRef}
      hint={
        <span className={remaining < 0 ? 'text-danger' : 'text-muted'}>
          {remaining < 0
            ? 'description is too long'
            : `${remaining} memo space remaining`}
        </span>
      }
      onChange={() => window.requestAnimationFrame(resize)}
    />
  )
}

function invoiceDescriptionBytes (description) {
  return new TextEncoder().encode(description || '').length
}

function WalletActionShell ({ wallet, title, children }) {
  return (
    <WalletShell noSidebar>
      <main className={styles.walletMain}>
        <div className={styles.walletActionPage}>
          <div className={styles.walletActionBody}>
            <div className={styles.walletActionHeading}>
              <h1>{title}</h1>
              <div className={styles.walletActionWallet}>
                <WalletLayoutImageOrName name={wallet.name} maxHeight='18px' />
              </div>
            </div>
            {children}
          </div>
        </div>
      </main>
    </WalletShell>
  )
}
