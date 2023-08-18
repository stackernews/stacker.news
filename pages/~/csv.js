import getGetCsvServerSideProps from '../../lib/csv'
import { WALLET_HISTORY } from '../../fragments/wallet'

export default function CsvFile () {
  return null
}

export const getServerSideProps = getGetCsvServerSideProps(WALLET_HISTORY)
