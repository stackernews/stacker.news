import path from 'path'
import AWS from 'aws-sdk'
import {PassThrough} from 'stream'
const { spawn } = require('child_process')

const bucketName = 'sn-capture'
const bucketRegion = 'us-east-1'
const contentType = 'image/png'
const bucketUrl = 'https://sn-capture.s3.amazonaws.com/'
const s3PathPrefix = process.env.NODE_ENV === 'development' ? 'dev/' : ''
var capturing = false

AWS.config.update({
  region: bucketRegion
})

export default async function handler (req, res) {
  if (capturing) {
    return res.writeHead(503, {
      'Retry-After' : 1
    }).end()
  }

  return new Promise(resolve => {
    const joinedPath = path.join(...(req.query.path || []))
    const s3Path = s3PathPrefix + (joinedPath === '.' ? '_' : joinedPath)
    const url = process.env.SELF_URL + '/' + joinedPath
    const aws = new AWS.S3({apiVersion: '2006-03-01'})

    // check to see if we have a recent version of the object
    aws.headObject({
      Bucket: bucketName,
      Key: s3Path,
      IfModifiedSince : new Date(new Date().getTime() - 15*60000)
    }).promise().then(() => {
      // this path is cached so return it
      res.writeHead(302, { Location: bucketUrl + s3Path }).end()
      resolve()
    }).catch(() => {
      // we don't have it cached, so capture it and cache it
      capturing = true
      const pass = new PassThrough()
      aws.upload({
        Bucket: bucketName,
        Key: s3Path,
        ACL: 'public-read',
        Body: pass,
        ContentType: contentType
      }).promise().catch(console.log)

      res.setHeader('Content-Type', contentType)
      const capture = spawn(
        'node', ['./spawn/capture.js', url], {maxBuffer: 1024*1024*5})

      capture.on('close', code => {
        if (code !== 0) {
          res.status(500).end()
        } else {
          res.status(200).end()
        }
        pass.end()
        capture.removeAllListeners()
        capturing = false
        resolve()
      })
      capture.on('error', err => console.log('error', err))
      capture.stderr.on('data', data => console.log('error stderr', data.toString()))
      capture.stdout.on('data', data => {
        res.write(data)
        pass.write(data)
      })
    })
  })
}