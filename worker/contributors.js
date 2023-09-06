/**
 * Instructions: Once you make a contribution to the repo, add yourself to this map,
 * where the key is your user id in stacker.news prod,
 * and the value map contains your GitHub username, and your SN nym.
 * Right now, the GitHub usernames and SN nyms are not used, but maybe we'll use them
 * in the future for a fancier UI decoration.
 */
const contributorMap = {
  616: {
    github: 'huumn',
    sn: 'k00b'
  },
  946: {
    github: 'kerooke',
    sn: 'kr'
  },
  6030: {
    github: 'ekzyis',
    sn: 'ekzyis'
  },
  11275: {
    github: 'SatsAllDay',
    sn: 'WeAreAllSatoshi'
  }
}

/**
 * Bootstrap known contributors in the DB upon start-up
 * Only needs to run one time per deploy
 */
function contributors ({ models }) {
  return async function () {
    try {
      const { count } = await models.user.updateMany({
        where: {
          id: {
            in: Object.keys(contributorMap).map(Number)
          }
        },
        data: {
          isContributor: true
        }
      })
      console.log(`set ${count} users as contributors`)
      const users = await models.user.findMany({
        where: {
          isContributor: true
        }
      })
      console.log(`Contributors: ${users.map(user => user.name).join(', ')}`)
    } catch (err) {
      console.error('Error bootstrapping contributors', err)
    }
  }
}

module.exports = { contributors }
