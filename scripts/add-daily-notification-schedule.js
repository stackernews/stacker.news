// Run this script after the migration to add the scheduled job to PgBoss
const PgBoss = require('pg-boss')

async function addScheduledJob() {
  console.log('Adding daily stacked notification schedule to PgBoss...')
  
  const boss = new PgBoss(process.env.DATABASE_URL)
  await boss.start()
  
  try {
    // Remove any existing schedule with the same name
    await boss.deleteSchedule('dailyStackedNotification')
    
    // Add the new schedule
    await boss.schedule('dailyStackedNotification', '15 1 * * *', null, {}, { tz: 'America/Chicago' })
    
    console.log('Successfully added daily stacked notification schedule!')
  } catch (error) {
    console.error('Error adding schedule:', error)
  } finally {
    await boss.stop()
  }
}

// Only run directly (not when imported)
if (require.main === module) {
  // Load env variables first
  require('../worker/loadenv')
  
  addScheduledJob()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Unhandled error:', err)
      process.exit(1)
    })
}

module.exports = { addScheduledJob }