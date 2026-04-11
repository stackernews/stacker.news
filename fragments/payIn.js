import gql from 'graphql-tag'
import { ITEM_FULL_FIELDS } from './items'
import { SUB_FULL_FIELDS } from './subs'
import { COMMENTS } from './comments'
import { INVITE_FIELDS } from './invites'

const HASH_HMAC_INPUT_1 = '$hash: String, $hmac: String'
const HASH_HMAC_INPUT_2 = 'hash: $hash, hmac: $hmac'

export const PAY_IN_LINK_FIELDS = gql`
  fragment PayInLinkFields on PayIn {
    id
    mcost
    payInType
    payInState
    payInStateChangedAt
    payerPrivates {
      payInFailureReason
      retryCount
    }
  }
`

export const PAY_IN_BOLT11_FIELDS = gql`
  fragment PayInBolt11Fields on PayInBolt11 {
    id
    payInId
    bolt11
    hash
    hmac
    msatsRequested
    msatsReceived
    expiresAt
    confirmedAt
    cancelledAt
    lud18Data {
      id
      name
      identifier
      email
      pubkey
    }
    nostrNote {
      id
      note
    }
    comment {
      id
      comment
    }
  }
`

export const PAY_IN_WALLET_INFO_FIELDS = gql`
  fragment PayInWalletInfoFields on PayInWalletInfo {
    walletId
    walletName
    protocolId
    protocolName
    role
  }
`

export const PAY_IN_FIELDS = gql`
  ${SUB_FULL_FIELDS}
  ${COMMENTS}
  ${PAY_IN_LINK_FIELDS}
  ${PAY_IN_BOLT11_FIELDS}
  fragment PayInFields on PayIn {
    id
    createdAt
    updatedAt
    mcost
    payInType
    payInState
    payInStateChangedAt
    payOutBolt11Public {
      msats
    }
    payerPrivates {
      userId
      payInFailureReason
      retryCount
      payInBolt11 {
        ...PayInBolt11Fields
      }
      pessimisticEnv {
        id
        error
        result
      }
      payInCustodialTokens {
        id
        mtokens
        custodialTokenType
      }
      result {
        __typename
        ... on Item {
          id
          deleteScheduledAt
          reminderScheduledAt
          ...CommentFields
          payIn {
            ...PayInLinkFields
          }
        }
        ... on ItemAct {
          id
          sats
          path
          act
          payIn {
            ...PayInLinkFields
          }
        }
        ... on PollVote {
          id
          payIn {
            ...PayInLinkFields
          }
        }
        ... on Sub {
          ...SubFullFields
        }
      }
    }
  }
`

export const PAY_IN_STATISTICS_FIELDS = gql`
  ${ITEM_FULL_FIELDS}
  ${SUB_FULL_FIELDS}
  ${INVITE_FIELDS}
  ${PAY_IN_BOLT11_FIELDS}
  fragment PayInStatisticsFields on PayIn {
    id
    createdAt
    updatedAt
    mcost
    isSend
    payInType
    payInState
    payInStateChangedAt
    genesisId
    payInBolt11Public {
      msats
    }
    payOutBolt11Public {
      msats
    }
    payerPrivates {
      userId
      payInFailureReason
      retryCount
      payInCustodialTokens {
        id
        mtokens
        mtokensAfter
        custodialTokenType
      }
      refundCustodialTokens {
        id
        mtokens
        mtokensAfter
        custodialTokenType
      }
      payInBolt11 {
        ...PayInBolt11Fields
      }
      invite {
        ...InviteFields
      }
      sub {
        ...SubFullFields
      }
    }
    payeePrivates {
      payOutBolt11 {
        msats
        bolt11
        preimage
        status
      }
    }
    payOutCustodialTokens {
      id
      payOutType
      mtokens
      privates {
        mtokensAfter
      }
      sometimesPrivates {
        user {
          name
        }
      }
      custodialTokenType
      sub {
        name
      }
    }
    item {
      ...ItemFullFields
    }
  }
`

export const SATISTICS = gql`
  ${PAY_IN_STATISTICS_FIELDS}
  query Satistics($cursor: String) {
    satistics(cursor: $cursor) {
      payIns {
        ...PayInStatisticsFields
      }
      cursor
    }
  }
`

// Used by SSR so the transaction page has viewer-scoped wallet info on first render.
export const GET_PAY_IN_FULL_WITH_WALLET_INFO = gql`
  ${PAY_IN_STATISTICS_FIELDS}
  ${PAY_IN_WALLET_INFO_FIELDS}
  query payIn($id: Int!) {
    payIn(id: $id) {
      ...PayInStatisticsFields
      walletInfo {
        ...PayInWalletInfoFields
      }
    }
  }
`

// Used for polling so we do not re-resolve walletInfo on every refresh.
export const GET_PAY_IN_FULL_WITHOUT_WALLET_INFO = gql`
  ${PAY_IN_STATISTICS_FIELDS}
  query payIn($id: Int!) {
    payIn(id: $id) {
      ...PayInStatisticsFields
    }
  }
`

export const GET_PAY_IN_RESULT = gql`
  ${PAY_IN_FIELDS}
  query payIn($id: Int!) {
    payIn(id: $id) {
      ...PayInFields
    }
  }
`

export const RETRY_PAY_IN = gql`
  ${PAY_IN_FIELDS}
  mutation retryPayIn($payInId: Int!, $sendProtocolId: Int) {
    retryPayIn(payInId: $payInId, sendProtocolId: $sendProtocolId) {
      ...PayInFields
    }
  }
`

export const FAILED_PAY_INS = gql`
  query failedPayIns {
    failedPayIns {
      id
    }
  }
`

export const CANCEL_PAY_IN_BOLT11 = gql`
  ${PAY_IN_FIELDS}
  mutation cancelPayInBolt11($hash: String!, $hmac: String, $userCancel: Boolean) {
    cancelPayInBolt11(hash: $hash, hmac: $hmac, userCancel: $userCancel) {
      ...PayInFields
    }
  }`

export const DONATE = gql`
  ${PAY_IN_FIELDS}
  mutation donateToRewards($sats: Int!, $sendProtocolId: Int) {
    donateToRewards(sats: $sats, sendProtocolId: $sendProtocolId) {
      ...PayInFields
    }
  }`

export const BUY_CREDITS = gql`
  ${PAY_IN_FIELDS}
  mutation buyCredits($credits: Int!, $sendProtocolId: Int) {
    buyCredits(credits: $credits, sendProtocolId: $sendProtocolId) {
      ...PayInFields
    }
  }`

export const ACT_MUTATION = gql`
  ${PAY_IN_FIELDS}
  mutation act($id: ID!, $sats: Int!, $act: String, $sendProtocolId: Int) {
    act(id: $id, sats: $sats, act: $act, sendProtocolId: $sendProtocolId) {
      ...PayInFields
    }
  }`

export const PAY_BOUNTY_MUTATION = gql`
  ${PAY_IN_FIELDS}
  mutation payBounty($id: ID!, $sendProtocolId: Int) {
    payBounty(id: $id, sendProtocolId: $sendProtocolId) {
      ...PayInFields
    }
  }`

export const UPSERT_DISCUSSION = gql`
  ${PAY_IN_FIELDS}
  mutation upsertDiscussion($subNames: [String!]!, $id: ID, $title: String!, $text: String,
    $forward: [ItemForwardInput], ${HASH_HMAC_INPUT_1}, $sendProtocolId: Int) {
    upsertDiscussion(subNames: $subNames, id: $id, title: $title, text: $text,
      forward: $forward, ${HASH_HMAC_INPUT_2}, sendProtocolId: $sendProtocolId) {
      ...PayInFields
    }
  }`

export const UPSERT_JOB = gql`
  ${PAY_IN_FIELDS}
  mutation upsertJob($subNames: [String!]!, $id: ID, $title: String!, $company: String!,
    $location: String, $remote: Boolean, $text: String!, $url: String!,
    $status: String, $logo: Int, $sendProtocolId: Int) {
    upsertJob(subNames: $subNames, id: $id, title: $title, company: $company,
      location: $location, remote: $remote, text: $text,
      url: $url, status: $status, logo: $logo, sendProtocolId: $sendProtocolId) {
      ...PayInFields
    }
  }`

export const UPSERT_LINK = gql`
  ${PAY_IN_FIELDS}
  mutation upsertLink($subNames: [String!]!, $id: ID, $title: String!, $url: String!,
    $text: String, $forward: [ItemForwardInput], ${HASH_HMAC_INPUT_1}, $sendProtocolId: Int) {
    upsertLink(subNames: $subNames, id: $id, title: $title, url: $url, text: $text,
      forward: $forward, ${HASH_HMAC_INPUT_2}, sendProtocolId: $sendProtocolId) {
      ...PayInFields
    }
  }`

export const UPSERT_POLL = gql`
  ${PAY_IN_FIELDS}
  mutation upsertPoll($subNames: [String!]!, $id: ID, $title: String!, $text: String,
    $options: [String!]!, $forward: [ItemForwardInput], $pollExpiresAt: Date,
    $randPollOptions: Boolean, ${HASH_HMAC_INPUT_1}, $sendProtocolId: Int) {
    upsertPoll(subNames: $subNames, id: $id, title: $title, text: $text,
      options: $options, forward: $forward, pollExpiresAt: $pollExpiresAt,
      randPollOptions: $randPollOptions, ${HASH_HMAC_INPUT_2}, sendProtocolId: $sendProtocolId) {
      ...PayInFields
    }
  }`

export const UPSERT_BOUNTY = gql`
  ${PAY_IN_FIELDS}
  mutation upsertBounty($subNames: [String!]!, $id: ID, $title: String!, $bounty: Int!,
    $text: String, $forward: [ItemForwardInput], $sendProtocolId: Int) {
    upsertBounty(subNames: $subNames, id: $id, title: $title, bounty: $bounty, text: $text,
      forward: $forward, sendProtocolId: $sendProtocolId) {
      ...PayInFields
    }
  }`

export const POLL_VOTE = gql`
  ${PAY_IN_FIELDS}
  mutation pollVote($id: ID!, $sendProtocolId: Int) {
    pollVote(id: $id, sendProtocolId: $sendProtocolId) {
      ...PayInFields
    }
  }`

export const UPSERT_BIO = gql`
  ${PAY_IN_FIELDS}
  mutation upsertBio($text: String!, $sendProtocolId: Int) {
    upsertBio(text: $text, sendProtocolId: $sendProtocolId) {
      ...PayInFields
    }
  }`

export const CREATE_COMMENT = gql`
  ${PAY_IN_FIELDS}
  mutation upsertComment($text: String!, $parentId: ID!, $sendProtocolId: Int) {
    upsertComment(text: $text, parentId: $parentId, sendProtocolId: $sendProtocolId) {
      ...PayInFields
    }
  }`

export const UPDATE_COMMENT = gql`
  ${PAY_IN_FIELDS}
  mutation upsertComment($id: ID!, $text: String!, ${HASH_HMAC_INPUT_1}, $sendProtocolId: Int) {
    upsertComment(id: $id, text: $text, ${HASH_HMAC_INPUT_2}, sendProtocolId: $sendProtocolId) {
      ...PayInFields
    }
  }`

export const UPSERT_SUB = gql`
  ${PAY_IN_FIELDS}
  mutation upsertSub($oldName: String, $name: String!, $desc: String, $baseCost: Int!,
    $replyCost: Int!, $postsSatsFilter: Int,
    $postTypes: [String!]!, $billingType: String!,
    $billingAutoRenew: Boolean!, $nsfw: Boolean!, $sendProtocolId: Int) {
      upsertSub(oldName: $oldName, name: $name, desc: $desc, baseCost: $baseCost,
        replyCost: $replyCost, postsSatsFilter: $postsSatsFilter,
        postTypes: $postTypes, billingType: $billingType,
        billingAutoRenew: $billingAutoRenew, nsfw: $nsfw, sendProtocolId: $sendProtocolId) {
      ...PayInFields
    }
  }`

export const UNARCHIVE_TERRITORY = gql`
  ${PAY_IN_FIELDS}
  mutation unarchiveTerritory($name: String!, $desc: String, $baseCost: Int!,
    $replyCost: Int!, $postsSatsFilter: Int,
    $postTypes: [String!]!, $billingType: String!,
    $billingAutoRenew: Boolean!, $nsfw: Boolean!, $sendProtocolId: Int) {
      unarchiveTerritory(name: $name, desc: $desc, baseCost: $baseCost,
        replyCost: $replyCost, postsSatsFilter: $postsSatsFilter,
        postTypes: $postTypes, billingType: $billingType,
        billingAutoRenew: $billingAutoRenew, nsfw: $nsfw, sendProtocolId: $sendProtocolId) {
      ...PayInFields
    }
  }`

export const SUB_PAY = gql`
  ${PAY_IN_FIELDS}
  mutation paySub($name: String!, $sendProtocolId: Int) {
    paySub(name: $name, sendProtocolId: $sendProtocolId) {
      ...PayInFields
    }
  }`
