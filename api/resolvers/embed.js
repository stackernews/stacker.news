import jsdom from 'jsdom'
import crypto from 'crypto'
import { EMBED_META_CACHE_DURATION_S } from '@/lib/constants'
import { youtubeClipMetaFetchArgsSchema, validateSchema } from '@/lib/validate'

export default {
  Query: {
    fetchEmbedMeta: async (parent, { provider, args }, { models, me }) => {
      const hash = crypto.createHash('sha256').update(JSON.stringify({ provider, args })).digest('hex')

      let meta = (await models.embedMeta.findUnique({
        where: { hash }
      }))?.meta

      if (meta?.updatedAt && (Date.now() - meta.updatedAt.getTime()) / 1000 > EMBED_META_CACHE_DURATION_S) {
        meta = null
      }

      if (!meta) {
        if (provider === 'youtube-clip') {
          const { clipId } = args
          await validateSchema(youtubeClipMetaFetchArgsSchema, args)
          const fullUrl = `https://www.youtube.com/clip/${clipId}`
          const html = await fetch(fullUrl).then(res => res.text())
          const dom = new jsdom.JSDOM(html)
          const metaProp = dom.window.document.querySelector('meta[property="og:video:url"]')
          if (metaProp) {
            const content = metaProp.getAttribute('content')
            const clipId = content.match(/clip=([^&]+)/)[1]
            const videoId = content.match(/embed\/([^?]+)/)[1]
            const clipt = content.match(/clipt=([^&]+)/)[1]
            meta = {
              clipId,
              clipt,
              videoId
            }
          }
        }
        await models.embedMeta.upsert({
          where: { hash },
          create: { hash, meta },
          update: { meta }
        })
      }
      return meta
    }
  }
}
