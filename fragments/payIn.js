import gql from 'graphql-tag'

export const HASH_HMAC_INPUT_1 = '$hash: String, $hmac: String'
export const HASH_HMAC_INPUT_2 = 'hash: $hash, hmac: $hmac'

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
      createdAt
      updatedAt
    }
    payInCustodialTokens {
      id
      mtokens
      custodialTokenType
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
