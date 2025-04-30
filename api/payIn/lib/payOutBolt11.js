import { parsePaymentRequest } from 'ln-service'
import { PAY_IN_RECEIVER_FAILURE_REASONS } from './is'
import { createBolt11FromWallets } from '@/wallets/server'
import { Prisma } from '@prisma/client'

async function getLeastFailedWallets (models, { genesisId, userId }) {
  return await models.$queryRaw`
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
}

async function getWallets (models, { userId }) {
  return await models.wallet.findMany({
    where: {
      userId,
      enabled: true
    },
    include: {
      user: true
    }
  })
}

export async function payOutBolt11Replacement (models, genesisId, { userId, msats, payOutType }) {
  const wallets = await getLeastFailedWallets(models, { genesisId, userId })
  const { bolt11, wallet } = await createBolt11FromWallets(wallets, { msats }, { models })

  const invoice = await parsePaymentRequest({ request: bolt11 })
  return {
    payOutType,
    msats: BigInt(invoice.mtokens),
    bolt11,
    hash: invoice.hash,
    userId,
    walletId: wallet.id
  }
}

export async function payOutBolt11Prospect (models, { userId, payOutType, msats }) {
  const wallets = await getWallets(models, { userId })
  const { bolt11, wallet } = await createBolt11FromWallets(wallets, { msats }, { models })
  const invoice = await parsePaymentRequest({ request: bolt11 })
  return {
    payOutType,
    msats: BigInt(invoice.mtokens),
    bolt11,
    hash: invoice.hash,
    userId,
    walletId: wallet.id
  }
}
