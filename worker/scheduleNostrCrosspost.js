// Schedule the nostrCrosspost worker to run every minute using PgBoss
// Place this in a startup script or call it from your main worker
import PgBoss from 'pg-boss'

async function scheduleNostrCrosspost() {
  const boss = new PgBoss(process.env.DATABASE_URL)
  await boss.start()
  await boss.schedule('nostrCrosspost', '* * * * *') // every minute
  console.log('Scheduled nostrCrosspost job to run every minute')
  await boss.stop()
}

scheduleNostrCrosspost().catch(console.error)
