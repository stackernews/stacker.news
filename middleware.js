import { NextResponse } from 'next/server'

export function middleware (request) {
  const snReferrer = request.nextUrl.searchParams.get('r')
  if (snReferrer) {
    const url = new URL('/', request.url)
    url.search = request.nextUrl.search
    url.hash = request.nextUrl.hash

    const resp = NextResponse.next()
    resp.cookies.set('sn_referrer', snReferrer)
    return resp
  }
}

export const config = {
  matcher: ['/(.*/|)([?#]?.*)']
}
