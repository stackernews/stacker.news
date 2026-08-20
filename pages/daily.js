import models from '@/api/models'

export async function getServerSideProps () {
  // get the latest daily discussion thread
  const items = await models.$queryRaw`
    SELECT "Item".id as id
    FROM "Item"
    WHERE "Item"."paidAt" IS NOT NULL
    AND "Item"."pinId" IS NOT NULL
    AND "Item"."title" = 'Stacker Saloon'
    ORDER BY "Item"."created_at" DESC
    LIMIT 1`

  const destination = items.length > 0 ? `/items/${items[0].id}` : '/'
  return { redirect: { destination, permanent: false } }
}

export default () => null
