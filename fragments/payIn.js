import gql from 'graphql-tag'
import { ITEM_FULL_FIELDS } from './items'
import { SUB_FULL_FIELDS } from './subs'
import { COMMENTS } from './comments'

const HASH_HMAC_INPUT_1 = '$hash: String, $hmac: String'
const HASH_HMAC_INPUT_2 = 'hash: $hash, hmac: $hmac'

export const PAY_IN_LINK_FIELDS = gql`
  fragment PayInLinkFields on PayIn {
    id
    mcost
    payInType
    payInState
    payInStateChangedAt
  }
`

export const PAY_IN_FIELDS = gql`
  ${SUB_FULL_FIELDS}
  ${COMMENTS}
  ${PAY_IN_LINK_FIELDS}
  fragment PayInFields on PayIn {
    id
    createdAt
    updatedAt
    mcost
    userId
    payInType
    payInState
    payInFailureReason
    payInStateChangedAt
    payInBolt11 {
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
      createdAt
      updatedAt
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
    pessimisticEnv {
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
`

export const PAY_IN_STATISTICS_FIELDS = gql`
  ${PAY_IN_FIELDS}
  ${ITEM_FULL_FIELDS}
  ${SUB_FULL_FIELDS}
  fragment PayInStatisticsFields on PayIn {
    id
    createdAt
    updatedAt
    mcost
    userId
    payInType
    payInState
    payInFailureReason
    payInStateChangedAt
    payInCustodialTokens {
      id
      mtokens
      mtokensAfter
      custodialTokenType
    }
    payInBolt11 {
      id
      bolt11
      preimage
      hmac
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
      msatsRequested
      msatsReceived
    }
    payOutBolt11 {
      id
      msats
      userId
      payOutType
    }
    payOutCustodialTokens {
      id
      userId
      payOutType
      mtokens
      mtokensAfter
      custodialTokenType
      user {
        name
      }
      sub {
        name
      }
    }
    item {
      ...ItemFullFields
    }
    sub {
      ...SubFullFields
    }
  }
`

export const SATISTICS = gql`
  ${PAY_IN_STATISTICS_FIELDS}
  query satistics($cursor: String, $inc: String) {
    satistics(cursor: $cursor, inc: $inc) {
      payIns {
        ...PayInStatisticsFields
      }
      cursor
    }
  }
`

export const GET_PAY_IN_FULL = gql`
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
  mutation retryPayIn($payInId: Int!) {
    retryPayIn(payInId: $payInId) {
      ...PayInFields
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
  mutation donateToRewards($sats: Int!) {
    donateToRewards(sats: $sats) {
      ...PayInFields
    }
  }`

export const BUY_CREDITS = gql`
  ${PAY_IN_FIELDS}
  mutation buyCredits($credits: Int!) {
    buyCredits(credits: $credits) {
      ...PayInFields
    }
  }`

export const ACT_MUTATION = gql`
  ${PAY_IN_FIELDS}
  mutation act($id: ID!, $sats: Int!, $act: String, $hasSendWallet: Boolean) {
    act(id: $id, sats: $sats, act: $act, hasSendWallet: $hasSendWallet) {
      ...PayInFields
    }
  }`

export const UPSERT_DISCUSSION = gql`
  ${PAY_IN_FIELDS}
  mutation upsertDiscussion($sub: String, $id: ID, $title: String!, $text: String,
    $boost: Int, $forward: [ItemForwardInput], ${HASH_HMAC_INPUT_1}) {
    upsertDiscussion(sub: $sub, id: $id, title: $title, text: $text, boost: $boost,
      forward: $forward, ${HASH_HMAC_INPUT_2}) {
      ...PayInFields
    }
  }`

export const UPSERT_JOB = gql`
  ${PAY_IN_FIELDS}
  mutation upsertJob($sub: String!, $id: ID, $title: String!, $company: String!,
    $location: String, $remote: Boolean, $text: String!, $url: String!, $boost: Int,
    $status: String, $logo: Int) {
    upsertJob(sub: $sub, id: $id, title: $title, company: $company,
      location: $location, remote: $remote, text: $text,
      url: $url, boost: $boost, status: $status, logo: $logo) {
      ...PayInFields
    }
  }`

export const UPSERT_LINK = gql`
  ${PAY_IN_FIELDS}
  mutation upsertLink($sub: String, $id: ID, $title: String!, $url: String!,
    $text: String, $boost: Int, $forward: [ItemForwardInput], ${HASH_HMAC_INPUT_1}) {
    upsertLink(sub: $sub, id: $id, title: $title, url: $url, text: $text,
      boost: $boost, forward: $forward, ${HASH_HMAC_INPUT_2}) {
      ...PayInFields
    }
  }`

export const UPSERT_POLL = gql`
  ${PAY_IN_FIELDS}
  mutation upsertPoll($sub: String, $id: ID, $title: String!, $text: String,
    $options: [String!]!, $boost: Int, $forward: [ItemForwardInput], $pollExpiresAt: Date,
    $randPollOptions: Boolean, ${HASH_HMAC_INPUT_1}) {
    upsertPoll(sub: $sub, id: $id, title: $title, text: $text,
      options: $options, boost: $boost, forward: $forward, pollExpiresAt: $pollExpiresAt,
      randPollOptions: $randPollOptions, ${HASH_HMAC_INPUT_2}) {
      ...PayInFields
    }
  }`

export const UPSERT_BOUNTY = gql`
  ${PAY_IN_FIELDS}
  mutation upsertBounty($sub: String, $id: ID, $title: String!, $bounty: Int!,
    $text: String, $boost: Int, $forward: [ItemForwardInput]) {
    upsertBounty(sub: $sub, id: $id, title: $title, bounty: $bounty, text: $text,
      boost: $boost, forward: $forward) {
      ...PayInFields
    }
  }`

export const POLL_VOTE = gql`
  ${PAY_IN_FIELDS}
  mutation pollVote($id: ID!) {
    pollVote(id: $id) {
      ...PayInFields
    }
  }`

export const UPSERT_BIO = gql`
  ${PAY_IN_FIELDS}
  mutation upsertBio($text: String!) {
    upsertBio(text: $text) {
      ...PayInFields
    }
  }`

export const CREATE_COMMENT = gql`
  ${PAY_IN_FIELDS}
  mutation upsertComment($text: String!, $parentId: ID!) {
    upsertComment(text: $text, parentId: $parentId) {
      ...PayInFields
    }
  }`

export const UPDATE_COMMENT = gql`
  ${PAY_IN_FIELDS}
  mutation upsertComment($id: ID!, $text: String!, $boost: Int, ${HASH_HMAC_INPUT_1}) {
    upsertComment(id: $id, text: $text, boost: $boost, ${HASH_HMAC_INPUT_2}) {
      ...PayInFields
    }
  }`

export const UPSERT_SUB = gql`
  ${PAY_IN_FIELDS}
  mutation upsertSub($oldName: String, $name: String!, $desc: String, $baseCost: Int!,
    $replyCost: Int!, $postTypes: [String!]!, $billingType: String!,
    $billingAutoRenew: Boolean!, $moderated: Boolean!, $nsfw: Boolean!) {
      upsertSub(oldName: $oldName, name: $name, desc: $desc, baseCost: $baseCost,
        replyCost: $replyCost, postTypes: $postTypes, billingType: $billingType,
        billingAutoRenew: $billingAutoRenew, moderated: $moderated, nsfw: $nsfw) {
      ...PayInFields
    }
  }`

export const UNARCHIVE_TERRITORY = gql`
  ${PAY_IN_FIELDS}
  mutation unarchiveTerritory($name: String!, $desc: String, $baseCost: Int!,
    $replyCost: Int!, $postTypes: [String!]!, $billingType: String!,
    $billingAutoRenew: Boolean!, $moderated: Boolean!, $nsfw: Boolean!) {
      unarchiveTerritory(name: $name, desc: $desc, baseCost: $baseCost,
        replyCost: $replyCost, postTypes: $postTypes, billingType: $billingType,
        billingAutoRenew: $billingAutoRenew, moderated: $moderated, nsfw: $nsfw) {
      ...PayInFields
    }
  }`

export const SUB_PAY = gql`
  ${PAY_IN_FIELDS}
  mutation paySub($name: String!) {
    paySub(name: $name) {
      ...PayInFields
    }
  }`
