import fs from 'fs'
import getSSRApolloClient from '../../api/ssrApollo'
import { ME } from '../../fragments/users'
import { CsvRequest, CsvRequestStatus } from '../../api/constants'
import { gql } from '@apollo/client'

export default async function handler (req, res) {
  const apollo = await getSSRApolloClient({ req, res })
  const { data: { me: { id, csvRequest, csvRequestStatus } } } = await apollo.query({ query: ME })
  const fname = `satistics_${id}.csv`
  res.setHeader('Content-Type', 'text/csv')
  res.setHeader('Content-Disposition', 'attachment; filename=satistics.csv')
  if (id && csvRequest === CsvRequest.FULL_REPORT && csvRequestStatus === CsvRequestStatus.FULL_REPORT && fs.existsSync(fname)) {
    fs.createReadStream(fname).pipe(res)
      .on('error', () => res.status(500).end())
      .on('finish', async () => {
        res.status(200).end()
        await apollo.mutate({
          mutation: gql`
            mutation csvRequest($csvRequest: CsvRequest!) {
              csvRequest(csvRequest: $csvRequest)
            }`,
          variables: { csvRequest: CsvRequest.NO_REQUEST },
          update:
            function update (cache) {
              cache.modify({
                id: `User:${id}`,
                fields: {
                  csvRequest: () => CsvRequest.NO_REQUEST
                }
              })
            }
        })
      })
  } else {
    res.status(400).end()
  }
}
