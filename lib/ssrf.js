import dns from 'dns'
import ipaddr from 'ipaddr.js'

// server-side SSRF guard: refuse to open sockets to addresses that aren't globally
// routable unicast — loopback, RFC1918 private, link-local (incl. the 169.254.169.254
// cloud-metadata endpoint), CGNAT, multicast, reserved, and IPv6 transition ranges
// (NAT64, 6to4, teredo) are all rejected, as is anything we can't parse

// whether the SSRF guard is active. fail-closed: enforced everywhere except
// development, where localhost/docker wallets must keep working. shared by the
// runtime fetch guard (lib/fetch.js) and the config validators (lib/yup.js) so the
// two can't drift apart.
export function ssrfEnforced () {
  return process.env.NODE_ENV !== 'development'
}

export class SsrfError extends Error {
  constructor (address, range) {
    // generic message: this can bubble up into user-facing fetch errors
    super('refusing to connect to a non-public address')
    this.name = 'SsrfError'
    this.address = address
    this.range = range
  }
}

// throws SsrfError unless address is a globally routable unicast address.
// IPv4-mapped IPv6 is unwrapped first so ::ffff:127.0.0.1 is judged as 127.0.0.1.
export function assertPublicAddress (address) {
  let range
  try {
    let addr = ipaddr.parse(address)
    if (addr.kind() === 'ipv6' && addr.isIPv4MappedAddress()) {
      addr = addr.toIPv4Address()
    }
    range = addr.range()
  } catch {
    throw new SsrfError(address, 'unparseable')
  }
  if (range !== 'unicast') {
    throw new SsrfError(address, range)
  }
}

// the socket layer connects to IP-literal hosts directly without consulting any
// `lookup` option, so those must be validated before the request is made.
// accepts bracketed IPv6 literals as found in WHATWG URL hostnames ([::1]),
// and ipaddr also catches encodings like 2130706433 or 0x7f.0.0.1 that legacy
// url.parse leaves unnormalized on redirect hops
export function assertPublicHost (hostname) {
  const host = hostname.replace(/^\[|\]$/g, '')
  if (ipaddr.isValid(host)) assertPublicAddress(host)
}

// drop-in for the `lookup` option of net/tls sockets: resolves the hostname, then
// rejects unless every returned address is public, so the socket can only ever dial
// addresses we validated (closes the DNS-rebinding TOCTOU gap and prevents a private
// record hiding among public ones)
export function ssrfSafeLookup (hostname, options, callback) {
  if (typeof options === 'function') {
    callback = options
    options = {}
  }
  dns.lookup(hostname, { ...options, all: true, verbatim: true }, (err, addresses) => {
    if (err) return callback(err)
    if (addresses.length === 0) {
      const enotfound = new Error(`getaddrinfo ENOTFOUND ${hostname}`)
      enotfound.code = 'ENOTFOUND'
      return callback(enotfound)
    }
    try {
      for (const { address } of addresses) assertPublicAddress(address)
    } catch (ssrfErr) {
      return callback(ssrfErr)
    }
    if (options.all) return callback(null, addresses)
    callback(null, addresses[0].address, addresses[0].family)
  })
}
