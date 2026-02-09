import { multiAuthMiddleware } from '@/lib/auth'
import { getServerSession } from 'next-auth/next'
import { getAuthOptions } from '@/pages/api/auth/[...nextauth]'
import models from '@/api/models'

export async function getServerSideProps ({ req, res }) {
  req = await multiAuthMiddleware(req, res)
  const session = await getServerSession(req, res, getAuthOptions(req))
  const user = session?.user
  if (!user) return { redirect: { destination: '/', permanent: false } }

  const me = await models.user.findUnique({ where: { id: user.id } })
  if (!me?.name) return { redirect: { destination: '/', permanent: false } }

  return { redirect: { destination: `/${me.name}`, permanent: false } }
}

export default () => null
