import { useState, useCallback, useEffect } from 'react'
import { useShowModal } from '@/components/modal'
import { CashuMint, CashuWallet } from '@cashu/cashu-ts'
import { mintQuoteSchema } from '@/lib/validate'
import { Button, InputGroup } from 'react-bootstrap'

import dynamic from 'next/dynamic'
import { useWalletLogger } from '@/wallets/logger'
import { numWithUnits } from '@/lib/format'
const Form = dynamic(() => import('@/components/form').then(mod => mod.Form))
const Input = dynamic(() => import('@/components/form').then(mod => mod.Input))
const SubmitButton = dynamic(() => import('@/components/form').then(mod => mod.SubmitButton))
const CashuQr = dynamic(() => import('@/wallets/cashu/components/qr'), { ssr: false })

export default function Deposit ({ wallet }) {
  const logger = useWalletLogger(wallet)
  const showModal = useShowModal()
  const { mintUrl } = wallet.config
  const [mint] = useState(new CashuMint(mintUrl))
  const [cashuWallet] = useState(new CashuWallet(mint))

  useEffect(() => {
    cashuWallet.loadMint()
  }, [cashuWallet])

  const onSubmit = useCallback(async ({ amount }) => {
    const mintQuote = await cashuWallet.createMintQuote(amount)
    logger.info(`created mint invoice for ${numWithUnits(amount, { abbreviate: false })}`, { quote: mintQuote.quote, request: mintQuote.request })
    showModal(onClose => {
      return (
        <CashuQr cashu={cashuWallet} wallet={wallet} mintQuote={mintQuote} amount={amount} onClose={onClose} />
      )
    })
  }, [logger, cashuWallet])

  const onClick = () => showModal(onClose => {
    return (
      <Form
        initial={{
          amount: 1000
        }}
        schema={mintQuoteSchema}
        onSubmit={onSubmit}
      >
        <Input
          label='amount'
          name='amount'
          type='number'
          step={1}
          required
          autoFocus
          append={<InputGroup.Text className='text-monospace'>sats</InputGroup.Text>}
        />
        <div className='d-flex mt-3'>
          <SubmitButton variant='success' className='ms-auto mt-1 px-4'>
            confirm
          </SubmitButton>
        </div>
      </Form>
    )
  })

  return (
    <Button onClick={onClick}>deposit</Button>
  )
}
