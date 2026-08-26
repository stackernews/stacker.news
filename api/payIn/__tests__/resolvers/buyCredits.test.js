/* eslint-env jest */

// this lives under the payIn suite rather than beside api/resolvers because only this
// config carries the ESM mocks (lexical, @noble/hashes, ln-service) that importing the
// whole resolver tree needs.

import { makeExecutableSchema } from '@graphql-tools/schema'
import { graphql } from 'graphql'
import pay from '../../index.js'
import typeDefs from '../../../typeDefs/index.js'
import resolvers from '../../../resolvers/index.js'

jest.mock('../../index.js', () => ({
  __esModule: true,
  default: jest.fn(async () => ({ id: 1 }))
}))

const BUY_CREDITS = `
  mutation buyCredits($credits: Int!) {
    buyCredits(credits: $credits) {
      id
    }
  }`

const BUY_CREDITS_WITH_REWARD_SATS = `
  mutation buyCredits($credits: Int!, $useRewardSats: Boolean) {
    buyCredits(credits: $credits, useRewardSats: $useRewardSats) {
      id
    }
  }`

describe('buyCredits mutation', () => {
  const schema = makeExecutableSchema({ typeDefs, resolvers })
  const me = { id: 123 }

  const buyCredits = (source, variableValues) =>
    graphql({ schema, source, variableValues, contextValue: { me, models: {} } })

  it('forwards useRewardSats to the payIn as an arg', async () => {
    const { errors } = await buyCredits(BUY_CREDITS_WITH_REWARD_SATS, { credits: 1000, useRewardSats: true })

    expect(errors).toBeUndefined()
    expect(pay).toHaveBeenCalledWith(
      'BUY_CREDITS',
      expect.objectContaining({ credits: 1000, useRewardSats: true }),
      expect.anything())
  })

  it('leaves useRewardSats unset when the buyer does not ask for it', async () => {
    const { errors } = await buyCredits(BUY_CREDITS, { credits: 1000 })

    expect(errors).toBeUndefined()
    expect(pay).toHaveBeenCalledWith(
      'BUY_CREDITS',
      expect.not.objectContaining({ useRewardSats: true }),
      expect.anything())
  })
})
