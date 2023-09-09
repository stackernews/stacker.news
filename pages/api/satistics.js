import fs from 'fs'
import getSSRApolloClient from '../../api/ssrApollo'
import { ME } from '../../fragments/users'
import { CsvStatus } from '../../lib/constants'
import { gql } from '@apollo/client'
import path from 'path'

export default async function handler (req, res) {
  const apollo = await getSSRApolloClient({ req, res })
  const { data: { me } } = await apollo.query({ query: ME })
  const fname = path.join(process.env.CSV_PATH, `satistics_${me?.id}.csv`)
  res.setHeader('Content-Type', 'text/csv')
  res.setHeader('Content-Disposition', 'attachment; filename=satistics.csv')
  if (me?.requestingCsv && me.csvStatus === CsvStatus.DONE && fs.existsSync(fname)) {
    fs.createReadStream(fname).pipe(res)
      .on('error', () => { res.status(500).end() })
      .on('finish', () => { res.status(200).end() })
  } else {
    res.status(400).end()
  }
  await apollo.mutate({
    mutation: gql`
      mutation requestingCsv($value: Boolean!) {
        requestingCsv(value: $value)
      }`,
    variables: { value: false },
    update:
      function update (cache) {
        cache.modify({
          id: `User:${me.id}`,
          fields: {
            requestingCsv: () => false
          }
        })
      }
  })
}
