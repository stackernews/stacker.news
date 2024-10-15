import { GqlAuthorizationError } from '@/lib/error'

// this function makes america more secure apparently
export default async function assertGofacYourself ({ models, headers, ip }) {
  const country = await gOFACYourself({ models, headers, ip })
  if (!country) return

  throw new GqlAuthorizationError(`Your IP address is in ${country}. We cannot provide financial services to residents of ${country}.`)
}

export async function gOFACYourself ({ models, headers = {}, ip }) {
  const { 'x-forwarded-for': xForwardedFor, 'x-real-ip': xRealIp } = headers
  ip ||= xRealIp || xForwardedFor?.split(',')?.[0]
  if (!ip) return false

  try {
    const countries = await models.$queryRaw`
      SELECT * FROM "OFAC" WHERE iprange("startIP","endIP") >>= ${ip}::ipaddress`

    if (countries.length === 0) return false

    return countries[0].country
  } catch (e) {
    console.error('gOFACYourself', e)
    return false
  }
}
