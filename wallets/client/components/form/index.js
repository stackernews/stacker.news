import { useCallback, useMemo } from 'react'
import classNames from 'classnames'
import sharedStyles from '@/wallets/client/components/wallet.module.css'
import configureStyles from './configure.module.css'
import { Form } from '@/components/form'
import { useFormikContext } from 'formik'
import { isTemplate, protocolKey } from '@/wallets/lib/util'
import { WalletGuide } from '../layout'
import { WalletDeleteObstacle, WalletSaveDeleteObstacle } from './wallet-delete'
import { useWalletSupport, useSingleFlight } from '@/wallets/client/hooks'
import ArrowUpRight from '@/svgs/arrow-right-up-line.svg'
import ArrowDownLeft from '@/svgs/arrow-left-down-line.svg'
import { WalletBottomBar } from '@/wallets/client/components/bottom-bar'
import TrashIcon from '@/svgs/delete-bin-line.svg'
import { WalletConfigureFormProvider, useWallet, useConfigureProtocols, useSaveSummary } from './hooks/context'
import { useNwcLightningAddressBridge } from './hooks/lightning-address-bridge'
import { useProtocolSelection } from './hooks/selection'
import { useSaveWallet } from './hooks/save-wallet'
import { initialDrafts } from './hooks/draft'
import { CapabilityCard } from './capability-card'
import { useToast } from '@/components/toast'
import { useShowModal } from '@/components/modal'
import { useRouter } from 'next/router'
import { WalletStaleConfigError } from '@/wallets/client/errors'
const styles = { ...sharedStyles, ...configureStyles }

export function WalletConfigureForm ({ wallet }) {
  return (
    <WalletConfigureFormProvider wallet={wallet}>
      <WalletConfigureFormBody />
    </WalletConfigureFormProvider>
  )
}

function WalletConfigureFormBody () {
  const protocols = useConfigureProtocols()
  // One form for the whole screen: a draft per visible protocol so switching
  // connection keeps each method's draft.
  const initial = useMemo(() => initialDrafts(protocols.allProtocols), [protocols.allProtocols])

  // No global schema: fields validate themselves (protocol-fields.js) and the
  // test button validates a whole draft via validateCapability.
  return (
    <Form initial={initial} className={styles.page}>
      <WalletConfigureFormLayout protocols={protocols} />
    </Form>
  )
}

function WalletConfigureFormLayout ({ protocols }) {
  const { primarySendProtocols, fallbackSendProtocols, sharedProtocolNames, receiveProtocols, allProtocols } = protocols
  const wallet = useWallet()
  const support = useWalletSupport(wallet)
  const formik = useFormikContext()
  const saveWallet = useSaveWallet()
  const toaster = useToast()
  const router = useRouter()
  const showModal = useShowModal()
  const selection = useProtocolSelection({ sendProtocols: primarySendProtocols, receiveProtocols, sharedNames: sharedProtocolNames })
  const onNwcLud16 = useNwcLightningAddressBridge({ receiveProtocols, forceReceiveLnAddr: selection.forceReceiveLnAddr })

  const saveState = useSaveSummary(allProtocols)
  const canSave = saveState.canSave

  const onSaveWalletSubmit = useCallback(async () => {
    if (!canSave) return false
    let walletId
    try {
      walletId = await saveWallet(formik.values, allProtocols)
      toaster.success('wallet saved')
    } catch (err) {
      console.error(err)
      toaster.danger(err instanceof WalletStaleConfigError ? err.message : 'failed to save wallet')
      return false
    }

    try {
      await router.push(walletId && !saveState.willDeleteWallet ? `/wallets/${walletId}` : '/wallets')
    } catch {
      // cancelled/aborted navigation; the save already succeeded
    }
    return true
  }, [canSave, saveState.willDeleteWallet, saveWallet, formik.values, allProtocols, toaster, router])

  const [onSave, inFlight] = useSingleFlight(onSaveWalletSubmit)

  const onSaveClick = useCallback(() => {
    if (!canSave) return
    if (saveState.willDeleteWallet) {
      showModal(onClose => (
        <WalletSaveDeleteObstacle onClose={onClose} onConfirm={onSave} />
      ))
      return
    }
    onSave()
  }, [canSave, saveState.willDeleteWallet, onSave, showModal])

  return (
    <>
      <main className={styles.main}>
        <div className={styles.formStack}>
          {support.send && primarySendProtocols.length > 0 && (
            <CapabilityCard
              title='send capability'
              subtitle='wallet payments'
              icon={<ArrowUpRight width={16} height={16} />}
              tone='send'
              protocols={primarySendProtocols}
              selection={selection.send}
              onNwcLud16={onNwcLud16}
            />
          )}

          {support.receive && receiveProtocols.length > 0 && (
            <CapabilityCard
              title='receive capability'
              subtitle='invoice creation'
              icon={<ArrowDownLeft width={16} height={16} />}
              tone='receive'
              protocols={receiveProtocols}
              selection={selection.receive}
            />
          )}

          {fallbackSendProtocols.map(protocol => (
            <CapabilityCard
              key={protocolKey(protocol)}
              title='WebLN fallback'
              subtitle='optional browser support'
              protocols={[protocol]}
              tone='fallback'
              optional
            />
          ))}
        </div>
        {!isTemplate(wallet) && <WalletConfigureDangerZone wallet={wallet} />}
      </main>

      <aside className={classNames(styles.aside, 'd-flex flex-column gap-3')}>
        <div className={classNames(styles.asideCard, 'd-flex flex-column')}>
          <p className='text-muted mb-0'>
            Set up this wallet&apos;s capabilities, then test them before saving.
          </p>
          <WalletGuide name={wallet.name} />
        </div>
        <div className={classNames(styles.asideCard, 'd-flex flex-column')}>
          <div className='fw-bold'>save status</div>
          <p className='text-muted mb-0'>
            {saveState.saveStatus}
          </p>
        </div>
      </aside>

      <WalletBottomBar className={styles.saveBar}>
        {!canSave
          ? <div className={styles.saveBlocker}>{saveState.blocker}</div>
          : (
            <>
              {saveState.willDeleteWallet && <div className={styles.saveBlocker}>{saveState.saveStatus}</div>}
              <button
                type='button'
                className={classNames('btn btn-primary fw-bold', styles.saveButton, inFlight && 'pulse')}
                disabled={inFlight}
                onClick={onSaveClick}
              >
                {inFlight ? 'saving wallet...' : saveState.saveButtonLabel}
              </button>
            </>
            )}
      </WalletBottomBar>
    </>
  )
}

function WalletConfigureDangerZone ({ wallet }) {
  const showModal = useShowModal()
  const router = useRouter()

  return (
    <section className={styles.dangerZone}>
      <div>
        <h2 className='m-0 text-danger fs-5'>danger zone</h2>
        <p>Delete this wallet and its saved send/receive configuration.</p>
      </div>
      <button
        type='button'
        className={classNames(styles.textButton, styles.dangerTextButton, styles.deleteButton)}
        onClick={() => showModal(onClose => (
          <WalletDeleteObstacle wallet={wallet} onClose={onClose} onSuccess={() => router.push('/wallets')} />
        ))}
      >
        <TrashIcon width={16} height={16} /> delete wallet
      </button>
    </section>
  )
}
