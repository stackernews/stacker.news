/**
 * pre-populate imgproxyUrls with upload dimensions and type for new uploads
 *
 * the imgproxy job will overwrite these with the actual imgproxy URLs and data
 *
 * @param models - db prisma models or transaction
 * @param uploadIds - array of upload IDs
 * @param oldImgproxyUrls - optional existing imgproxyUrls object to merge with
 * @returns initial imgproxyUrls object with upload dimensions and type
 */
export async function getTempImgproxyUrls (models, uploadIds, oldImgproxyUrls) {
  const imgproxyUrls = oldImgproxyUrls || {}
  if (uploadIds.length > 0) {
    const uploads = await models.upload.findMany({
      where: { id: { in: uploadIds } },
      select: { id: true, width: true, height: true, type: true }
    })

    for (const upload of uploads) {
      const url = `${process.env.NEXT_PUBLIC_MEDIA_URL}/${upload.id}`
      imgproxyUrls[url] = {
        dimensions: { width: upload.width, height: upload.height },
        video: upload.type?.startsWith('video/')
      }
    }
  }
  return imgproxyUrls
}
