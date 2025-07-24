import gql from 'graphql-tag'
import { COMMENTS } from './comments'
import { SUB_FULL_FIELDS } from './subs'
import { INVOICE_FIELDS } from './invoice'

const HASH_HMAC_INPUT_1 = '$hash: String, $hmac: String'
const HASH_HMAC_INPUT_2 = 'hash: $hash, hmac: $hmac'

export const PAID_ACTION = gql`
  ${INVOICE_FIELDS}
  fragment PaidActionFields on PaidAction {
    invoice {
      ...InvoiceFields
      invoiceForward
    }
    paymentMethod
  }`

const ITEM_PAID_ACTION_FIELDS = gql`
  ${COMMENTS}
  fragment ItemPaidActionFields on ItemPaidAction {
    result {
      id
      deleteScheduledAt
      reminderScheduledAt
      ...CommentFields
      comments {
        comments {
          ...CommentsRecursive
        }
      }
    }
  }`

const ITEM_PAID_ACTION_FIELDS_NO_CHILD_COMMENTS = gql`
  ${COMMENTS}
  fragment ItemPaidActionFieldsNoChildComments on ItemPaidAction {
    result {
      id
      deleteScheduledAt
      reminderScheduledAt
      ...CommentFields
    }
  }
`

const ITEM_ACT_PAID_ACTION_FIELDS = gql`
  fragment ItemActPaidActionFields on ItemActPaidAction {
    result {
      id
      sats
      path
      act
    }
  }`

export const GET_PAID_ACTION = gql`
  ${PAID_ACTION}
  ${ITEM_PAID_ACTION_FIELDS}
  ${ITEM_ACT_PAID_ACTION_FIELDS}
  ${SUB_FULL_FIELDS}
  query paidAction($invoiceId: Int!) {
    paidAction(invoiceId: $invoiceId) {
      __typename
      ...PaidActionFields
      ... on ItemPaidAction {
        ...ItemPaidActionFields
      }
      ... on ItemActPaidAction {
        ...ItemActPaidActionFields
      }
      ... on PollVotePaidAction {
        result {
          id
        }
      }
      ... on SubPaidAction {
        result {
          ...SubFullFields
        }
      }
      ... on DonatePaidAction {
        result {
          sats
        }
      }
    }
  }`

export const RETRY_PAID_ACTION = gql`
  ${PAID_ACTION}
  ${ITEM_PAID_ACTION_FIELDS}
  ${ITEM_ACT_PAID_ACTION_FIELDS}
  mutation retryPaidAction($invoiceId: Int!, $newAttempt: Boolean) {
    retryPaidAction(invoiceId: $invoiceId, newAttempt: $newAttempt) {
      __typename
      ...PaidActionFields
      ... on ItemPaidAction {
        ...ItemPaidActionFields
      }
      ... on ItemActPaidAction {
        ...ItemActPaidActionFields
      }
      ... on PollVotePaidAction {
        result {
          id
        }
      }
    }
  }`

export const DONATE = gql`
  ${PAID_ACTION}
  mutation donateToRewards($sats: Int!) {
    donateToRewards(sats: $sats) {
      result {
        sats
      }
      ...PaidActionFields
    }
  }`

export const BUY_CREDITS = gql`
  ${PAID_ACTION}
  mutation buyCredits($credits: Int!) {
    buyCredits(credits: $credits) {
      result {
        credits
      }
      ...PaidActionFields
    }
  }`

export const ACT_MUTATION = gql`
  ${PAID_ACTION}
  ${ITEM_ACT_PAID_ACTION_FIELDS}
  mutation act($id: ID!, $sats: Int!, $act: String, $hasSendWallet: Boolean) {
    act(id: $id, sats: $sats, act: $act, hasSendWallet: $hasSendWallet) {
      ...ItemActPaidActionFields
      ...PaidActionFields
    }
  }`

export const UPSERT_DISCUSSION = gql`
  ${PAID_ACTION}
  mutation upsertDiscussion($sub: String, $id: ID, $title: String!, $text: String,
    $boost: Int, $forward: [ItemForwardInput], ${HASH_HMAC_INPUT_1}) {
    upsertDiscussion(sub: $sub, id: $id, title: $title, text: $text, boost: $boost,
      forward: $forward, ${HASH_HMAC_INPUT_2}) {
      result {
        id
        deleteScheduledAt
        reminderScheduledAt
      }
      ...PaidActionFields
    }
  }`

export const UPSERT_JOB = gql`
  ${PAID_ACTION}
  mutation upsertJob($sub: String!, $id: ID, $title: String!, $company: String!,
    $location: String, $remote: Boolean, $text: String!, $url: String!, $boost: Int,
    $status: String, $logo: Int) {
    upsertJob(sub: $sub, id: $id, title: $title, company: $company,
      location: $location, remote: $remote, text: $text,
      url: $url, boost: $boost, status: $status, logo: $logo) {
      result {
        id
        deleteScheduledAt
        reminderScheduledAt
      }
      ...PaidActionFields
    }
  }`

export const UPSERT_LINK = gql`
  ${PAID_ACTION}
  mutation upsertLink($sub: String, $id: ID, $title: String!, $url: String!,
    $text: String, $boost: Int, $forward: [ItemForwardInput], ${HASH_HMAC_INPUT_1}) {
    upsertLink(sub: $sub, id: $id, title: $title, url: $url, text: $text,
      boost: $boost, forward: $forward, ${HASH_HMAC_INPUT_2}) {
      result {
        id
        deleteScheduledAt
        reminderScheduledAt
      }
      ...PaidActionFields
    }
  }`

export const UPSERT_POLL = gql`
  ${PAID_ACTION}
  mutation upsertPoll($sub: String, $id: ID, $title: String!, $text: String,
    $options: [String!]!, $boost: Int, $forward: [ItemForwardInput], $pollExpiresAt: Date,
    $randPollOptions: Boolean, ${HASH_HMAC_INPUT_1}) {
    upsertPoll(sub: $sub, id: $id, title: $title, text: $text,
      options: $options, boost: $boost, forward: $forward, pollExpiresAt: $pollExpiresAt,
      randPollOptions: $randPollOptions, ${HASH_HMAC_INPUT_2}) {
      result {
        id
        deleteScheduledAt
        reminderScheduledAt
      }
      ...PaidActionFields
    }
  }`

export const UPSERT_BOUNTY = gql`
  ${PAID_ACTION}
  mutation upsertBounty($sub: String, $id: ID, $title: String!, $bounty: Int!,
    $text: String, $boost: Int, $forward: [ItemForwardInput]) {
    upsertBounty(sub: $sub, id: $id, title: $title, bounty: $bounty, text: $text,
      boost: $boost, forward: $forward) {
      result {
        id
        deleteScheduledAt
        reminderScheduledAt
      }
      ...PaidActionFields
    }
  }`

export const POLL_VOTE = gql`
  ${PAID_ACTION}
  mutation pollVote($id: ID!) {
    pollVote(id: $id) {
      result {
        id
      }
      ...PaidActionFields
    }
  }`

export const UPSERT_BIO = gql`
  ${ITEM_PAID_ACTION_FIELDS}
  ${PAID_ACTION}
  mutation upsertBio($text: String!) {
    upsertBio(text: $text) {
      ...ItemPaidActionFields
      ...PaidActionFields
    }
  }`

export const CREATE_COMMENT = gql`
  ${ITEM_PAID_ACTION_FIELDS}
  ${PAID_ACTION}
  mutation upsertComment($text: String!, $parentId: ID!) {
    upsertComment(text: $text, parentId: $parentId) {
      ...ItemPaidActionFields
      ...PaidActionFields
    }
  }`

export const UPDATE_COMMENT = gql`
  ${ITEM_PAID_ACTION_FIELDS_NO_CHILD_COMMENTS}
  ${PAID_ACTION}
  mutation upsertComment($id: ID!, $text: String!, $boost: Int, ${HASH_HMAC_INPUT_1}) {
    upsertComment(id: $id, text: $text, boost: $boost, ${HASH_HMAC_INPUT_2}) {
      ...ItemPaidActionFieldsNoChildComments
      ...PaidActionFields
    }
  }`

export const UPSERT_SUB = gql`
  ${PAID_ACTION}
  mutation upsertSub($oldName: String, $name: String!, $desc: String, $baseCost: Int!,
    $replyCost: Int!, $postTypes: [String!]!, $billingType: String!,
    $billingAutoRenew: Boolean!, $moderated: Boolean!, $nsfw: Boolean!) {
      upsertSub(oldName: $oldName, name: $name, desc: $desc, baseCost: $baseCost,
        replyCost: $replyCost, postTypes: $postTypes, billingType: $billingType,
        billingAutoRenew: $billingAutoRenew, moderated: $moderated, nsfw: $nsfw) {
      result {
        name
      }
      ...PaidActionFields
    }
  }`

export const UNARCHIVE_TERRITORY = gql`
  ${PAID_ACTION}
  mutation unarchiveTerritory($name: String!, $desc: String, $baseCost: Int!,
    $replyCost: Int!, $postTypes: [String!]!, $billingType: String!,
    $billingAutoRenew: Boolean!, $moderated: Boolean!, $nsfw: Boolean!) {
      unarchiveTerritory(name: $name, desc: $desc, baseCost: $baseCost,
        replyCost: $replyCost, postTypes: $postTypes, billingType: $billingType,
        billingAutoRenew: $billingAutoRenew, moderated: $moderated, nsfw: $nsfw) {
      result {
        name
      }
      ...PaidActionFields
    }
  }`

export const SUB_PAY = gql`
  ${SUB_FULL_FIELDS}
  ${PAID_ACTION}
  mutation paySub($name: String!) {
    paySub(name: $name) {
      result {
        ...SubFullFields
      }
      ...PaidActionFields
    }
  }`
