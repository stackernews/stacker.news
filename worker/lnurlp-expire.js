import { datePivot } from '../lib/time.js'

export function lnurlpExpire ({ models }) {
  setInterval(async () => {
    try {
      const { count } = await models.lnUrlpRequest.deleteMany({
        where: {
          createdAt: {
            // clear out any requests that are older than 30 minutes
            lt: datePivot(new Date(), { minutes: -30 })
          }
        }
      })
      console.log(`deleted ${count} lnurlp requests`)
    } catch (err) {
      console.error('error occurred deleting lnurlp requests', err)
    }
  }, 1000 * 60) // execute once per minute
}
