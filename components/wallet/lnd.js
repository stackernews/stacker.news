import React from 'react'

import { ensureB64 } from '@/lib/format'
import { datePivot } from '@/lib/time'
import { LNDAutowithdrawSchema } from '@/lib/validate'

export const name = 'lnd'

export const fields = [
  {
    name: 'socket',
    label: 'grpc host and port',
    type: 'text',
    placeholder: '55.5.555.55:10001',
    hint: 'tor or clearnet',
    clear: true
  },
  {
    name: 'macaroon',
    label: 'invoice macaroon',
    help: {
      label: 'privacy tip',
      text: 'We accept a prebaked ***invoice.macaroon*** for your convenience. To gain better privacy, generate a new macaroon as follows:\n\n```lncli bakemacaroon invoices:write invoices:read```'
    },
    type: 'text',
    placeholder: 'AgEDbG5kAlgDChCn7YgfWX7uTkQQgXZ2uahNEgEwGhYKB2FkZHJlc3MSBHJlYWQSBXdyaXRlGhcKCGludm9pY2VzEgRyZWFkEgV3cml0ZRoPCgdvbmNoYWluEgRyZWFkAAAGIJkMBrrDV0npU90JV0TGNJPrqUD8m2QYoTDjolaL6eBs',
    hint: 'hex or base64 encoded',
    clear: true
  },
  {
    name: 'cert',
    label: 'cert',
    type: 'text',
    placeholder: 'LS0tLS1CRUdJTiBDRVJUSUZJQ0FURS0tLS0tCk1JSUNNVENDQWRpZ0F3SUJBZ0lRSHBFdFdrcGJwZHV4RVF2eVBPc3NWVEFLQmdncWhrak9QUVFEQWpBdk1SOHcKSFFZRFZRUUtFeFpzYm1RZ1lYVjBiMmRsYm1WeVlYUmxaQ0JqWlhKME1Rd3dDZ1lEVlFRREV3TmliMkl3SGhjTgpNalF3TVRBM01qQXhORE0wV2hjTk1qVXdNekF6TWpBeE5ETTBXakF2TVI4d0hRWURWUVFLRXhac2JtUWdZWFYwCmIyZGxibVZ5WVhSbFpDQmpaWEowTVF3d0NnWURWUVFERXdOaWIySXdXVEFUQmdjcWhrak9QUUlCQmdncWhrak8KUFFNQkJ3TkNBQVJUS3NMVk5oZnhqb1FLVDlkVVdDbzUzSmQwTnBuL1BtYi9LUE02M1JxbU52dFYvdFk4NjJJZwpSbE41cmNHRnBEajhUeFc2OVhIK0pTcHpjWDdlN3N0Um80SFZNSUhTTUE0R0ExVWREd0VCL3dRRUF3SUNwREFUCkJnTlZIU1VFRERBS0JnZ3JCZ0VGQlFjREFUQVBCZ05WSFJNQkFmOEVCVEFEQVFIL01CMEdBMVVkRGdRV0JCVDAKMnh3V25GeHRUNzI0MWxwZlNoNm9FWi9UMWpCN0JnTlZIUkVFZERCeWdnTmliMktDQ1d4dlkyRnNhRzl6ZElJRApZbTlpZ2d4d2IyeGhjaTF1TVMxaWIyS0NGR2h2YzNRdVpHOWphMlZ5TG1sdWRHVnlibUZzZ2dSMWJtbDRnZ3AxCmJtbDRjR0ZqYTJWMGdnZGlkV1pqYjI1dWh3Ui9BQUFCaHhBQUFBQUFBQUFBQUFBQUFBQUFBQUFCaHdTc0VnQUQKTUFvR0NDcUdTTTQ5QkFNQ0EwY0FNRVFDSUEwUTlkRXdoNXpPRnpwL3hYeHNpemh5SkxNVG5yazU1VWx1NHJPRwo4WW52QWlBVGt4U3p3Y3hZZnFscGx0UlNIbmd0NUJFcDBzcXlHL05nenBzb2pmMGNqQT09Ci0tLS0tRU5EIENFUlRJRklDQVRFLS0tLS0K',
    // worker does not support JSX syntax
    optional: React.createElement(
      React.Fragment,
      {},
      'optional if from ',
      React.createElement('a', { href: 'https://en.wikipedia.org/wiki/Certificate_authority', target: '_blank', rel: 'noreferrer' }, 'CA'),
      ' (e.g. voltage)'),
    clear: true
  }
]

export const card = {
  title: 'LND',
  subtitle: 'autowithdraw to your Lightning Labs node',
  badges: ['receive only', 'non-custodial']
}

export const schema = LNDAutowithdrawSchema

export const server = {
  walletType: 'LND',
  walletField: 'walletLND',
  resolverName: 'upsertWalletLND',
  testConnect: async (
    { cert, macaroon, socket },
    { me, models, addWalletLog, lnService: { authenticatedLndGrpc, createInvoice } }
  ) => {
    try {
      cert = ensureB64(cert)
      macaroon = ensureB64(macaroon)

      const { lnd } = await authenticatedLndGrpc({
        cert,
        macaroon,
        socket
      })

      const inv = await createInvoice({
        description: 'SN connection test',
        lnd,
        tokens: 0,
        expires_at: new Date()
      })

      // we wrap both calls in one try/catch since connection attempts happen on RPC calls
      await addWalletLog({ wallet: { type: 'LND' }, level: 'SUCCESS', message: 'connected to LND' }, { me, models })

      return inv
    } catch (err) {
      // LND errors are in this shape: [code, type, { err: { code, details, metadata } }]
      const details = err[2]?.err?.details || err.message || err.toString?.()
      throw new Error(details)
    }
  },
  createInvoice: async (
    amount,
    { cert, macaroon, socket },
    { me, lnService: { authenticatedLndGrpc, createInvoice } }
  ) => {
    const { lnd } = await authenticatedLndGrpc({
      cert,
      macaroon,
      socket
    })

    const invoice = await createInvoice({
      description: me.hideInvoiceDesc ? undefined : 'autowithdraw to LND from SN',
      lnd,
      tokens: amount,
      expires_at: datePivot(new Date(), { seconds: 360 })
    })

    return invoice.request
  }
}