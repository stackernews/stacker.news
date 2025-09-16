import { gql } from '@apollo/client'

export const PRICE = gql`
  query price($fiatCurrency: String) {
    price(fiatCurrency: $fiatCurrency)
    bigMacPrice
  }`
