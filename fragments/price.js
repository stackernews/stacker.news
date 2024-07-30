import { gql } from '@apollo/client'

export const PRICE = gql`
  query price($fiatCurrency: String, $fromCache: Boolean) {
    price(fiatCurrency: $fiatCurrency, fromCache: $fromCache)
  }`
