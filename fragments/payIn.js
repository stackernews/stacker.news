import gql from 'graphql-tag'

export const PAY_IN_FIELDS = gql`
  fragment PayInFields on PayIn {
    id
    createdAt
    updatedAt
    mcost
    payInType
    payInState
    payInFailureReason
    payInStateChangedAt
    payInBolt11 {
      id
      payInId
      bolt11
      hmac
      createdAt
      updatedAt
    }
    payInCustodialTokens {
      id
      mtokens
      custodialTokenType
    }
    result {
      __typename
      ... on Item {
        ...ItemFields
      }
      ... on ItemActResult {
        ...ItemActResultFields
      }
      ... on PollVoteResult {
        id
      }
      ... on Sub {
        ...SubFullFields
      }
      ... on DonateResult {
        sats
      }
      ... on BuyCreditsResult {
        credits
      }
    }
  }
`

export const GET_PAY_IN = gql`
  ${PAY_IN_FIELDS}
  query payIn($payInId: Int!) {
    payIn(payInId: $payInId) {
      ...PayInFields
    }
  }
`

export const RETRY_PAY_IN = gql`
  ${PAY_IN_FIELDS}
  mutation retryPayIn($payInId: Int!) {
    retryPayIn(payInId: $payInId) {
      ...PayInFields
    }
  }
`
