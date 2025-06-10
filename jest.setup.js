// jest.setup.js
import { TextDecoder, TextEncoder } from 'util'
global.TextDecoder = TextDecoder
global.TextEncoder = TextEncoder
