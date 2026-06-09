import { Prisma } from '@prisma/client'

export function payInTypesSql (types) {
  return Prisma.join(types.map(type => Prisma.sql`${type}::"PayInType"`))
}

export function payInFailureReasonsSql (reasons) {
  return Prisma.join(reasons.map(reason => Prisma.sql`${reason}::"PayInFailureReason"`))
}
