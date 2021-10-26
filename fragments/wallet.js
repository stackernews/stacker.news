import { gql } from '@apollo/client'

export const INVOICE = gql`
  query Invoice($id: ID!) {
    invoice(id: $id) {
      id
      bolt11
      msatsReceived
      cancelled
      confirmedAt
      expiresAt
    }
  }`

export const WITHDRAWL = gql`
  query Withdrawl($id: ID!) {
    withdrawl(id: $id) {
      id
      bolt11
      satsPaid
      satsFeePaying
      satsFeePaid
      status
    }
  }`
