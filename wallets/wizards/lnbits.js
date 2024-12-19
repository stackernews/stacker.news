import { bytesToHex } from '@noble/curves/abstract/utils'
import { getPublicKey, generateSecretKey } from 'nostr-tools'
export const title = 'lnbits'
export const authors = []
export const icon = ''
export const description = 'LNBits wallet'

async function callApi ({ url, method, endpoint, adminKey, data }) {
  let fullUrl = `${url}/${endpoint}`
  if (method === 'GET') {
    fullUrl = data ? `${fullUrl}?${new URLSearchParams(data)}` : fullUrl
  } else {
    data = JSON.stringify(data)
  }
  const args = {
    method,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-Api-Key': adminKey
    },
    body: method !== 'GET' ? data : undefined
  }
  console.log(fullUrl, JSON.stringify(args), adminKey)
  const res = await fetch(fullUrl, args)
  if (!res.ok) {
    const errBody = await res.json()
    throw new Error(errBody.detail)
  }
  return res.json()
}

const initial = async (stepsData, wallets) => {
  return {
    name: 'initial',
    title: 'Input the url and admin key',
    description: '',
    fields: [
      {
        name: 'url',
        label: 'Input the url',
        type: 'text',
        autoComplete: 'off'
      },
      {
        name: 'adminKey',
        label: 'Input the Admin Key',
        type: 'password',
        autoComplete: 'off'
      }
    ]
  }
}

const selectMethod = async (stepsData, wallets) => {
  const supportedMethods = [
    'lnbits'
  ]

  try {
    await callApi({
      url: stepsData.initial.url,
      method: 'GET',
      endpoint: 'nwcprovider/api/v1/nwc',
      adminKey: stepsData.initial.adminKey
    })
    supportedMethods.push('nwc')
  } catch (e) {
    console.warn('nwc not available')
  }

  return {
    name: 'selectMethod',
    title: 'Select Method',
    description: '',
    fields: [
      {
        name: 'method',
        label: 'Select the method',
        type: 'select',
        items: supportedMethods
      }
    ]
  }
}

const setup = async (stepsData, wallets) => {
  const selectedMethod = stepsData.selectMethod.method
  if (selectedMethod === 'lnbits') {
    const lnbitsWallets = await callApi({
      url: stepsData.initial.url,
      method: 'GET',
      endpoint: '/api/v1/wallets',
      adminKey: stepsData.initial.adminKey
    })
    const lnbitWallet = lnbitsWallets.find(w => w.adminkey === stepsData.initial.adminKey)
    if (!lnbitWallet) {
      return {
        name: 'setup',
        title: 'Error',
        description: 'No wallet found with the provided admin key',
        fields: []
      }
    }
    const invoiceKey = lnbitWallet.invoicekey
    stepsData.setup = { invoiceKey, adminKey: stepsData.initial.adminKey }
    return {
      name: 'setup',
      title: 'Found invoice key',
      description: `Connecting wallet with invoice key ${invoiceKey}`,
      fields: []
    }
  } else if (selectedMethod === 'nwc') {
    stepsData.setup = {}
    { // sender
      const secret = generateSecretKey()
      const publicKey = getPublicKey(secret)
      await callApi({
        url: stepsData.initial.url,
        method: 'PUT',
        endpoint: 'nwcprovider/api/v1/nwc/' + publicKey,
        adminKey: stepsData.initial.adminKey,
        data: {
          permissions: [
            'pay_invoice'
          ],
          description: 'StackerNews sender'
        }
      })
      stepsData.setup.nwcUrl = (await callApi({
        url: stepsData.initial.url,
        method: 'GET',
        endpoint: 'nwcprovider/api/v1/pairing/{SECRET}',
        adminKey: stepsData.initial.adminKey
      }).then(res => res.text())).replace('{SECRET}', bytesToHex(secret))
    }
    { // receiver
      const secret = generateSecretKey()
      const publicKey = getPublicKey(secret)
      await callApi({
        url: stepsData.initial.url,
        method: 'PUT',
        endpoint: 'nwcprovider/api/v1/nwc/' + publicKey,
        adminKey: stepsData.initial.adminKey,
        data: {
          permissions: [
            'make_invoice'
          ],
          description: 'StackerNews receiver'
        }
      })
      stepsData.setup.nwcUrlRecv = (await callApi({
        url: stepsData.initial.url,
        method: 'GET',
        endpoint: 'nwcprovider/api/v1/pairing/{SECRET}',
        adminKey: stepsData.initial.adminKey
      }).then(res => res.text())).replace('{SECRET}', bytesToHex(secret))
    }

    return {
      name: 'setup',
      title: 'Found NWC urls',
      description: `Connecting wallet with NWC urls ${stepsData.setup.nwcUrl} and ${stepsData.setup.nwcUrlRecv}`,
      fields: []
    }
  } else {
    throw new Error('Unknown method')
  }
}

const connect = async (stepsData, wallets) => {
  const selectedMethod = stepsData.selectMethod.method
  const url = stepsData.initial.url

  if (selectedMethod === 'lnbits') {
    const { invoiceKey, adminKey } = stepsData.setup
    await wallets.connect(
      'lnbits', // connector
      { // fields
        url,
        invoiceKey,
        adminKey
      },
      'lnbits' // label
    )
  } else if (selectedMethod === 'nwc') {
    const { nwcUrl, nwcUrlRecv } = stepsData.setup
    await wallets.connect(
      'nwc', // connector
      { // fields
        nwcUrl,
        nwcUrlRecv
      },
      'lnbits' // label
    )
  }
}

export const steps = [initial, selectMethod, setup, connect]
