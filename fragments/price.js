import { gql } from '@apollo/client'

export const PRICE = gql`
  query price($fiatCurrency: String, $changedCurrency: Boolean) {
    price(fiatCurrency: $fiatCurrency, changedCurrency: $changedCurrency)
  }`
