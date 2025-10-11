import { tasteMediaUrl } from '@/lib/media'

export default async function handler (req, res) {
  if (req.method !== 'GET') {
    res.status(405).end()
  }

  let { url } = req.query
  // in development, the app container can't reach the public media url,
  // so we need to replace it with its docker equivalent, e.g. http://s3:4566/uploads
  if (url.includes(process.env.NEXT_PUBLIC_MEDIA_URL) && process.env.NODE_ENV === 'development') {
    url = url.replace(process.env.NEXT_PUBLIC_MEDIA_URL, process.env.MEDIA_URL_DOCKER)
  }

  if (typeof url !== 'string' || !/^(https?:\/\/)/.test(url)) {
    res.status(400).json({ error: 'Invalid URL' })
  }

  try {
    const { mime, isImage, isVideo } = await tasteMediaUrl(url)
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300')
    res.status(200).json({ mime, isImage, isVideo })
  } catch (error) {
    res.status(500).json({ mime: null, isImage: false, isVideo: false })
  }
}
