import Pageres from 'pageres'
import path from 'path'

export default async function handler (req, res) {
  const url = process.env.SELF_URL + '/' + path.join(...(req.query.path || []))
  res.setHeader('Content-Type', 'image/png')
  try {
    const streams = await new Pageres({ crop: true })
    .src(url, ['600x300'])
    .run()
    res.status(200).end(streams[0])
  } catch(e) {
    console.log(e)
    res.status(500)
  }
}
