import { parsePaymentRequest } from 'ln-service'
import { PAY_IN_RECEIVER_FAILURE_REASONS } from './is'
import walletDefs, { createUserInvoice } from '@/wallets/server'
import { Prisma } from '@prisma/client'
import { canReceive } from '@/wallets/common'

async function getLeastFailedWallet (models, { genesisId, userId }) {
  const leastFailedWallets = await models.$queryRaw`
    WITH "failedWallets" AS (
      SELECT count(*) as "failedCount", "PayOutBolt11"."walletId"
      FROM "PayIn"
      JOIN "PayOutBolt11" ON "PayOutBolt11"."payInId" = "PayIn"."id"
      WHERE "PayIn"."payInFailureReason" IS NOT NULL AND "PayIn"."genesisId" = ${genesisId}
      AND "PayOutBolt11"."payInFailureReason" IN (${Prisma.join(PAY_IN_RECEIVER_FAILURE_REASONS)})
      GROUP BY "PayOutBolt11"."walletId"
    )
    SELECT *
    FROM "Wallet"
    LEFT JOIN "failedWallets" ON "failedWallets"."walletId" = "Wallet"."id"
    ORDER BY "failedWallets"."failedCount" ASC, "Wallet"."priority" ASC`

  const walletsWithDefs = leastFailedWallets.map(wallet => {
    const w = walletDefs.find(w => w.walletType === wallet.type)
    return { wallet, def: w }
  }).filter(({ def, wallet }) => canReceive({ def, config: wallet.wallet }))

  return walletsWithDefs.map(({ wallet }) => wallet)
}

export async function payOutBolt11Replacement (models, payIn) {
  const { payOutBolt11: { userId, msats }, genesisId } = payIn
  const wallets = await getLeastFailedWallet(models, { genesisId, userId })

  const { invoice: bolt11, wallet } = await createUserInvoice(userId, { msats, wallets }, { models })
  const invoice = await parsePaymentRequest({ request: bolt11 })

  return {
    payOutType: 'ZAP',
    msats,
    bolt11,
    hash: invoice.hash,
    userId,
    walletId: wallet.id
  }
}
