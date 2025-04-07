#!/usr/bin/env node

const { execSync } = require('child_process')
module.paths.push(execSync('npm config get prefix').toString().trim() + '/lib/node_modules')
const fs = require('fs')
const path = require('path')
const csv = require('csv-parser')
const { createObjectCsvWriter } = require('csv-writer')
const readline = require('readline')
const fetch = require('node-fetch')
const ws = require('isomorphic-ws')

// Add WebSocket polyfill for Node.js
if (typeof WebSocket === 'undefined') {
  global.WebSocket = ws
}

const { nwc } = require('@getalby/sdk')

// Ask for confirmation
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

// Path to awards.csv file
const csvPath = path.join(__dirname, '..', 'awards.csv')
// Path to config file
const configPath = path.join(__dirname, 'pay-awards.config.json')

// Function to parse amount with abbreviations (k, m)
const parseAmount = (amountStr) => {
  if (!amountStr) return 0

  // Convert to string to handle cases where it might already be a number
  amountStr = String(amountStr).trim()

  if (amountStr.toLowerCase().endsWith('k')) {
    // Handle thousands (e.g., "20k" -> 20000)
    return parseFloat(amountStr.slice(0, -1)) * 1000
  } else if (amountStr.toLowerCase().endsWith('m')) {
    // Handle millions (e.g., "1m" -> 1000000)
    return parseFloat(amountStr.slice(0, -1)) * 1000000
  } else {
    // Handle plain numbers
    return parseFloat(amountStr) || 0
  }
}

// Function to format amounts with sats unit
const formatAmount = (amount) => `${amount.toLocaleString()} sats`

// Function to prompt user for confirmation
const confirm = (question) => {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes')
    })
  })
}

// Function to get invoice from Lightning address
async function getInvoiceFromLnAddress (lnAddress, amount, comment) {
  try {
    // Extract domain and username from the ln address
    const [username, domain] = lnAddress.split('@')

    // Fetch the Lightning Address metadata
    const response = await fetch(`https://${domain}/.well-known/lnurlp/${username}`)
    if (!response.ok) {
      throw new Error(`Failed to fetch Lightning Address info: ${response.statusText}`)
    }

    const lnurlData = await response.json()

    // Check if callback URL exists
    if (!lnurlData.callback) {
      throw new Error('No callback URL found in Lightning Address metadata')
    }

    // Build the callback URL with parameters
    const callbackUrl = new URL(lnurlData.callback)
    callbackUrl.searchParams.append('amount', amount * 1000) // Convert sats to msats

    if (comment && lnurlData.commentAllowed > 0) {
      callbackUrl.searchParams.append('comment', comment)
    }

    // Call the callback URL to get the invoice
    const invoiceResponse = await fetch(callbackUrl.toString())
    if (!invoiceResponse.ok) {
      throw new Error(`Failed to get invoice: ${invoiceResponse.statusText}`)
    }

    const invoiceData = await invoiceResponse.json()

    if (!invoiceData.pr) {
      throw new Error('No invoice received from Lightning Address')
    }

    return invoiceData.pr
  } catch (error) {
    console.error(`Error getting invoice from ${lnAddress}:`, error)
    throw error
  }
}

// Function to prompt user for input
const promptInput = (question) => {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer)
    })
  })
}

// Pay an invoice using NWC
async function payInvoice (nwcClient, invoice) {
  try {
    const payResult = await nwcClient.payInvoice({ invoice })
    return payResult
  } catch (e) {
    console.error('Error in payInvoice:', e)
    throw e
  }
}

async function main () {
  // Read NWC URL from config file
  let nwcUrl
  let dryRun = false
  let nwcClient = null

  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'))
    nwcUrl = config.nwcUrl

    if (!nwcUrl || nwcUrl === 'YOUR_NWC_URL_HERE') {
      console.log('No valid NWC URL found in config - running in DRY RUN mode')
      console.log('No payments will be made, but you can see what would be paid')
      dryRun = true
    }
  } catch (error) {
    console.error('Error reading config file:', error)
    console.log('Running in DRY RUN mode - no payments will be made')
    dryRun = true
  }

  // Initialize NWC client if not in dry run mode
  if (!dryRun) {
    try {
      // Create NWC client using the exact structure from the documentation
      nwcClient = new nwc.NWCClient({
        nostrWalletConnectUrl: nwcUrl
      })
      console.log('NWC initialized successfully')
    } catch (error) {
      console.error('Failed to initialize NWC client:', error)
      console.log('Running in DRY RUN mode - no payments will be made')
      dryRun = true
    }
  }

  // Read the awards.csv file
  const rows = []
  let pendingAwards = 0
  let totalAmount = 0
  const recipientGroups = new Map()

  fs.createReadStream(csvPath)
    .pipe(csv())
    .on('data', (row) => {
      rows.push(row)
      if (row['date paid'] === '???') {
        pendingAwards++
        const amount = parseAmount(row.amount)
        totalAmount += amount

        // Group awards by recipient
        const recipient = row['receive method']
        if (recipient && recipient !== '???') {
          if (!recipientGroups.has(recipient)) {
            recipientGroups.set(recipient, {
              awards: [],
              totalAmount: 0
            })
          }
          const group = recipientGroups.get(recipient)
          group.awards.push(row)
          group.totalAmount += amount
        }
      }
    })
    .on('end', async () => {
      console.log(`Found ${pendingAwards} unpaid awards totaling ${formatAmount(totalAmount)}`)

      if (pendingAwards === 0) {
        console.log('No pending awards to pay.')
        rl.close()
        return
      }

      if (dryRun) {
        console.log('\n=== DRY RUN SUMMARY ===')
        console.log('RECIPIENT | TOTAL AMOUNT | NUMBER OF AWARDS')
        console.log('----------|--------------|----------------')
        for (const [recipient, group] of recipientGroups.entries()) {
          console.log(`${recipient} | ${formatAmount(group.totalAmount)} | ${group.awards.length}`)
        }

        console.log('\nDETAILED BREAKDOWN BY RECIPIENT:')
        for (const [recipient, group] of recipientGroups.entries()) {
          console.log(`\n${recipient} (${formatAmount(group.totalAmount)}):`)
          for (const award of group.awards) {
            console.log(`- ${award.name}: ${award.type} | ${formatAmount(parseAmount(award.amount))} (${award.amount})`)
          }
        }

        // Show what changes would be made to awards.csv
        const today = new Date()
        const formattedDate = today.toISOString().split('T')[0]
        console.log('\n=== CSV CHANGES PREVIEW ===')
        console.log('The following changes would be made to awards.csv:')
        console.log('NAME | TYPE | AMOUNT | RECIPIENT | CURRENT DATE PAID | NEW DATE PAID')
        console.log('-----|------|--------|-----------|-------------------|-------------')
        for (const [recipient, group] of recipientGroups.entries()) {
          for (const award of group.awards) {
            console.log(`${award.name} | ${award.type} | ${award.amount} | ${recipient} | ${award['date paid']} | ${formattedDate}`)
          }
        }

        console.log(`\nTotal: ${formatAmount(totalAmount)} across ${pendingAwards} awards to ${recipientGroups.size} unique recipients`)
        console.log('To make actual payments, update your pay-awards.config.json with a valid NWC URL')
        rl.close()
        return
      }

      // Process each recipient group
      for (const [recipient, group] of recipientGroups.entries()) {
        console.log('\nPending awards for recipient:')
        console.log(`Recipient: ${recipient}`)
        console.log(`Total amount: ${formatAmount(group.totalAmount)}`)
        console.log(`Number of awards: ${group.awards.length}`)

        console.log('\nAwards breakdown:')
        for (const award of group.awards) {
          console.log(`- ${award.name}: ${award.type} | ${formatAmount(parseAmount(award.amount))} (${award.amount})`)
        }

        const shouldPay = await confirm('Pay this consolidated award? (y/n): ')

        if (shouldPay) {
          try {
            console.log(`Sending ${formatAmount(group.totalAmount)} to ${recipient}...`)

            // Get today's date (YYYY-MM-DD) for updating records
            const today = new Date()
            const formattedDate = today.toISOString().split('T')[0]
            let paymentSuccessful = false

            // Check if recipient is a Lightning address or a BOLT11 invoice
            if (recipient.includes('@')) {
              // Handle Lightning address
              const comment = 'see https://github.com/stackernews/stacker.news/blob/master/awards.csv'
              console.log('Getting invoice from Lightning address...')
              const invoice = await getInvoiceFromLnAddress(recipient, group.totalAmount, comment)
              console.log('Invoice received, making payment...')

              // Use @getalby/sdk to pay the invoice
              const payResult = await payInvoice(nwcClient, invoice)

              if (payResult && payResult.preimage) {
                console.log('Payment successful!')
                console.log(`Preimage: ${payResult.preimage}`)
                paymentSuccessful = true
              } else {
                console.error('Payment failed:', payResult)
              }
            } else {
              // Not a Lightning address, prompt for BOLT11 invoice
              console.log(`For recipient: ${recipient}`)
              const invoice = await promptInput(`Enter BOLT11 invoice for ${formatAmount(group.totalAmount)}: `)

              if (!invoice || invoice.trim() === '') {
                console.log('No invoice provided. Payment skipped.')
                continue
              }

              // Handle BOLT11 invoice
              console.log('Making payment to BOLT11 invoice...')
              const payResult = await payInvoice(nwcClient, invoice)

              if (payResult && payResult.preimage) {
                console.log('Payment successful!')
                console.log(`Preimage: ${payResult.preimage}`)
                paymentSuccessful = true
              } else {
                console.error('Payment failed:', payResult)
              }
            }

            // Update all awards in this group with the payment date if successful
            if (paymentSuccessful) {
              for (const award of group.awards) {
                award['date paid'] = formattedDate
              }
            }
          } catch (error) {
            console.error('Error making payment:', error)
          }
        } else {
          console.log('Payment skipped.')
        }
      }

      // Write the updated CSV file
      const csvWriter = createObjectCsvWriter({
        path: csvPath,
        header: Object.keys(rows[0]).map(key => ({ id: key, title: key }))
      })

      try {
        await csvWriter.writeRecords(rows)
        console.log('\nCSV file updated successfully with payment dates.')
      } catch (error) {
        console.error('Error updating CSV file:', error)
      }

      rl.close()
    })
}

// Handle cleanup
rl.on('close', () => {
  console.log('\nPayment process completed.')
  process.exit(0)
})

main().catch(error => {
  console.error('Error in main process:', error)
  rl.close()
})
