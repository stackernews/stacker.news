import models from '@/api/models'

export default async (_, res) => {
  // get the latest daily discussion thread
  // this should probably be made more generic
  // eg if the title changes this will break
  // ... but this will need to change when we have more subs anyway
  const [{ id }] = await models.$queryRawUnsafe(`
    SELECT id
    FROM "Item"
    WHERE "pinId" IS NOT NULL
    AND title = 'Stacker Saloon'
    ORDER BY created_at DESC
    LIMIT 1`)

  res.redirect(`/items/${id}`)
}
