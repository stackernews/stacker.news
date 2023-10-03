const { PrismaClient, Prisma } = require('@prisma/client')

const prisma = new PrismaClient()

const imgProxyEnabled = process.env.NODE_ENV === 'production' ||
  (process.env.NEXT_PUBLIC_IMGPROXY_URL && process.env.IMGPROXY_SALT && process.env.IMGPROXY_KEY)

if (!imgProxyEnabled) {
  console.warn('IMGPROXY_* env vars must be set')
  process.exit(1)
}

// queue size determines how many items can be processed at the same time.
// this is roughly equivalent to how many requests should be in flight.
// if queue is too large, we might run out of memory and too many requests fail due to timeouts.
const MAX_QUEUE = 1000

async function main () {
  const { createImgproxyUrls } = await import('../worker/imgproxy.js')
  let cursor = 1
  try {
    while (true) {
      const r = await prisma.item.findMany({
        take: MAX_QUEUE,
        skip: 1, // Skip the cursor
        cursor: {
          id: cursor
        },
        where: {
          imgproxyUrls: {
            equals: Prisma.AnyNull
          }
        },
        orderBy: {
          id: 'asc'
        }
      })

      if (r.length === 0) {
        break
      }

      cursor = r[r.length - 1].id

      for (const { id, ...item } of r) {
        const isJob = typeof item.maxBid !== 'undefined'

        let imgproxyUrls = {}
        try {
          if (item.text) {
            imgproxyUrls = await createImgproxyUrls(id, item.text, {})
          }
          if (item.url && !isJob) {
            imgproxyUrls = { ...imgproxyUrls, ...(await createImgproxyUrls(id, item.url, {})) }
          }
        } catch (err) {
          console.log('[imgproxy] error:', err)
          // rethrow for retry
          throw err
        }

        console.log('[imgproxy] updating item', id, 'with urls', imgproxyUrls)

        await prisma.item.update({ where: { id }, data: { imgproxyUrls } })
      }
    }
  } catch (err) {
    console.error(err)
  }
}

main()
