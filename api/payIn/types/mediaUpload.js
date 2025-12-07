import { PAID_ACTION_PAYMENT_METHODS } from '@/lib/constants'
import { getRedistributedPayOutCustodialTokens } from '../lib/payOutCustodialTokens'
import { throwOnExpiredUploads, uploadFees } from '@/api/resolvers/upload'

// currently, media upload is only ever a beneficiary of other payIns

export const anonable = false

export const paymentMethods = [
  PAID_ACTION_PAYMENT_METHODS.FEE_CREDIT,
  PAID_ACTION_PAYMENT_METHODS.REWARD_SATS,
  PAID_ACTION_PAYMENT_METHODS.PESSIMISTIC
]

export async function getInitial (models, { uploadIds }, { me, sub }) {
  await throwOnExpiredUploads(uploadIds, { tx: models })

  const { totalFeesMsats } = await uploadFees(uploadIds, { models, me })

  const mcost = totalFeesMsats
  const payOutCustodialTokens = getRedistributedPayOutCustodialTokens({ sub, mcost })

  return {
    payInType: 'MEDIA_UPLOAD',
    userId: me?.id,
    mcost,
    payOutCustodialTokens,
    uploadPayIns: uploadIds.map(id => ({ uploadId: id }))
  }
}

export async function onBegin (tx, payInId, { uploadIds }, benefactorResult) {
  // associate this payIns with the same rows as the benefactor
  const { benefactor } = await tx.payIn.findUnique({
    where: { id: payInId },
    include: { benefactor: { include: { itemPayIn: true, subPayIn: true } } }
  })
  if (benefactor.itemPayIn) {
    await tx.itemPayIn.create({ data: { itemId: benefactor.itemPayIn.itemId, payInId } })
  }
  if (benefactor.subPayIn) {
    await tx.subPayIn.create({ data: { subName: benefactor.subPayIn.subName, payInId } })
  }
}

export async function onPaid (tx, payInId) {
  await tx.$executeRaw`
    UPDATE "Upload"
    SET "paid" = true
    FROM "UploadPayIn"
    WHERE "UploadPayIn"."payInId" = ${payInId}
      AND "Upload"."id" = "UploadPayIn"."uploadId"`
}
