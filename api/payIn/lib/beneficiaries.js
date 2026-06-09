export function getBeneficiariesMcost (beneficiaries) {
  return beneficiaries?.reduce((acc, beneficiary) => acc + beneficiary.mcost, 0n) ?? 0n
}
