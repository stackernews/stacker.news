import models from '../../../api/models'
import slackClient from '../../../api/slack'

const channelId = process.env.SLACK_CHANNEL_ID

const toKV = (obj) => {
  return obj ? Object.entries(obj).reduce((text, [k, v]) => text + ` ${k}=${v}`, '').trimStart() : '-'
}

const slackPostMessage = ({ id, level, name, message, env, context }) => {
  const text = `\`${new Date().toISOString()}\` | \`${id} [${level}] ${name}\` | ${message} | ${toKV(context)} | ${toKV({ os: env.os })}`
  return slackClient.chat.postMessage({ channel: channelId, text })
}

export default async (req, res) => {
  const { level, name, message, env, context } = req.body
  if (!name) return res.status(400).json({ status: 400, message: 'name required' })
  if (!message) return res.status(400).json({ status: 400, message: 'message required' })

  const { id } = await models.log.create({ data: { level: level.toUpperCase(), name, message, env, context } })

  if (slackClient) slackPostMessage({ id, ...req.body }).catch(console.error)

  return res.status(200).json({ status: 200, message: 'ok' })
}
