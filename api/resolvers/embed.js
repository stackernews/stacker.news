import jsdom from 'jsdom'

export default {
  Query: {
    fetchEmbedMeta: async (parent, { source }, { models, me }) => {
      const { hostname, pathname } = new URL(source)
      if (hostname.endsWith('youtube.com') && pathname.includes('/clip')) {
        const html = await fetch(source).then(res => res.text())
        const dom = new jsdom.JSDOM(html)
        const meta = dom.window.document.querySelector('meta[property="og:video:url"]')
        if (meta) {
          const content = meta.getAttribute('content')
          const clipId = content.match(/clip=([^&]+)/)[1]
          const videoId = content.match(/embed\/([^?]+)/)[1]
          const clipt = content.match(/clipt=([^&]+)/)[1]
          return {
            clipId,
            clipt,
            videoId
          }
        }
      }
      return {}
    }
  }
}
