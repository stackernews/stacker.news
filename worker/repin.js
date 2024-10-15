export async function repin ({ name, models }) {
  // get the id
  const id = name.slice('repin-'.length)
  if (id.length === 0 || isNaN(id)) {
    console.log('repin id not found in', name)
    return
  }

  // get the latest item with this id
  const pinId = Number(id)
  const current = await models.item.findFirst(
    {
      where: {
        pinId
      },
      orderBy: {
        createdAt: 'desc'
      }
    }
  )

  if (!current) {
    console.log('could not find existing item for pin', name)
    return
  }

  // create a new item with matching 1) title, text, and url and 2) setting pinId
  await models.item.create({
    data: {
      title: current.title,
      text: current.text,
      url: current.url,
      userId: current.userId,
      subName: current.subName,
      pinId
    }
  })
}
