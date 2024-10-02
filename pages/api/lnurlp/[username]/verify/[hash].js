export default async ({ query: { hash }, models }, res) => {
  try {
    const inv = await models.invoice.findUnique({ where: { hash } })
    const settled = inv.confirmedAt
    return res.status(200).json({ status: 'OK', settled, preimage: settled ? inv.preimage : null, pr: inv.bolt11 })
  } catch (err) {
    if (err[1] === 'UnexpectedLookupInvoiceErr') {
      return res.status(404).json({ status: 'ERROR', reason: 'not found' })
    }
    return res.status(500).json({ status: 'ERROR', reason: 'internal server error' })
  }
}
