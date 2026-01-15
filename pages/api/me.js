import { multiAuthMiddleware } from '@/lib/auth'
import { getServerSession } from 'next-auth/next'
import { getAuthOptions } from '@/pages/api/auth/[...nextauth]'
import models from '@/api/models'

export default async (req, res) => {
  req = await multiAuthMiddleware(req, res)
  const session = await getServerSession(req, res, getAuthOptions(req))
  const user = session?.user

  if (!user) {
    return res.redirect('/')
  }

  const me = await models.user.findUnique({ where: { id: user.id } })
  if (!me?.name) {
    return res.redirect('/')
  }

  res.redirect(`/${me.name}`)
}
