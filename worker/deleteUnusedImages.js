import { deleteObjects } from '@/api/s3'
import { USER_ID } from '@/lib/constants'

export async function deleteUnusedImages ({ models }) {
  // delete all images in database and S3 which weren't paid in the last 24 hours
  const unpaidImages = await models.$queryRaw`
    SELECT id
    FROM "Upload"
    WHERE (paid = 'f'
    OR (
      -- for non-textarea images, they are free and paid is null
      paid IS NULL
      -- if the image is not used by a user or item (eg jobs), delete it
      AND NOT EXISTS (SELECT * FROM users WHERE "photoId" = "Upload".id)
      AND NOT EXISTS (SELECT * FROM "Item" WHERE "uploadId" = "Upload".id)
    ))
    AND created_at < date_trunc('hour', now() - CASE WHEN "userId" = ${USER_ID.anon} THEN interval '1 hour' ELSE interval '24 hours' END)`

  const s3Keys = unpaidImages.map(({ id }) => id)
  if (s3Keys.length === 0) {
    console.log('no images to delete.')
    return
  }
  console.log('deleting images:', s3Keys)
  const deleted = await deleteObjects(s3Keys)
  console.log('deleted images:', deleted)
  await models.upload.deleteMany({ where: { id: { in: deleted } } })
}
