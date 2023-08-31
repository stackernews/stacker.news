import models from '../../../api/models'

export default async (req, res) => {
  const { level, name, message, env, context } = req.body
  if (!name) return res.status(400).json({ status: 400, message: 'name required' })
  if (!message) return res.status(400).json({ status: 400, message: 'message required' })

  await models.log.create({ data: { level: level.toUpperCase(), name, message, env, context } })

  return res.status(200).json({ status: 200, message: 'ok' })
}
