import { CashuMint, CashuWallet } from '@cashu/cashu-ts'
import dynamic from 'next/dynamic'
import { Mutex } from 'async-mutex'

const mutex = new Mutex()
const Balance = dynamic(() => import('@/wallets/cashu/components/balance'))
const Deposit = dynamic(() => import('@/wallets/cashu/components/deposit'))
const Withdraw = dynamic(() => import('@/wallets/cashu/components/withdraw'))
const CashuProvider = dynamic(() => import('@/wallets/cashu/components/context').then(mod => mod.CashuProvider))

export * from '@/wallets/cashu/index'

export async function testSendPayment ({ mintUrl }, { logger, signal }) {
  const mint = new CashuMint(mintUrl)
  const wallet = new CashuWallet(mint)
  try {
    await wallet.loadMint()
  } catch (err) {
    throw new Error('failed to load mint info: ' + err.message)
  }
  const info = await mint.getInfo()
  logger.info(`connected to ${info.name} running ${info.version}`)
}

export async function sendPayment (bolt11, config, { cashu: { proofs, setProofs }, logger, signal }) {
  const { mintUrl } = config
  const mint = new CashuMint(mintUrl)
  const wallet = new CashuWallet(mint)
  await wallet.loadMint()

  // run this in a mutex such that multiple in-flight payments
  // don't overwrite each other's call to store the new set of proofs
  return mutex.runExclusive(async () => {
    const quote = await wallet.createMeltQuote(bolt11)

    const amountToSend = quote.amount + quote.fee_reserve
    const { keep, send } = await wallet.send(amountToSend, proofs.current, { includeFees: true })
    const meltProof = await wallet.meltProofs(quote, send)

    const newProofs = [...keep, ...meltProof.change]
    await setProofs(newProofs)

    return meltProof.quote.payment_preimage
  })
}

export const components = [Balance, Deposit, Withdraw]

export { CashuProvider }
