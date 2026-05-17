import { getDomainBranding } from '@/lib/domains'
import { PUBLIC_MEDIA_URL } from '@/lib/constants'
import { getRequestOrigin } from '@/lib/safe-url'
import { truncateString } from '@/lib/format'

const black = '#121214'
const yellow = '#FADA5E'

const defaultManifest = {
  name: 'Stacker News',
  short_name: 'SN',
  icons: [
    {
      src: '/icons/icon_x48.png',
      type: 'image/png',
      sizes: '48x48',
      purpose: 'any'
    },
    {
      src: '/icons/icon_x72.png',
      type: 'image/png',
      sizes: '72x72',
      purpose: 'any'
    },
    {
      src: '/icons/icon_x96.png',
      type: 'image/png',
      sizes: '96x96',
      purpose: 'any'
    },
    {
      src: '/icons/icon_x128.png',
      type: 'image/png',
      sizes: '128x128',
      purpose: 'any'
    },
    {
      src: '/icons/icon_x192.png',
      type: 'image/png',
      sizes: '192x192',
      purpose: 'any'
    },
    {
      src: '/icons/icon_x384.png',
      type: 'image/png',
      sizes: '384x384',
      purpose: 'any'
    },
    {
      src: '/icons/icon_x512.png',
      type: 'image/png',
      sizes: '512x512',
      purpose: 'any'
    },
    {
      src: '/maskable/icon_x48.png',
      type: 'image/png',
      sizes: '48x48',
      purpose: 'maskable'
    },
    {
      src: '/maskable/icon_x72.png',
      type: 'image/png',
      sizes: '72x72',
      purpose: 'maskable'
    },
    {
      src: '/maskable/icon_x96.png',
      type: 'image/png',
      sizes: '96x96',
      purpose: 'maskable'
    },
    {
      src: '/maskable/icon_x128.png',
      type: 'image/png',
      sizes: '128x128',
      purpose: 'maskable'
    },
    {
      src: '/maskable/icon_x192.png',
      type: 'image/png',
      sizes: '192x192',
      purpose: 'maskable'
    },
    {
      src: '/maskable/icon_x384.png',
      type: 'image/png',
      sizes: '384x384',
      purpose: 'maskable'
    },
    {
      src: '/maskable/icon_x512.png',
      type: 'image/png',
      sizes: '512x512',
      purpose: 'maskable'
    }
  ],
  display: 'standalone',
  theme_color: black,
  background_color: yellow,
  id: '/',
  start_url: '/',
  url_handlers: [
    {
      origin: 'https://stacker.news'
    }
  ],
  share_target: {
    action: '/share',
    method: 'GET',
    enctype: 'application/x-www-form-urlencoded',
    params: {
      title: 'title',
      text: 'text',
      url: 'url'
    }
  },
  description: 'moderating forums with money',
  categories: ['news', 'bitcoin', 'lightning', 'zaps', 'community'],
  screenshots: [
    {
      src: '/shot/narrow.png',
      type: 'image/jpeg',
      sizes: '1080x1440',
      form_factor: 'narrow'
    },
    {
      src: '/shot/wide.png',
      type: 'image/jpeg',
      sizes: '2048x1186',
      form_factor: 'wide'
    }
  ]
}

// merges branding over defaults; only present fields override, so partial branding is safe
const getManifest = (colorScheme, branding, origin) => {
  const isDark = colorScheme?.toLowerCase() === 'dark'
  const { seo, theme } = branding ?? {}
  const faviconUrl = seo?.faviconId ? `${PUBLIC_MEDIA_URL}/${seo.faviconId}` : null

  return {
    ...defaultManifest,
    ...(isDark && { background_color: black }),
    ...(seo?.title && { name: seo.title, short_name: truncateString(seo.title, 12, '') }),
    ...(seo?.tagline && { description: seo.tagline }),
    ...(theme?.primaryColor && { background_color: theme.primaryColor }),
    ...(faviconUrl && {
      icons: [{ src: faviconUrl, sizes: 'any', purpose: 'any' }]
    }),
    // re-scope the PWA to the custom domain
    ...(origin && {
      url_handlers: [{ origin }],
      // TODO REVIEW: this doesn't work, capture service cannot grab external domains
      screenshots: [{
        src: `https://capture.stacker.news/${origin}`,
        type: 'image/png',
        form_factor: 'wide'
      }]
    })
  }
}

const handler = async (req, res) => {
  // Only GET requests allowed on this endpoint
  if (req.method !== 'GET') {
    res.status(405).end()
    return
  }
  const PREFERS_COLOR_SCHEMA_HEADER = 'Sec-CH-Prefers-Color-Scheme'
  // This endpoint wants to know the preferred color scheme
  res.setHeader('Accept-CH', PREFERS_COLOR_SCHEMA_HEADER)
  // The response of this endpoint will vary based on the color scheme
  res.setHeader('Vary', PREFERS_COLOR_SCHEMA_HEADER)
  // Ensure the header is sent in the request - forces user agent to reissue the request if it wasn't sent
  res.setHeader('Critical-CH', PREFERS_COLOR_SCHEMA_HEADER)

  const colorScheme = req.headers[PREFERS_COLOR_SCHEMA_HEADER.toLowerCase()]

  const host = req?.headers?.host
  let domainBranding = null
  if (host) {
    try {
      domainBranding = await getDomainBranding(host)
    } catch (error) {
      console.error('[pwa webmanifest] error getting domain branding', error)
      domainBranding = null
    }
  }

  // only trust the request origin when we resolved a custom-domain branding;
  // mirrors the pattern in lib/rss.js so the main site keeps its canonical URL
  const origin = (domainBranding && getRequestOrigin(req)) ?? null

  res.status(200).json(getManifest(colorScheme, domainBranding, origin))
}

export default handler
