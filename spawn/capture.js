#!/usr/bin/node

const Pageres = require('pageres')

async function captureUrl () {
  try {
    const streams = await new Pageres({ crop: true, delay: 1, scale: 2, timeout: 10, launchOptions: { args: ['--single-process'] } })
      .src(process.argv[2], ['600x315'])
      .run()
    process.stdout.write(streams[0], () => process.exit(0))
  } catch (e) {
    console.log(e)
    process.exit(1)
  }
}

captureUrl()
