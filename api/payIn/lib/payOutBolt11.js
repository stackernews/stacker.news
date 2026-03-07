import { parsePaymentRequest } from 'ln-service'
import { PAY_IN_RECEIVER_FAILURE_REASONS } from './is'
import { createBolt11FromWalletProtocols } from '@/wallets/server/receive'
import { payInFailureReasonsSql } from './sql'

// returns the least failed, highest priority wallet protocols
async function getLeastFailedWalletProtocols (models, { genesisId, userId }) {
  return await models.$queryRaw`
    WITH "failedWallets" AS (
      SELECT count(*) as "failedCount", "PayOutBolt11"."protocolId"
      FROM "PayIn"
      JOIN "PayOutBolt11" ON "PayOutBolt11"."payInId" = "PayIn"."id"
      WHERE "PayIn"."payInFailureReason" IS NOT NULL AND "PayIn"."genesisId" = ${genesisId}
      AND "PayIn"."payInFailureReason" IN (${payInFailureReasonsSql(PAY_IN_RECEIVER_FAILURE_REASONS)})
      GROUP BY "PayOutBolt11"."protocolId"
    )
    SELECT "WalletProtocol".*, "Wallet"."userId" as "userId",
      COALESCE("failedWallets"."failedCount", 0) as "failedCount"
    FROM "WalletProtocol"
    JOIN "Wallet" ON "Wallet"."id" = "WalletProtocol"."walletId"
    LEFT JOIN "failedWallets" ON "failedWallets"."protocolId" = "WalletProtocol"."id"
    WHERE "Wallet"."userId" = ${userId} AND "WalletProtocol"."enabled" = true AND "WalletProtocol"."send" = false
    ORDER BY "failedWallets"."failedCount" ASC NULLS FIRST, "Wallet"."priority" ASC`
}

async function getWalletProtocols (models, { userId }) {
  return await models.$queryRaw`
    SELECT "WalletProtocol".*, "Wallet"."userId" as "userId"
    FROM "WalletProtocol"
    JOIN "Wallet" ON "Wallet"."id" = "WalletProtocol"."walletId"
    WHERE "Wallet"."userId" = ${userId} AND "WalletProtocol"."enabled" = true AND "WalletProtocol"."send" = false
    ORDER BY "Wallet"."priority" ASC`
}

export class NoReceiveWalletError extends Error {
  constructor (message) {
    super(message)
    this.name = 'NoReceiveWalletError'
  }
}

async function createPayOutBolt11FromWalletProtocols (walletProtocols, bolt11Args, { payOutType, userId }, { models }, testBolt11) {
  for await (const { bolt11, protocol } of createBolt11FromWalletProtocols(walletProtocols, bolt11Args, { models })) {
    try {
      if (testBolt11 && !(await testBolt11(bolt11))) {
        continue
      }

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

  throw new NoReceiveWalletError('no wallet to receive available')
}

export async function payOutBolt11Replacement (models, genesisId, { payOutType, userId, msats }, testBolt11) {
  const walletProtocols = await getLeastFailedWalletProtocols(models, { genesisId, userId })
  const leastFailedWalletProtocols = walletProtocols.filter(wp => wp.failedCount < 2)
  if (leastFailedWalletProtocols.length === 0) {
    throw new NoReceiveWalletError('least failed wallet has failed at least twice, falling back to custodial tokens')
  }
  return await createPayOutBolt11FromWalletProtocols(leastFailedWalletProtocols, { msats }, { payOutType, userId }, { models }, testBolt11)
}

export async function payOutBolt11Prospect (models, bolt11Args, { payOutType, userId }, testBolt11) {
  const walletProtocols = await getWalletProtocols(models, { userId })
  return await createPayOutBolt11FromWalletProtocols(walletProtocols, bolt11Args, { payOutType, userId }, { models }, testBolt11)
}
