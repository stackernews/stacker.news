export async function hashAndSaltEmails ({ models }) {
  try {
    console.log('Migrating existing emails to salt and hash them...')
    await models.$queryRaw`select migrate_existing_user_emails(${process.env.EMAIL_SALT}::TEXT)`
    console.log('Successfully migrated existing emails to salt and hash them!')
  } catch (err) {
    console.error('Error occurred while salting and hashing existing emails')
    console.error(err)
  }
}
