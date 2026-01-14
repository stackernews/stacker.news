import models from '@/api/models'

export default async (_, res) => {
  // get the latest daily discussion thread
  // this should probably be made more generic
  // eg if the title changes this will break
  // ... but this will need to change when we have more subs anyway
  const items = await models.$queryRaw`
    SELECT "Item".id as id
    FROM "Item"
    JOIN "ItemPayIn" ON "ItemPayIn"."itemId" = "Item".id
    JOIN "PayIn" ON "PayIn".id = "ItemPayIn"."payInId" AND "PayIn"."payInType" = 'ITEM_CREATE'
    WHERE "PayIn"."payInState" = 'PAID'
    AND "Item"."pinId" IS NOT NULL
    AND "Item"."title" = 'Stacker Saloon'
    ORDER BY "Item"."created_at" DESC
    LIMIT 1`

  if (items.length === 0) {
    res.redirect('/')
    return
  }

  res.redirect(`/items/${items[0].id}`)
}
