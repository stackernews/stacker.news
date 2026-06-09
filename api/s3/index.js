import { S3Client, DeleteObjectsCommand } from '@aws-sdk/client-s3'
import { createPresignedPost as s3CreatePresignedPost } from '@aws-sdk/s3-presigned-post'
import { MEDIA_URL } from '@/lib/constants'

const bucketRegion = 'us-east-1'
const Bucket = process.env.NEXT_PUBLIC_AWS_UPLOAD_BUCKET

// Cache S3Client instances per endpoint. The v3 SDK builds a credential
// provider chain and HTTP handler on construction, so reconstructing on every
// call is wasteful on hot upload paths. Key by endpoint because the
// construction call has endpoint as a param.
const s3ClientCache = new Map()

function getS3Client (endpoint) {
  // Warn if development is configured to use Amazon's S3 (no endpoint given)
  if (process.env.NODE_ENV === 'development' && !endpoint) {
    console.warn('S3 client: no development endpoint configured (NEXT_PUBLIC_MEDIA_URL/MEDIA_URL); requests will target real S3')
  }

  // Imitate v2 SDK behavior and ignore any paths given to the client, to be
  // able to keep the NEXT_PUBLIC_MEDIA_URL usage including paths elsewhere
  let s3Endpoint = endpoint
  if (s3Endpoint) {
    try { s3Endpoint = new URL(s3Endpoint).origin } catch {}
  }

  const cacheKey = s3Endpoint || ''
  const cached = s3ClientCache.get(cacheKey)
  if (cached) return cached

  const client = new S3Client({
    region: bucketRegion,
    forcePathStyle: process.env.NODE_ENV === 'development',
    ...(s3Endpoint && { endpoint: s3Endpoint })
  })
  s3ClientCache.set(cacheKey, client)

  return client
}

export async function createPresignedPost ({ key, type, size }) {
  // for local development, we use the NEXT_PUBLIC_MEDIA_URL which
  // is reachable from the host machine
  const endpoint = process.env.NODE_ENV === 'development'
    ? process.env.NEXT_PUBLIC_MEDIA_URL
    : undefined
  const client = getS3Client(endpoint)

  return s3CreatePresignedPost(client, {
    Bucket,
    Key: key,
    Expires: 300,
    Conditions: [
      { 'Content-Type': type },
      { 'Cache-Control': 'max-age=31536000' },
      { acl: 'public-read' },
      ['content-length-range', size, size]
    ],
    Fields: { key }
  })
}

export async function deleteObjects (keys) {
  // for local development, we use the MEDIA_URL which
  // is reachable from the container network
  const endpoint = process.env.NODE_ENV === 'development'
    ? MEDIA_URL
    : undefined
  const client = getS3Client(endpoint)

  // max 1000 keys per request
  // see https://docs.aws.amazon.com/cli/latest/reference/s3api/delete-objects.html
  const batchSize = 1000
  const deleted = []
  for (let i = 0; i < keys.length; i += batchSize) {
    const batch = keys.slice(i, i + batchSize)
    try {
      const params = {
        Bucket,
        Delete: {
          Objects: batch.map(key => ({ Key: String(key) }))
        }
      }
      const data = await client.send(new DeleteObjectsCommand(params))
      const confirmed = data.Deleted?.map(({ Key }) => parseInt(Key, 10)) || []
      deleted.push(...confirmed)
    } catch (err) {
      console.error(err)
    }
  }
  return deleted
}
