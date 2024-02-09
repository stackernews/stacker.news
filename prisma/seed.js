const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

function selectRandomly (items) {
  return items[Math.floor(Math.random() * items.length)]
}

async function addComments (parentIds, nComments, userIds, commentText) {
  const clonedParentIds = [...parentIds]
  const clonedUserIds = [...userIds]
  for (let i = 0; i < nComments; i++) {
    const selectedParent = selectRandomly(clonedParentIds)
    const selectedUserId = selectRandomly(clonedUserIds)
    const newComment = await prisma.item.create({
      data: {
        parentId: selectedParent,
        userId: selectedUserId,
        text: commentText
      }
    })
    clonedParentIds.push(newComment.id)
  }
}

async function main () {
  const k00b = await prisma.user.upsert({
    where: { name: 'k00b' },
    update: {},
    create: {
      name: 'k00b'
    }
  })
  const satoshi = await prisma.user.upsert({
    where: { name: 'satoshi' },
    update: {},
    create: {
      name: 'satoshi'
    }
  })
  const greg = await prisma.user.upsert({
    where: { name: 'greg' },
    update: {},
    create: {
      name: 'greg'
    }
  })
  const stan = await prisma.user.upsert({
    where: { name: 'stan' },
    update: {},
    create: {
      name: 'stan'
    }
  })
  const anon = await prisma.user.findUnique({
    where: { name: 'anon' }
  })

  const ad = await prisma.user.findUnique({
    where: { name: 'ad' }
  })

  await prisma.item.create({
    data: {
      title: 'System76 Developing “Cosmic” Desktop Environment',
      url: 'https://blog.system76.com/post/648371526931038208/cosmic-to-arrive-in-june-release-of-popos-2104',
      userId: satoshi.id,
      subName: 'bitcoin',
      children: {
        create: {
          userId: k00b.id,
          text: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
          children: {
            create: {
              userId: satoshi.id,
              text: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
              children: {
                create: {
                  userId: greg.id,
                  text: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.'
                }
              }
            }
          }
        }
      }
    }
  })

  await prisma.item.create({
    data: {
      title: 'Deno 1.9',
      url: 'https://deno.com/blog/v1.9',
      userId: k00b.id,
      subName: 'bitcoin',
      children: {
        create: {
          userId: satoshi.id,
          text: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
          children: {
            create: {
              userId: k00b.id,
              text: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
              children: {
                create: {
                  userId: stan.id,
                  text: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.'
                }
              }
            }
          }
        }
      }
    }
  })

  await prisma.item.create({
    data: {
      title: '1Password Secrets Automation',
      url: 'https://blog.1password.com/introducing-secrets-automation/',
      userId: greg.id,
      subName: 'bitcoin',
      children: {
        create: {
          userId: k00b.id,
          text: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
          children: {
            create: {
              userId: satoshi.id,
              text: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
              children: {
                create: {
                  userId: greg.id,
                  text: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.'
                }
              }
            }
          }
        }
      }
    }
  })

  await prisma.item.create({
    data: {
      title: '‘Counter Strike’ Bug Allows Hackers to Take over a PC with a Steam Invite',
      url: 'https://www.vice.com/en/article/dyvgej/counter-strike-bug-allows-hackers-to-take-over-a-pc-with-a-steam-invite',
      userId: stan.id,
      subName: 'bitcoin',
      children: {
        create: {
          userId: greg.id,
          text: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
          children: {
            create: {
              userId: stan.id,
              text: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
              children: {
                create: {
                  userId: k00b.id,
                  text: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.'
                }
              }
            }
          }
        }
      }
    }
  })

  await prisma.item.create({
    data: {
      title: 'An anonymous post',
      url: 'https://www.google.com',
      userId: anon.id,
      subName: 'bitcoin',
      children: {
        create: {
          userId: anon.id,
          text: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.'
        }
      }
    }
  })

  await prisma.item.create({
    data: {
      title: 'An ad post',
      url: 'https://www.google.com',
      userId: ad.id,
      subName: 'bitcoin',
      children: {
        create: {
          userId: anon.id,
          text: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.'
        }
      }
    }
  })

  const bigCommentPost = await prisma.item.create({
    data: {
      title: 'a discussion post with a lot of comments',
      text: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
      userId: k00b.id,
      subName: 'bitcoin'
    }
  })

  addComments([bigCommentPost.id], 200, [k00b.id, anon.id, satoshi.id, greg.id, stan.id], 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.')
}
main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
