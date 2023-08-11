export default function handler (req, res) {
  return res.status(200).json({
    web_apps: [{
      manifest: 'https://stacker.news/api/site.webmanifest',
      details: {
        paths: ['*'],
        exclude_paths: []
      }
    }]
  })
}
