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
  orientation: 'any',
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
  description: 'Stacker News is like Hacker News but it pays you Bitcoin',
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

const getManifest = (colorScheme) => {
  if (colorScheme?.toLowerCase() === 'dark') {
    return {
      ...defaultManifest,
      background_color: black
    }
  }
  return defaultManifest
}

const handler = (req, res) => {
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
  res.status(200).json(getManifest(colorScheme))
}

export default handler
