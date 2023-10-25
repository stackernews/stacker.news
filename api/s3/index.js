import AWS from 'aws-sdk'

const bucketRegion = 'us-east-1'
const Bucket = process.env.NEXT_PUBLIC_AWS_UPLOAD_BUCKET

AWS.config.update({
  region: bucketRegion
})

export function createPresignedPost ({ key, type, size }) {
  const s3 = new AWS.S3({ apiVersion: '2006-03-01' })
  return new Promise((resolve, reject) => {
    s3.createPresignedPost({
      Bucket,
      Fields: { key },
      Expires: 300,
      Conditions: [
        { 'Content-Type': type },
        { 'Cache-Control': 'max-age=31536000' },
        { acl: 'public-read' },
        ['content-length-range', size, size]
      ]
    }, (err, preSigned) => { err ? reject(err) : resolve(preSigned) })
  })
}

export function deleteObjects (keys) {
  const s3 = new AWS.S3({ apiVersion: '2006-03-01' })
  return new Promise((resolve, reject) => {
    s3.deleteObjects({
      Bucket,
      Delete: {
        Objects: keys.map(key => ({ Key: String(key) }))
      }
    }, (err, data) => { err ? reject(err) : resolve(keys) })
  })
}
