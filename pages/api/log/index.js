import models from '../../../api/models'

const slackApiUrl = 'https://slack.com/api'
const botToken = process.env.SLACK_BOT_TOKEN
const channelId = process.env.SLACK_CHANNEL_ID

const slackPostMessage = ({ id, level, name, message, env, context }) => {
  let text = `${new Date().toISOString()} | ${id} [${level}] ${name} | ${message}`
  if (context) {
    text += `\n${JSON.stringify(context)}`
  }
  if (env) {
    text += `\n${JSON.stringify(env)}`
  }
  return fetch(slackApiUrl + '/chat.postMessage', {
    method: 'post',
    headers: {
      Authorization: `Bearer ${botToken}`,
      'Content-type': 'application/json'
    },
    body: JSON.stringify({ channel: channelId, text })
  })
}

export default async (req, res) => {
  const { level, name, message, env, context } = req.body
  if (!name) return res.status(400).json({ status: 400, message: 'name required' })
  if (!message) return res.status(400).json({ status: 400, message: 'message required' })

  const { id } = await models.log.create({ data: { level: level.toUpperCase(), name, message, env, context } })

  if (botToken && channelId) {
    slackPostMessage({ id, ...req.body })
  }
  return res.status(200).json({ status: 200, message: 'ok' })
}
