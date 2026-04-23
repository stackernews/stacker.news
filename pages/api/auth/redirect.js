import { SN_MAIN_DOMAIN } from '@/lib/domains'

// TODO: experimental, middleware proxy can't redirect to absolute MAIN DOMAIN URLs in local dev
export default async function handler (req, res) {
  const { domain } = req.query
  if (!domain) {
    return res.status(400).json({ status: 'ERROR', reason: 'domain is required' })
  }

  const redirectUrl = new URL('/login', SN_MAIN_DOMAIN)
  redirectUrl.searchParams.set('domain', domain)

  res.redirect(302, redirectUrl.href)
}
