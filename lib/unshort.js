import uu from 'url-unshort'

// URL-unshort owns a separate Got transport, outside snFetch. Keep every hop
// away from Node's Brotli decoder until the runtime has CVE-2026-111497 fixed.
export default function createUnshortener () {
  return uu({
    request: {
      decompress: false,
      headers: { 'accept-encoding': 'identity' },
      hooks: {
        afterResponse: [response => {
          const encoding = response.headers['content-encoding']?.trim().toLowerCase()
          const bodyless = response.request.options.method === 'HEAD' || [204, 304].includes(response.statusCode)
          // Unrecognized labels do not imply compression; the client passed them through.
          const compressed = encoding?.split(',').some(coding => ['br', 'gzip', 'deflate', 'x-gzip', 'x-deflate'].includes(coding.trim()))
          if (!bodyless && compressed) {
            throw new Error('Encoded responses from untrusted endpoints are disabled')
          }
          return response
        }]
      }
    }
  })
}
