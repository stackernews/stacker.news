export function payInPrismaCreate (payIn) {
  const result = {}

  if (payIn.beneficiaries) {
    payIn.beneficiaries = payIn.beneficiaries.map(beneficiary => {
      if (beneficiary.payOutBolt11) {
        throw new Error('Beneficiary payOutBolt11 not supported')
      }
      if (beneficiary.beneficiaries) {
        throw new Error('Beneficiary beneficiaries not supported')
      }
      return {
        ...beneficiary,
        payInState: payIn.payInState,
        payInStateChangedAt: payIn.payInStateChangedAt
      }
    })
  }

  // for each key in payIn, if the value is an object, recursively call payInPrismaCreate on the value
  // if the value is an array, recursively call payInPrismaCreate on each element of the array
  // if the value is not an object or array, add the key and value to the result
  for (const key in payIn) {
    if (typeof payIn[key] === 'object') {
      result[key] = { create: payInPrismaCreate(payIn[key]) }
    } else if (Array.isArray(payIn[key])) {
      result[key] = { create: payIn[key].map(item => payInPrismaCreate(item)) }
    } else if (payIn[key] !== undefined) {
      result[key] = payIn[key]
    }
  }

  return result
}
