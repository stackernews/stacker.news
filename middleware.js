import { NextResponse } from 'next/server'

export function middleware (request) {
  const sn_referrer = request.nextUrl.searchParams.get("r")
  if (sn_referrer) {
    console.log({sn_referrer})

    const url = new URL('/', request.url)
    url.search = request.nextUrl.search
    url.hash = request.nextUrl.hash
  
    console.log({url})
  
    //const resp = NextResponse.redirect(url)
    const resp = NextResponse.next();
    resp.cookies.set('sn_referrer', sn_referrer)
    return resp
  }
}

export const config = {
  matcher: ['/(.*/|)([?#]?.*)']
}
