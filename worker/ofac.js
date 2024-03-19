import { createReadStream, createWriteStream, unlinkSync } from 'fs'
import unzipper from 'unzipper'
import csvParser from 'csv-parser'
import stream from 'stream'
import { SANCTIONED_COUNTRY_CODES } from '@/lib/constants.js'

const IPV4_URL = 'https://ipapi.is/data/geolocationDatabaseIPv4.csv.zip'
const IPV6_URL = 'https://ipapi.is/data/geolocationDatabaseIPv6.csv.zip'

export async function ofac ({ models }) {
  const ipv4CSVPath = 'ipv4.temp.csv'
  const ipv6CSVPath = 'ipv6.temp.csv'

  async function loadCSVIntoDatabase (csvFilePath) {
    const results = []

    return new Promise((resolve, reject) => {
      createReadStream(csvFilePath)
        .pipe(csvParser())
        .on('data', (data) => {
          if (SANCTIONED_COUNTRY_CODES.includes(data.country_code)) {
            results.push({
              startIP: data.start_ip,
              endIP: data.end_ip,
              country: data.country,
              countryCode: data.country_code
            })
          }
        })
        .on('end', async () => {
          console.log('results', results.length)
          await models.$queryRaw`
            INSERT INTO "OFAC" ("startIP", "endIP", "country", "countryCode")
            SELECT "startIP", "endIP", "country", "countryCode" FROM json_populate_recordset(null::"OFAC", ${JSON.stringify(results)}::JSON)`
          console.log('Data imported into the database')
          resolve()
        })
        .on('error', reject)
    })
  }

  try {
    await downloadAndUnzipCSV(IPV4_URL, ipv4CSVPath)
    await downloadAndUnzipCSV(IPV6_URL, ipv6CSVPath)
    await models.$executeRaw`TRUNCATE TABLE "OFAC"`
    await loadCSVIntoDatabase(ipv4CSVPath)
    await loadCSVIntoDatabase(ipv6CSVPath)
  } finally {
    unlinkSync(ipv4CSVPath)
    unlinkSync(ipv6CSVPath)
  }
}

async function downloadAndUnzipCSV (url, outputFilePath) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Failed to fetch: ${response.statusText}`)

  return new Promise((resolve, reject) => {
    stream.Readable.fromWeb(response.body)
      .pipe(unzipper.Parse())
      .on('entry', function (entry) {
        console.log('Extracting', entry.path)
        if (entry.path.endsWith('.csv')) {
          const fileStream = createWriteStream(outputFilePath)
          entry.pipe(fileStream)
          fileStream.on('finish', () => {
            console.log('File write completed:', outputFilePath)
            resolve()
          })
          fileStream.on('error', reject)
        } else {
          entry.autodrain()
        }
      })
      .on('error', reject)
  })
}
