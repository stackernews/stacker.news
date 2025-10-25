import { USER_ID } from '@/lib/constants'

export const GLOBAL_SEEDS = [USER_ID.k00b, USER_ID.ek]

export function initialTrust ({ name, userId }) {
  const results = GLOBAL_SEEDS.map(id => ({
    subName: name,
    userId: id,
    zapPostTrust: 1,
    subZapPostTrust: 1,
    zapCommentTrust: 1,
    subZapCommentTrust: 1
  }))

  if (!GLOBAL_SEEDS.includes(userId)) {
    results.push({
      subName: name,
      userId,
      zapPostTrust: 0,
      subZapPostTrust: 1,
      zapCommentTrust: 0,
      subZapCommentTrust: 1
    })
  }

  return results
}
