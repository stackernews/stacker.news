import models from '@/api/models'

export default async ({ query: { hash } }, res) => {
  try {
    const payInBolt11 = await models.payInBolt11.findUnique({ where: { hash } })
    if (!payInBolt11) {
      return res.status(404).json({ status: 'ERROR', reason: 'not found' })
    }
    const settled = !!payInBolt11.confirmedAt
    return res.status(200).json({
      status: 'OK',
      settled,
      preimage: settled ? payInBolt11.preimage : null,
      pr: payInBolt11.bolt11
    })
  } catch (err) {
    console.log('error', err)
    return res.status(500).json({ status: 'ERROR', reason: 'internal server error' })
  }
}
