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
    }
    paymentMethod
  }`

export const RETRY_PAID_ACTION = gql`
  ${PAID_ACTION}
  mutation retryPaidAction($invoiceId: Int!) {
    retryPaidAction(invoiceId: $invoiceId) {
      __typename
      ...PaidActionFields
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
  mutation act($id: ID!, $sats: Int!, $act: String, $hash: String, $hmac: String) {
    act(id: $id, sats: $sats, act: $act, hash: $hash, hmac: $hmac) {
      result {
        id
        sats
        path
        act
      }
      ...PaidActionFields
    }
  }`

export const UPSERT_DISCUSSION = gql`
  ${PAID_ACTION}
  mutation upsertDiscussion($sub: String, $id: ID, $title: String!, $text: String, $boost: Int, $forward: [ItemForwardInput], $hash: String, $hmac: String) {
    upsertDiscussion(sub: $sub, id: $id, title: $title, text: $text, boost: $boost, forward: $forward, hash: $hash, hmac: $hmac) {
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
  mutation upsertJob($sub: String!, $id: ID, $title: String!, $company: String!, $location: String,
    $remote: Boolean, $text: String!, $url: String!, $maxBid: Int!, $status: String, $logo: Int, $hash: String, $hmac: String) {
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
  mutation upsertLink($sub: String, $id: ID, $title: String!, $url: String!, $text: String, $boost: Int, $forward: [ItemForwardInput], $hash: String, $hmac: String) {
    upsertLink(sub: $sub, id: $id, title: $title, url: $url, text: $text, boost: $boost, forward: $forward, hash: $hash, hmac: $hmac) {
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
    $options: [String!]!, $boost: Int, $forward: [ItemForwardInput], $hash: String, $hmac: String, $pollExpiresAt: Date) {
    upsertPoll(sub: $sub, id: $id, title: $title, text: $text,
      options: $options, boost: $boost, forward: $forward, hash: $hash, hmac: $hmac, pollExpiresAt: $pollExpiresAt) {
      result {
        id
        deleteScheduledAt
        reminderScheduledAt
      }
      ...PaidActionFields
    }
  }`

export const CREATE_COMMENT = gql`
  ${COMMENTS}
  ${PAID_ACTION}
  mutation upsertComment($text: String!, $parentId: ID!, $hash: String, $hmac: String) {
    upsertComment(text: $text, parentId: $parentId, hash: $hash, hmac: $hmac) {
      result {
        ...CommentFields
        deleteScheduledAt
        reminderScheduledAt
        comments {
          ...CommentsRecursive
        }
      }
      ...PaidActionFields
    }
  }`

export const UPSERT_COMMENT = gql`
  ${COMMENTS}
  ${PAID_ACTION}
  mutation upsertComment($id: ID!, $text: String!, $hash: String, $hmac: String) {
    upsertComment(id: $id, text: $text, hash: $hash, hmac: $hmac) {
      result {
        ...CommentFields
        deleteScheduledAt
        reminderScheduledAt
        comments {
          ...CommentsRecursive
        }
      }
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
