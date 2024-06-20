import gql from 'graphql-tag'
import { COMMENTS } from './comments'
import { SUB_FULL_FIELDS } from './subs'

export const PAID_ACTION = gql`
  fragment PaidActionFields on PaidAction {
    invoice {
      bolt11
      hash
      hmac
      id
      expiresAt
      actionState
      actionType
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
        ...CommentsRecursive
      }
    }
  }`

const ITEM_ACT_PAID_ACTION_FIELDS = gql`
  fragment ItemActPaidActionFields on ItemActPaidAction {
    result {
      id
      sats
      path
      act
    }
  }`

export const RETRY_PAID_ACTION = gql`
  ${PAID_ACTION}
  ${ITEM_PAID_ACTION_FIELDS}
  ${ITEM_ACT_PAID_ACTION_FIELDS}
  mutation retryPaidAction($invoiceId: Int!) {
    retryPaidAction(invoiceId: $invoiceId) {
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
  mutation donateToRewards($sats: Int!, $hash: String, $hmac: String) {
    donateToRewards(sats: $sats, hash: $hash, hmac: $hmac) {
      result {
        sats
      }
      ...PaidActionFields
    }
  }`

export const ACT_MUTATION = gql`
  ${PAID_ACTION}
  ${ITEM_ACT_PAID_ACTION_FIELDS}
  mutation act($id: ID!, $sats: Int!, $act: String, $hash: String, $hmac: String) {
    act(id: $id, sats: $sats, act: $act, hash: $hash, hmac: $hmac) {
      ...ItemActPaidActionFields
      ...PaidActionFields
    }
  }`

export const UPSERT_DISCUSSION = gql`
  ${PAID_ACTION}
  mutation upsertDiscussion($sub: String, $id: ID, $title: String!, $text: String,
    $boost: Int, $forward: [ItemForwardInput], $hash: String, $hmac: String) {
    upsertDiscussion(sub: $sub, id: $id, title: $title, text: $text, boost: $boost,
      forward: $forward, hash: $hash, hmac: $hmac) {
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
    $location: String, $remote: Boolean, $text: String!, $url: String!, $maxBid: Int!,
    $status: String, $logo: Int, $hash: String, $hmac: String) {
    upsertJob(sub: $sub, id: $id, title: $title, company: $company,
      location: $location, remote: $remote, text: $text,
      url: $url, maxBid: $maxBid, status: $status, logo: $logo, hash: $hash, hmac: $hmac) {
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
    $text: String, $boost: Int, $forward: [ItemForwardInput], $hash: String, $hmac: String) {
    upsertLink(sub: $sub, id: $id, title: $title, url: $url, text: $text,
      boost: $boost, forward: $forward, hash: $hash, hmac: $hmac) {
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
    $options: [String!]!, $boost: Int, $forward: [ItemForwardInput], $hash: String,
    $hmac: String, $pollExpiresAt: Date) {
    upsertPoll(sub: $sub, id: $id, title: $title, text: $text,
      options: $options, boost: $boost, forward: $forward, hash: $hash,
       hmac: $hmac, pollExpiresAt: $pollExpiresAt) {
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
    $text: String, $boost: Int, $forward: [ItemForwardInput], $hash: String, $hmac: String) {
    upsertBounty(sub: $sub, id: $id, title: $title, bounty: $bounty, text: $text,
      boost: $boost, forward: $forward, hash: $hash, hmac: $hmac) {
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
  mutation pollVote($id: ID!, $hash: String, $hmac: String) {
    pollVote(id: $id, hash: $hash, hmac: $hmac) {
      result {
        id
      }
      ...PaidActionFields
    }
  }`

export const CREATE_COMMENT = gql`
  ${ITEM_PAID_ACTION_FIELDS}
  ${PAID_ACTION}
  mutation upsertComment($text: String!, $parentId: ID!, $hash: String, $hmac: String) {
    upsertComment(text: $text, parentId: $parentId, hash: $hash, hmac: $hmac) {
      ...ItemPaidActionFields
      ...PaidActionFields
    }
  }`

export const UPDATE_COMMENT = gql`
  ${ITEM_PAID_ACTION_FIELDS}
  ${PAID_ACTION}
  mutation upsertComment($id: ID!, $text: String!, $hash: String, $hmac: String) {
    upsertComment(id: $id, text: $text, hash: $hash, hmac: $hmac) {
      ...ItemPaidActionFields
      ...PaidActionFields
    }
  }`

export const UPSERT_SUB = gql`
  ${PAID_ACTION}
  mutation upsertSub($oldName: String, $name: String!, $desc: String, $baseCost: Int!,
    $postTypes: [String!]!, $allowFreebies: Boolean!, $billingType: String!,
    $billingAutoRenew: Boolean!, $moderated: Boolean!, $hash: String, $hmac: String, $nsfw: Boolean!) {
      upsertSub(oldName: $oldName, name: $name, desc: $desc, baseCost: $baseCost,
        postTypes: $postTypes, allowFreebies: $allowFreebies, billingType: $billingType,
        billingAutoRenew: $billingAutoRenew, moderated: $moderated, hash: $hash, hmac: $hmac, nsfw: $nsfw) {
      result {
        name
      }
      ...PaidActionFields
    }
  }`

export const UNARCHIVE_TERRITORY = gql`
  ${PAID_ACTION}
  mutation unarchiveTerritory($name: String!, $desc: String, $baseCost: Int!,
    $postTypes: [String!]!, $allowFreebies: Boolean!, $billingType: String!,
    $billingAutoRenew: Boolean!, $moderated: Boolean!, $hash: String, $hmac: String, $nsfw: Boolean!) {
      unarchiveTerritory(name: $name, desc: $desc, baseCost: $baseCost,
        postTypes: $postTypes, allowFreebies: $allowFreebies, billingType: $billingType,
        billingAutoRenew: $billingAutoRenew, moderated: $moderated, hash: $hash, hmac: $hmac, nsfw: $nsfw) {
      result {
        name
      }
      ...PaidActionFields
    }
  }`

export const SUB_PAY = gql`
  ${SUB_FULL_FIELDS}
  ${PAID_ACTION}
  mutation paySub($name: String!, $hash: String, $hmac: String) {
    paySub(name: $name, hash: $hash, hmac: $hmac) {
      result {
        ...SubFullFields
      }
      ...PaidActionFields
    }
  }`
