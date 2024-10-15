import models from '@/api/models'

export default async function handler (req, res) {
  const item = await models.item.findUnique({ where: { id: Number(req.query.id) } })
  if (!item || !item.otsFile) {
    res.status(404).end()
  }

  res.setHeader('Content-Type', 'application/octet-stream')
  res.setHeader('Content-Disposition', `attachment; filename="sn-item-${req.query.id}.json.ots"`)
  res.write(item.otsFile)
  res.status(200).end()
}
