import Link from 'next/link'
import { Button, InputGroup } from 'react-bootstrap'
import classNames from 'classnames'
import { Form, Input, SubmitButton } from '@/components/form'
import { useShowModal } from '@/components/modal'
import { useAnimation } from '@/components/animation'
import usePayInMutation from '@/components/payIn/hooks/use-pay-in-mutation'
import PyramidButton from '@/components/pyramid-button'
import { amountSchema } from '@/lib/validate'
import { BUY_CREDITS } from '@/fragments/payIn'
import { useWalletCapabilities } from '@/wallets/client/hooks'
import sharedStyles from '@/wallets/client/components/wallet.module.css'
import actionsStyles from './actions.module.css'
import { walletDetailRoute } from '@/wallets/lib/routes'
const styles = { ...sharedStyles, ...actionsStyles }

export function WalletActions ({ entry }) {
  if (entry.kind === 'internal') {
    return <InternalWalletActions entry={entry} />
  }

  return <ExternalWalletActions wallet={entry.wallet} />
}

function InternalWalletActions ({ entry }) {
  const action = entry.action

  return (
    <div className={styles.bar}>
      {action === 'buy' && <BuyCreditsAction />}
      {action === 'send' && <WalletPyramidAction href={walletDetailRoute(entry.routeId, 'send')} label='send' tone='send' singleAction />}
    </div>
  )
}

function ExternalWalletActions ({ wallet }) {
  const { canReceive, canSend, hasConfiguredProtocols, receiveProtocol, sendProtocol } = useWalletCapabilities(wallet)
  const actionCount = Number(Boolean(receiveProtocol)) + Number(Boolean(sendProtocol))
  const singleAction = actionCount === 1
  const hasEnabledProtocol = Boolean(receiveProtocol || sendProtocol)

  if (!hasEnabledProtocol && hasConfiguredProtocols) {
    return (
      <div className={classNames(styles.bar, styles.compact)}>
        <Link href={walletDetailRoute(wallet.id, 'configure')} className={styles.textButton}>configure</Link>
      </div>
    )
  }

  return (
    <div className={styles.bar}>
      {receiveProtocol && <WalletPyramidAction href={walletDetailRoute(wallet.id, 'receive')} label='RECV' ariaLabel='receive' tone='receive' disabled={!canReceive} singleAction={singleAction} />}
      {sendProtocol && <WalletPyramidAction href={walletDetailRoute(wallet.id, 'send')} label='send' tone='send' disabled={!canSend} singleAction={singleAction} />}
      {!receiveProtocol && !sendProtocol && <Button as={Link} href={walletDetailRoute(wallet.id, 'configure')} variant='outline-secondary' className={styles.button}>configure</Button>}
    </div>
  )
}

function WalletPyramidAction ({ href, label, ariaLabel, tone, disabled, singleAction, onClick }) {
  const direction = tone === 'send' ? 'out' : 'in'
  const linkProps = href && !disabled ? { as: Link, href } : {}

  return (
    <PyramidButton
      {...linkProps}
      className={styles.button}
      label={label}
      ariaLabel={ariaLabel ?? label}
      aspect={2.8}
      layers={singleAction ? 5 : 3}
      innerWidthScale={singleAction ? 1.55 : 1}
      radius={8}
      fontSize={singleAction ? 20 : 14}
      pad={18}
      direction={direction}
      disabled={disabled}
      onClick={() => {
        onClick?.()
      }}
    />
  )
}

function BuyCreditsAction () {
  const showModal = useShowModal()
  const animate = useAnimation()
  const [buyCredits] = usePayInMutation(BUY_CREDITS)

  return (
    <WalletPyramidAction
      label='buy'
      tone='buy'
      singleAction
      onClick={() => showModal(onClose => (
        <Form
          initial={{ amount: 10000 }}
          schema={amountSchema}
          onSubmit={async ({ amount }) => {
            const { error } = await buyCredits({
              variables: {
                credits: Number(amount)
              },
              onCompleted: () => {
                animate()
              }
            })
            onClose()
            if (error) throw error
          }}
        >
          <Input
            label='amount'
            name='amount'
            type='number'
            required
            autoFocus
            append={<InputGroup.Text className='text-monospace'>sats</InputGroup.Text>}
          />
          <div className='d-flex'>
            <SubmitButton variant='secondary' className='ms-auto mt-1 px-4'>buy</SubmitButton>
          </div>
        </Form>
      ))}
    />
  )
}
