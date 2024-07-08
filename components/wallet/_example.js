import React from 'react'
import { lnbitsSchema } from '@/lib/validate'

// ~~~
// AFTER YOU HAVE FILLED OUT THIS TEMPLATE, IMPORT THIS FILE IN components/wallet/index.js
// AND ADD IT TO THE `WALLET_DEFS` array.
// DO THE SAME IN api/resolvers/wallet.js WITH THE `SERVER_WALLET_DEFS` ARRAY.
// (these arrays are separate to avoid backend imports in frontend)
// ~~~

// This name is used to identify this wallet and thus must be unique.
// It is used with the useWallet hook to select this wallet, see components/wallet/index.js.
// [required]
export const name = 'lnbits-as-an-example'

// The form to configure this wallet is generated from these fields,
// see the component <WalletFields /> in pages/settings/wallets/[wallet].js.
//
// If you need to include React code, you need to use React.createElement
// since the worker will also import this file and does not support JSX syntax.
//
// If not handled otherwise in <WalletFields />, field properties are simply
// passed into <ClientInput /> or <PasswordInput /> as props (component depends on 'type').
//
// For example, the following fields will generate a config in this shape (depending on user inputs):
//   {
//     url: 'https://demo.lnbits.com/',
//     adminKey: 'a47acd6feba4489e9e99b256b4ae9049'
//   }
// [required]
export const fields = [
  {
    name: 'url',
    label: 'lnbits url',
    // 'type' can be 'text' or 'password'
    type: 'text'
  },
  {
    name: 'adminKey',
    label: 'admin key',
    type: 'password'
    // see other wallets for more complex fields
  }
]

// Used to display information about this wallet to the user in the wallet list or during configuration,
// see components/wallet-card.js and pages/settings/wallets/[wallet].js.
// [required]
export const card = {
  title: 'LNbits',
  // as mentioned above, you need to use React.createElement instead of JSX for more complex content
  subtitle: React.createElement(
    React.Fragment,
    {},
    'use ',
    React.createElement('a', { href: 'https://lnbits.com/', target: '_blank', rel: 'noreferrer' }, 'LNbits'),
    ' for payments'),
  badges: ['send only', 'non-custodialish']
}

// The validation schema that will be used on the client and server during save
// [required]
export const schema = lnbitsSchema

// This optional function will be called during save to abort the save if the configuration is invalid.
// It receives the config and context as arguments.
// It must throw an error if validation fails.
// [optional]
export async function validate (config, context) {
  // what the config object will contain is determined by the fields array above
  // const { url, adminKey } = config

  // the context includes the logger and other useful stuff, see save method in components/wallet/index.js
  const { logger } = context

  // validate should log useful, wallet-specific information for the user
  logger.info('running some wallet-specific validation')

  // ...
  // throw error if validation failed
}

// If this wallet supports payments, you need to implement this function:
//
//   sendPayment: (bolt11, config, context) => Promise<{ preimage: string }>
//
// [required for payments]
export async function sendPayment (bolt11, config, context) {
  // ...
}

// If this wallet supports receiving, you need to implement this object.
// [required for receiving]
export const server = {
  // This must match a WalletType enum value in the database
  // since it will be used to fetch this wallet using the WALLET_BY_TYPE GraphQL query,
  // see `useServerConfig` in components/wallet/index.js.
  // [required]
  walletType: 'LNBITS',

  // This used must match a column of the 'Wallet' table
  // since it will be used to save the wallet configuration.
  // [required]
  walletField: 'walletLNbits',

  // This can be any name but it makes sense to use something appropriate here like 'upsertWallet<WalletName>'.
  // This is used to generate the mutation during save (see `generateMutation` in components/wallets/index.js)
  // and inject the corresponding resolver into the GraphQL schema
  // (see `injectResolvers` in pages/api/resolvers/wallet.js.).
  // [required]
  resolverName: 'upsertWalletLNbits',

  // Similar to validate above, this function should throw an error if the connection test fails.
  // It is called on save on the server before writing the configuration to the database.
  // As the name suggests, a good idea is to try to connect to the wallet and create an invoice in this function.
  // [required]
  testConnect: async (
    // Wallet configuration as entered by the user
    config,
    // Context object with useful stuff, see `injectResolvers` in pages/api/resolvers/wallet.js.
    {
      me,
      models,
      addWalletLog,
      lnService: { authenticatedLndGrpc, createInvoice },
      cln: { createInvoice: clnCreateInvoice }
    }
  ) => {

    // ...
    // throw error if validation failed
    // (logging errors is handled by calling context but you can add custom logging on success here)
  },

  // This function is called during autowithdrawals.
  // It should return a bolt11 payment request.
  //
  // createInvoice: ({ amount, maxFee }, config, context) => Promise<bolt11>
  //
  createInvoice: async (
    { amount, maxFee },
    { socket, rune, cert },
    // Context object with useful stuff, see `autowithdraw` function in worker/autowithdraw.js.
    {
      me,
      models,
      // SN LND node instance
      lnd,
      lnService: {
        authenticatedLndGrpc,
        createInvoice: lndCreateInvoice,
        getIdentity,
        decodePaymentRequest
      },
      cln: {
        createInvoice: clnCreateInvoice
      }
    }
  ) => {
    // ... create invoice and return bolt11 that the SN node will pay
  }
}
