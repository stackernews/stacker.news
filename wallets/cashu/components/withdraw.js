import { Form, Input, SubmitButton } from '@/components/form'
import { useMe } from '@/components/me'
import { useShowModal } from '@/components/modal'
import { withdrawlSchema } from '@/lib/validate'
import { InvoiceScanner } from '@/pages/withdraw'
import { useWalletLogger } from '@/wallets/logger'
import { CashuMint, CashuWallet } from '@cashu/cashu-ts'
import { useCallback, useState } from 'react'
import { Button, InputGroup } from 'react-bootstrap'
import { useCashuProofs } from './context'
import { numWithUnits } from '@/lib/format'
import { useToast } from '@/components/toast'

export default function Withdraw ({ wallet }) {
  const logger = useWalletLogger(wallet)
  const showModal = useShowModal()
  const { mintUrl } = wallet.config
  const [mint] = useState(new CashuMint(mintUrl))
  const [cashu] = useState(new CashuWallet(mint))
  const { me } = useMe()
  const maxFeeDefault = me?.privates?.withdrawMaxFeeDefault
  const { proofs, setProofs } = useCashuProofs()
  const toaster = useToast()

  const onSubmit = useCallback(async ({ invoice, maxFee, onClose }) => {
    let meltQuote
    try {
      await cashu.loadMint()

      meltQuote = await cashu.createMeltQuote(invoice)
      if (maxFee < meltQuote.fee_reserve) {
        throw new Error(`max fee must be at least ${numWithUnits(meltQuote.fee_reserve, { abbreviate: false })}`)
      }
      const amt = numWithUnits(meltQuote.amount, { abbreviate: false })
      logger.info(`created melt invoice for ${amt}`, {
        quote: meltQuote.quote,
        fee_reserve: numWithUnits(meltQuote.fee_reserve, { abbreviate: false }),
        max_fee: numWithUnits(maxFee, { abbreviate: false })
      })

      const amountToSend = meltQuote.amount + maxFee
      const { keep, send } = await cashu.send(amountToSend, proofs.current, { includeFees: true })
      const meltProof = await cashu.meltProofs(meltQuote, send)

      const fees = maxFee - meltProof.change.reduce((acc, change) => acc + change.amount, 0)
      logger.ok(`melted ${amt} of tokens`, { quote: meltQuote.quote, fee: numWithUnits(fees, { abbreviate: false }) })

      const newProofs = [...keep, ...meltProof.change]
      await setProofs(newProofs)

      onClose()
      return meltProof.quote.payment_preimage
    } catch (err) {
      logger.error('withdrawal failed: ' + err.message, meltQuote)
      toaster.danger('withdrawal failed')
    }
  }, [logger, cashu, setProofs, toaster])

  // TODO: also support withdrawing to lightning address
  const onClick = () => showModal(onClose => {
    return (
      <Form
        autoComplete='off'
        initial={{
          invoice: '',
          maxFee: maxFeeDefault
        }}
        schema={withdrawlSchema}
        onSubmit={async ({ invoice, maxFee }) => {
          await onSubmit({ invoice, maxFee, onClose })
        }}
      >
        <Input
          label='invoice'
          name='invoice'
          required
          autoFocus
          clear
          append={<InvoiceScanner fieldName='invoice' />}
        />
        <Input
          label='max fee'
          name='maxFee'
          required
          append={<InputGroup.Text className='text-monospace'>sats</InputGroup.Text>}
        />
        <div className='d-flex justify-content-end mt-4'>
          <SubmitButton variant='success'>withdraw</SubmitButton>
        </div>
      </Form>
    )
  })

  return (
    <Button onClick={onClick}>withdraw</Button>
  )
}
