import { deleteObjects } from '../api/s3'

export function deleteUnusedImages ({ models }) {
  return async function ({ name }) {
    console.log('running', name)

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
      AND created_at < date_trunc('hour', now() - interval '24 hours')`

    const s3Keys = unpaidImages.map(({ id }) => id)
    console.log('deleting images:', s3Keys)
    await deleteObjects(s3Keys)
    await models.upload.deleteMany({ where: { id: { in: s3Keys } } })
  }
}
