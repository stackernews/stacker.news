/* eslint-env jest */

require('@testing-library/jest-dom')
global.MessageChannel = require('worker_threads').MessageChannel
global.TextEncoder = require('util').TextEncoder
global.TextDecoder = require('util').TextDecoder

global.os = 'iOS'

jest.mock('next/router', () => require('next-router-mock'))
