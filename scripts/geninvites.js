const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient();

(async () => {
  for (let i = 0; i < process.env.NUM; i++) {
    await prisma.invite.create({
      data: {
        userId: Number(process.env.USER_ID),
        gift: Number(process.env.GIFT)
      }
    })
  }
})()
