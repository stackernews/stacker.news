import { NextResponse } from 'next/server'

export function middleware (request) {
  const regex = /(\/.*)?\/r\/([\w_]+)/
  const m = regex.exec(request.nextUrl.pathname)

  const url = new URL(m[1] || '/', request.url)
  url.search = request.nextUrl.search
  url.hash = request.nextUrl.hash

  const resp = NextResponse.redirect(url)
  resp.cookies.set('sn_referrer', m[2])
  return resp
}

export const config = {
  matcher: ['/(.*/|)r/([\\w_]+)([?#]?.*)']
}
