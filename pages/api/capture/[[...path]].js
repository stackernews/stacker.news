import Pageres from 'pageres'
import path from 'path'

export default async function handler (req, res) {
  const url = 'http://' + path.join('localhost:3000', ...(req.query.path || []))
  res.setHeader('Content-Type', 'image/png')
  const streams = await new Pageres({ crop: true, delay: 1 })
    .src(url, ['600x300'])
    .run()
  res.status(200).end(streams[0])
}
