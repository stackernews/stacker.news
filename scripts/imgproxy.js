const events = require('events')
const path = require('path')
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

const imgProxyEnabled = process.env.NODE_ENV === 'production' ||
  (process.env.NEXT_PUBLIC_IMGPROXY_URL && process.env.IMGPROXY_SALT && process.env.IMGPROXY_KEY)

if (!imgProxyEnabled) {
  console.warn('IMGPROXY_* env vars must be set')
  process.exit(1)
}

function usage () {
  const scriptName = path.basename(process.argv[1])
  console.log(`Usage: ${scriptName} <TABLE>`)
  console.log('Parses links from "text" and "url" TEXT columns of table <TABLE> and populates the "imgproxyUrls" JSONB column.')
}

// queue size determines how many items can be processed at the same time.
// this is roughly equivalent to how many requests should be in flight.
// if queue is too large, we might run out of memory and too many requests fail due to timeouts.
const MAX_QUEUE = 1000
// interval in milliseconds to poll for queue status
const QUEUE_POLL = 250
let queued = 0
const queue = new events.EventEmitter()

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

async function main (tableName) {
  const { createImgproxyUrls } = await import('../worker/imgproxy.js')
  try {
    // loads all items into memory - not efficient but this script only needs to be run once
    const r = await prisma.$queryRawUnsafe(`SELECT * FROM "${tableName}" WHERE "imgproxyUrls" IS NULL`)

    queue.on('job', async ({ id, ...item }) => {
      // only process MAX_QUEUE items at once.
      // if there are already MAX_QUEUE items in the queue, wait.
      // eslint-disable-next-line no-unmodified-loop-condition
      while (queued > MAX_QUEUE) {
        await sleep(QUEUE_POLL)
      }

      queued++

      // copied from worker/imgproxy.js

      const isJob = typeof item.maxBid !== 'undefined'

      let imgproxyUrls = {}
      try {
        if (item.text) {
          imgproxyUrls = await createImgproxyUrls(item.text)
        }
        if (item.url && !isJob) {
          imgproxyUrls = { ...imgproxyUrls, ...(await createImgproxyUrls(item.url)) }
        }
      } catch (err) {
        console.log('[imgproxy] error:', err)
        // rethrow for retry
        throw err
      }

      console.log('[imgproxy] updating item', id, 'with urls', imgproxyUrls)

      await prisma.$queryRawUnsafe(`UPDATE "${tableName}" SET "imgproxyUrls" = '${JSON.stringify(imgproxyUrls, null, 0)}'::JSONB WHERE id = ${id}`)

      queued--
    })

    for (const item of r) {
      queue.emit('job', item)
    }
  } catch (err) {
    console.error(err)
  }
}

const tableName = process.argv[2]
if (!tableName) {
  usage()
  process.exit(1)
}

main(tableName)
