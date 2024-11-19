import models from '@/api/models'

export default async ({ query: { hash } }, res) => {
  try {
    const inv = await models.invoice.findUnique({ where: { hash } })
    if (!inv) {
      return res.status(404).json({ status: 'ERROR', reason: 'not found' })
    }
    const settled = !!inv.confirmedAt
    return res.status(200).json({
      status: 'OK',
      settled,
      preimage: settled ? inv.preimage : null,
      pr: inv.bolt11
    })
  } catch (err) {
    console.log('error', err)
    return res.status(500).json({ status: 'ERROR', reason: 'internal server error' })
  }
}
