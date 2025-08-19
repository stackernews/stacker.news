import { parsePaymentRequest } from 'ln-service'
import { PAY_IN_RECEIVER_FAILURE_REASONS } from './is'
import { createBolt11FromWalletProtocols } from '@/wallets/server/receive'
import { Prisma } from '@prisma/client'

async function getLeastFailedWalletProtocols (models, { genesisId, userId }) {
  return await models.$queryRaw`
    WITH "failedWallets" AS (
      SELECT count(*) as "failedCount", "PayOutBolt11"."protocolId"
      FROM "PayIn"
      JOIN "PayOutBolt11" ON "PayOutBolt11"."payInId" = "PayIn"."id"
      WHERE "PayIn"."payInFailureReason" IS NOT NULL AND "PayIn"."genesisId" = ${genesisId}
      AND "PayOutBolt11"."payInFailureReason" IN (${Prisma.join(PAY_IN_RECEIVER_FAILURE_REASONS)})
      GROUP BY "PayOutBolt11"."protocolId"
    )
    SELECT "WalletProtocol".*, "Wallet"."userId" as "userId"
    FROM "WalletProtocol"
    JOIN "Wallet" ON "Wallet"."id" = "WalletProtocol"."walletId"
    LEFT JOIN "failedWallets" ON "failedWallets"."protocolId" = "WalletProtocol"."id"
    WHERE "Wallet"."userId" = ${userId} AND "WalletProtocol"."enabled" = true AND "WalletProtocol"."send" = false
    ORDER BY "failedWallets"."failedCount" ASC, "Wallet"."priority" ASC`
}

async function getWalletProtocols (models, { userId }) {
  return await models.$queryRaw`
    SELECT "WalletProtocol".*, "Wallet"."userId" as "userId"
    FROM "WalletProtocol"
    JOIN "Wallet" ON "Wallet"."id" = "WalletProtocol"."walletId"
    WHERE "Wallet"."userId" = ${userId} AND "WalletProtocol"."enabled" = true AND "WalletProtocol"."send" = false
    ORDER BY "Wallet"."priority" ASC`
}

async function createPayOutBolt11FromWalletProtocols (walletProtocols, bolt11Args, { payOutType, userId }, { models }) {
  for await (const { bolt11, protocol } of createBolt11FromWalletProtocols(walletProtocols, bolt11Args, { models })) {
    try {
      const invoice = await parsePaymentRequest({ request: bolt11 })
      return {
        payOutType,
        msats: BigInt(invoice.mtokens),
        bolt11,
        hash: invoice.id,
        userId,
        protocolId: protocol.id
      }
    } catch (err) {
      console.error('failed to create pay out bolt11:', err)
    }
  }

  throw new Error('no wallet to receive available')
}

export async function payOutBolt11Replacement (models, genesisId, { payOutType, userId, msats }) {
  const walletProtocols = await getLeastFailedWalletProtocols(models, { genesisId, userId })
  return await createPayOutBolt11FromWalletProtocols(walletProtocols, { msats }, { payOutType, userId }, { models })
}

export async function payOutBolt11Prospect (models, bolt11Args, { payOutType, userId }) {
  const walletProtocols = await getWalletProtocols(models, { userId })
  return await createPayOutBolt11FromWalletProtocols(walletProtocols, bolt11Args, { payOutType, userId }, { models })
}
