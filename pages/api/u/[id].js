import models from '@/api/models'

// redirect /u/:id to /[name]
export default async (req, res) => {
  const { id } = req.query
  const numId = Number(id)
  if (!Number.isInteger(numId) || numId <= 0) {
    return res.status(400).end()
  }
  const user = await models.user.findUnique({ where: { id: numId } })
  if (!user) {
    return res.status(404).end()
  }
  res.redirect(`/${user.name}`)
}
