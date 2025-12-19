import { gql } from '@apollo/client'

export const CREATE_WITHDRAWL = gql`
  mutation createWithdrawl($invoice: String!, $maxFee: Int!, $amount: Int) {
    createWithdrawl(invoice: $invoice, maxFee: $maxFee, amount: $amount) {
      id
    }
}`

export const SEND_TO_LNADDR = gql`
  mutation sendToLnAddr($addr: String!, $amount: Int!, $maxFee: Int!, $comment: String, $identifier: Boolean, $name: String, $email: String) {
    sendToLnAddr(addr: $addr, amount: $amount, maxFee: $maxFee, comment: $comment, identifier: $identifier, name: $name, email: $email) {
      id
    }
}`
