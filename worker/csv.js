// this should be run regularly ... like, every 1-5 minutes
function updateCsvs ({ models, apollo, prisma }) {
  return async function () {
    const todo = await models.user.findMany({
      where: {
        // conceptually, this is what we want:
        // csvRequest: { not: models.user.fields.csvRequestStatus }
        // but because the enums are of different types, we have to do this:
        OR: [
          { AND: [{ csvRequest: 'NO_REQUEST' }, { csvRequestStatus: { not: 'NO_REQUEST' } }] },
          { AND: [{ csvRequest: 'FULL_REPORT' }, { csvRequestStatus: { not: 'FULL_REPORT' } }] }
        ]
      },
      select: {
        id: true,
        csvRequest: true,
        csvRequestStatus: true
      }
    })

    if (todo.length === 0) return

    console.log('refreshing', todo.length, 'requested CSV files')

    todo.forEach(async req => {
      if (req.csvRequest === 'NO_REQUEST') {
        if (req.csvRequestStatus === 'GENERATING_REPORT') {
          console.log('canceling CSV request', req)
        }
        await models.$transaction([
          models.$executeRaw`UPDATE "users" SET "csvRequestStatus" = 'NO_REQUEST' WHERE "users"."id" = ${req.id}`])
      } else if (req.csvRequestStatus === 'NO_REQUEST') {
        console.log('starting CSV request', req)
        await models.$transaction([
          models.$executeRaw`UPDATE "users" SET "csvRequestStatus" = 'GENERATING_REPORT' WHERE "users"."id" = ${req.id}`])
      } else if (req.csvRequestStatus === 'GENERATING_REPORT') {
        console.log('finishing CSV request', req)
        await models.$transaction([
          models.$executeRaw`UPDATE "users" SET "csvRequestStatus" = 'FULL_REPORT' WHERE "users"."id" = ${req.id}`])
      } else {
        console.log('unexpected CSV request', req)
      }
    })

    console.log('done refreshing requested CSV files')
  }
}

module.exports = { updateCsvs }
