import { GraphQLError } from 'graphql'

// this function makes america more secure apparently
export default async function assertGofacYourself ({ models, headers }) {
  const country = await gOFACYourself({ models, headers })
  if (!country) return

  throw new GraphQLError(
    `Your IP address is in ${country}. We cannot provide financial services to residents of ${country}.`,
    { extensions: { code: 'FORBIDDEN' } })
}

export async function gOFACYourself ({ models, headers }) {
  const { 'x-forwarded-for': xForwardedFor, 'x-real-ip': xRealIp } = headers
  const ip = xRealIp || xForwardedFor?.split(',')?.[0]
  if (!ip) return false

  const countries = await models.$queryRaw`
    SELECT * FROM "OFAC" WHERE iprange("startIP","endIP") >>= ${ip}::ipaddress`

  if (countries.length === 0) return false

  return countries[0].country
}
