import { USER_ID } from '@/lib/constants'

export const anonable = true
export const supportsPessimism = true
export const supportsOptimism = false

export async function getCost ({ sats }) {
  return BigInt(sats) * BigInt(1000)
}

export async function perform ({ sats }, { me, tx }) {
  await tx.donation.create({
    data: {
      sats,
      userId: me?.id || USER_ID.anon
    }
  })

  return { sats }
}

export async function describe (args, context) {
  return 'SN: donate to rewards pool'
}
