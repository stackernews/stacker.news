import AWS from 'aws-sdk'
import { MEDIA_URL } from '../../lib/constants'

const bucketRegion = 'us-east-1'
const Bucket = process.env.NEXT_PUBLIC_AWS_UPLOAD_BUCKET

AWS.config.update({
  region: bucketRegion
})

const config = {
  apiVersion: '2006-03-01',
  endpoint: process.env.NODE_ENV === 'development' ? `${MEDIA_URL}` : undefined,
  s3ForcePathStyle: process.env.NODE_ENV === 'development'
}

export function createPresignedPost ({ key, type, size }) {
  const s3 = new AWS.S3({
    ...config,
    // in development, we need to be able to call this from localhost
    endpoint: process.env.NODE_ENV === 'development' ? `${process.env.NEXT_PUBLIC_MEDIA_URL}` : undefined
  })
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

export async function deleteObjects (keys) {
  const s3 = new AWS.S3(config)
  // max 1000 keys per request
  // see https://docs.aws.amazon.com/cli/latest/reference/s3api/delete-objects.html
  const batchSize = 1000
  const deleted = []
  for (let i = 0; i < keys.length; i += batchSize) {
    const batch = keys.slice(i, i + batchSize)
    await new Promise((resolve, reject) => {
      const params = {
        Bucket,
        Delete: {
          Objects: batch.map(key => ({ Key: String(key) }))
        }
      }
      s3.deleteObjects(params, (err, data) => {
        if (err) return reject(err)
        const deleted = data.Deleted?.map(({ Key }) => parseInt(Key)) || []
        resolve(deleted)
      })
    }).then((deleteConfirmed) => {
      deleted.push(...deleteConfirmed)
    }).catch(console.error)
  }
  return deleted
}
