import { WebClient, LogLevel } from '@slack/web-api'

const slackClient = global.slackClient || (() => {
  if (!process.env.SLACK_BOT_TOKEN && !process.env.SLACK_CHANNEL_ID) {
    console.warn('SLACK_* env vars not set, skipping slack setup')
    return null
  }
  console.log('initing slack client')
  const client = new WebClient(process.env.SLACK_BOT_TOKEN, {
    logLevel: LogLevel.INFO
  })
  return client
})()

if (process.env.NODE_ENV === 'development') global.slackClient = slackClient

export default slackClient
