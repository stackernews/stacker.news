#!/usr/bin/node

const Pageres = require('pageres')

async function captureUrl () {
  const streams = await new Pageres({ crop: true })
    .src(process.argv[2], ['600x314'])
    .run()
  process.stdout.write(streams[0], () => process.exit(0))
}

captureUrl()
