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
        console.log('\n' + '='.repeat(60))
        console.log(`RECIPIENT: ${recipient}`)
        console.log(`Total amount: ${formatAmount(group.totalAmount)}`)
        console.log(`Number of awards: ${group.awards.length}`)
        console.log('='.repeat(60))

        console.log('\nAwards breakdown:')
        for (const award of group.awards) {
          console.log(`- ${award.name}: ${award.type} | ${formatAmount(parseAmount(award.amount))} (${award.amount})`)
        }

        // Ask for payment mode for this specific recipient
        console.log('\nPayment options for this recipient:')
        console.log('1. Consolidated: Pay all awards in one payment')
        console.log('2. Individual: Pay each award separately')
        console.log('3. Skip: Skip this recipient entirely')

        const paymentChoice = await promptInput('Choose option (1, 2, or 3): ')

        if (paymentChoice === '3') {
          console.log('Skipping this recipient.')
          continue
        }

        const payIndividually = paymentChoice === '2'

        if (payIndividually) {
          console.log('\n--- INDIVIDUAL PAYMENT MODE ---')

          // Process each award individually for this recipient
          for (let i = 0; i < group.awards.length; i++) {
            const award = group.awards[i]
            const amount = parseAmount(award.amount)

            console.log(`\n--- Award ${i + 1} of ${group.awards.length} for ${recipient} ---`)
            console.log(`Name: ${award.name}`)
            console.log(`Type: ${award.type}`)
            console.log(`Amount: ${formatAmount(amount)} (${award.amount})`)
            console.log(`Original recipient: ${recipient}`)

            console.log('\nPayment options for this award:')
            console.log('1. Pay to original address')
            console.log('2. Pay to alternative address')
            console.log('3. Skip this award')

            const paymentOption = await promptInput('Choose option (1, 2, or 3): ')

            if (paymentOption === '3') {
              console.log('Award skipped.')
              continue
            }

            let actualRecipient = recipient
            if (paymentOption === '2') {
              actualRecipient = await promptInput('Enter alternative lightning address or receive method: ')
              if (!actualRecipient || actualRecipient.trim() === '') {
                console.log('No alternative address provided. Award skipped.')
                continue
              }
              console.log(`Using alternative recipient: ${actualRecipient}`)
            }

            try {
              console.log(`Sending ${formatAmount(amount)} to ${actualRecipient}...`)

              // Get today's date (YYYY-MM-DD) for updating records
              const today = new Date()
              const formattedDate = today.toISOString().split('T')[0]
              let paymentSuccessful = false

              // Check if recipient is a Lightning address or a BOLT11 invoice
              if (actualRecipient.includes('@')) {
                // Handle Lightning address
                const comment = `Award: ${award.name} (${award.type}) - see https://github.com/stackernews/stacker.news/blob/master/awards.csv`
                console.log('Getting invoice from Lightning address...')
                const invoice = await getInvoiceFromLnAddress(actualRecipient, amount, comment)
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
                console.log(`For award: ${award.name} (${award.type})`)
                console.log(`Recipient: ${actualRecipient}`)
                const invoice = await promptInput(`Enter BOLT11 invoice for ${formatAmount(amount)}: `)

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

              // Update this specific award with the payment date if successful
              if (paymentSuccessful) {
                award['date paid'] = formattedDate
                // Update the receive method if an alternative was used
                if (paymentOption === '2') {
                  award['receive method'] = actualRecipient
                  console.log(`Award for ${award.name} marked as paid with updated recipient: ${actualRecipient}`)
                } else {
                  console.log(`Award for ${award.name} marked as paid.`)
                }
              }
            } catch (error) {
              console.error('Error making payment:', error)
            }
          }
        } else {
          console.log('\n--- CONSOLIDATED PAYMENT MODE ---')

          console.log('\nConsolidated payment options:')
          console.log('1. Pay to original address (consolidated)')
          console.log('2. Pay to alternative address (consolidated)')
          console.log('3. Switch to individual mode for this recipient')
          console.log('4. Skip this recipient')

          const consolidatedOption = await promptInput('Choose option (1, 2, 3, or 4): ')

          if (consolidatedOption === '4') {
            console.log('Recipient skipped.')
            continue
          }

          if (consolidatedOption === '3') {
            console.log('\n--- SWITCHING TO INDIVIDUAL PAYMENT MODE ---')

            // Process each award individually for this recipient
            for (let i = 0; i < group.awards.length; i++) {
              const award = group.awards[i]
              const amount = parseAmount(award.amount)

              console.log(`\n--- Award ${i + 1} of ${group.awards.length} for ${recipient} ---`)
              console.log(`Name: ${award.name}`)
              console.log(`Type: ${award.type}`)
              console.log(`Amount: ${formatAmount(amount)} (${award.amount})`)
              console.log(`Original recipient: ${recipient}`)

              console.log('\nPayment options for this award:')
              console.log('1. Pay to original address')
              console.log('2. Pay to alternative address')
              console.log('3. Skip this award')

              const paymentOption = await promptInput('Choose option (1, 2, or 3): ')

              if (paymentOption === '3') {
                console.log('Award skipped.')
                continue
              }

              let actualRecipient = recipient
              if (paymentOption === '2') {
                actualRecipient = await promptInput('Enter alternative lightning address or receive method: ')
                if (!actualRecipient || actualRecipient.trim() === '') {
                  console.log('No alternative address provided. Award skipped.')
                  continue
                }
                console.log(`Using alternative recipient: ${actualRecipient}`)
              }

              try {
                console.log(`Sending ${formatAmount(amount)} to ${actualRecipient}...`)

                // Get today's date (YYYY-MM-DD) for updating records
                const today = new Date()
                const formattedDate = today.toISOString().split('T')[0]
                let paymentSuccessful = false

                // Check if recipient is a Lightning address or a BOLT11 invoice
                if (actualRecipient.includes('@')) {
                  // Handle Lightning address
                  const comment = `Award: ${award.name} (${award.type}) - see https://github.com/stackernews/stacker.news/blob/master/awards.csv`
                  console.log('Getting invoice from Lightning address...')
                  const invoice = await getInvoiceFromLnAddress(actualRecipient, amount, comment)
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
                  console.log(`For award: ${award.name} (${award.type})`)
                  console.log(`Recipient: ${actualRecipient}`)
                  const invoice = await promptInput(`Enter BOLT11 invoice for ${formatAmount(amount)}: `)

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

                // Update this specific award with the payment date if successful
                if (paymentSuccessful) {
                  award['date paid'] = formattedDate
                  // Update the receive method if an alternative was used
                  if (paymentOption === '2') {
                    award['receive method'] = actualRecipient
                    console.log(`Award for ${award.name} marked as paid with updated recipient: ${actualRecipient}`)
                  } else {
                    console.log(`Award for ${award.name} marked as paid.`)
                  }
                }
              } catch (error) {
                console.error('Error making payment:', error)
              }
            }
            continue
          }

          let actualRecipient = recipient
          if (consolidatedOption === '2') {
            actualRecipient = await promptInput('Enter alternative lightning address or receive method for all awards: ')
            if (!actualRecipient || actualRecipient.trim() === '') {
              console.log('No alternative address provided. Recipient skipped.')
              continue
            }
            console.log(`Using alternative recipient: ${actualRecipient}`)
          }

          try {
            console.log(`Sending ${formatAmount(group.totalAmount)} to ${actualRecipient}...`)

            // Get today's date (YYYY-MM-DD) for updating records
            const today = new Date()
            const formattedDate = today.toISOString().split('T')[0]
            let paymentSuccessful = false

            // Check if recipient is a Lightning address or a BOLT11 invoice
            if (actualRecipient.includes('@')) {
              // Handle Lightning address
              const comment = 'see https://github.com/stackernews/stacker.news/blob/master/awards.csv'
              console.log('Getting invoice from Lightning address...')
              const invoice = await getInvoiceFromLnAddress(actualRecipient, group.totalAmount, comment)
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
              console.log(`For recipient: ${actualRecipient}`)
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
                // Update the receive method if an alternative was used
                if (consolidatedOption === '2') {
                  award['receive method'] = actualRecipient
                }
              }
              if (consolidatedOption === '2') {
                console.log(`All awards marked as paid with updated recipient: ${actualRecipient}`)
              } else {
                console.log('All awards marked as paid.')
              }
            }
          } catch (error) {
            console.error('Error making payment:', error)
          }
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
