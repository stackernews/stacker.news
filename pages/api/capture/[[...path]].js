import path from 'path'
const { spawn } = require('child_process')

var capturing = false

export default async function handler (req, res) {
  if (capturing) {
    return res.writeHead(503, {
      'Retry-After' : 1
    }).end()
  }

  return new Promise(resolve => {
    capturing = true
    const url = process.env.SELF_URL + '/' + path.join(...(req.query.path || []))
    res.setHeader('Content-Type', 'image/png')

    const capture = spawn(
      'node', ['./spawn/capture.js', url], {maxBuffer: 1024*1024*5})

    capture.on('close', code => {
      if (code !== 0) {
        res.status(500).end()
      } else {
        res.status(200).end()
      }
      capture.removeAllListeners()
      capturing = false
      resolve()
    })
    capture.on('error', err => console.log('error', err))
    capture.stderr.on('data', data => console.log('error stderr', data.toString()))
    capture.stdout.on('data', data => res.write(data))
  })
}