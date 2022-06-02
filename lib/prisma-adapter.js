/* eslint-disable */
'use strict'

Object.defineProperty(exports, '__esModule', {
  value: true
})
exports.getCompoundId = getCompoundId
exports.Adapter = exports.PrismaLegacyAdapter = PrismaLegacyAdapter

const _crypto = require('crypto')

function getCompoundId (a, b) {
  return (0, _crypto.createHash)('sha256').update(`${a}:${b}`).digest('hex')
}

function PrismaLegacyAdapter (config) {
  const {
    prisma,
    modelMapping = {
      User: 'user',
      Account: 'account',
      Session: 'session',
      VerificationRequest: 'verificationRequest'
    }
  } = config
  const {
    User,
    Account,
    Session,
    VerificationRequest
  } = modelMapping
  return {
    async getAdapter ({
      session: {
        maxAge,
        updateAge
      },
      secret,
      ...appOptions
    }) {
      const sessionMaxAge = maxAge * 1000
      const sessionUpdateAge = updateAge * 1000

      const hashToken = token => (0, _crypto.createHash)('sha256').update(`${token}${secret}`).digest('hex')

      return {
        displayName: 'PRISMA_LEGACY',

        createUser (profile) {
          let _profile$emailVerifie

          return prisma[User].create({
            data: {
              name: profile.name,
              email: profile.email,
              image: profile.image,
              emailVerified: (_profile$emailVerifie = profile.emailVerified) === null || _profile$emailVerifie === void 0 ? void 0 : _profile$emailVerifie.toISOString()
            }
          })
        },

        getUser (id) {
          return prisma[User].findUnique({
            where: {
              id: Number(id)
            }
          })
        },

        getUserByEmail (email) {
          if (email) {
            return prisma[User].findUnique({
              where: {
                email
              }
            })
          }

          return null
        },

        async getUserByProviderAccountId (providerId, providerAccountId) {
          const account = await prisma[Account].findUnique({
            where: {
              compoundId: getCompoundId(providerId, providerAccountId)
            }
          })

          if (account) {
            return prisma[User].findUnique({
              where: {
                id: account.userId
              }
            })
          }

          return null
        },

        updateUser (user) {
          const {
            id,
            name,
            email,
            image,
            emailVerified
          } = user
          return prisma[User].update({
            where: {
              id
            },
            data: {
              name,
              email,
              image,
              emailVerified: emailVerified === null || emailVerified === void 0 ? void 0 : emailVerified.toISOString()
            }
          })
        },

        deleteUser (userId) {
          return prisma[User].delete({
            where: {
              id: userId
            }
          })
        },

        linkAccount (userId, providerId, providerType, providerAccountId, refreshToken, accessToken, accessTokenExpires) {
          return prisma[Account].create({
            data: {
              accessToken,
              refreshToken,
              compoundId: getCompoundId(providerId, providerAccountId),
              providerAccountId: `${providerAccountId}`,
              providerId,
              providerType,
              accessTokenExpires,
              userId
            }
          })
        },

        unlinkAccount (_, providerId, providerAccountId) {
          return prisma[Account].delete({
            where: {
              compoundId: getCompoundId(providerId, providerAccountId)
            }
          })
        },

        createSession (user) {
          let expires = null

          if (sessionMaxAge) {
            const dateExpires = new Date()
            dateExpires.setTime(dateExpires.getTime() + sessionMaxAge)
            expires = dateExpires.toISOString()
          }

          return prisma[Session].create({
            data: {
              expires,
              userId: user.id,
              sessionToken: (0, _crypto.randomBytes)(32).toString('hex'),
              accessToken: (0, _crypto.randomBytes)(32).toString('hex')
            }
          })
        },

        async getSession (sessionToken) {
          const session = await prisma[Session].findUnique({
            where: {
              sessionToken
            }
          })

          if (session !== null && session !== void 0 && session.expires && new Date() > session.expires) {
            await prisma[Session].delete({
              where: {
                sessionToken
              }
            })
            return null
          }

          return session
        },

        updateSession (session, force) {
          if (sessionMaxAge && (sessionUpdateAge || sessionUpdateAge === 0) && session.expires) {
            const dateSessionIsDueToBeUpdated = new Date(session.expires)
            dateSessionIsDueToBeUpdated.setTime(dateSessionIsDueToBeUpdated.getTime() - sessionMaxAge)
            dateSessionIsDueToBeUpdated.setTime(dateSessionIsDueToBeUpdated.getTime() + sessionUpdateAge)

            if (new Date() > dateSessionIsDueToBeUpdated) {
              const newExpiryDate = new Date()
              newExpiryDate.setTime(newExpiryDate.getTime() + sessionMaxAge)
              session.expires = newExpiryDate
            } else if (!force) {
              return null
            }
          } else {
            if (!force) {
              return null
            }
          }

          const {
            id,
            expires
          } = session
          return prisma[Session].update({
            where: {
              id
            },
            data: {
              expires: expires.toISOString()
            }
          })
        },

        deleteSession (sessionToken) {
          return prisma[Session].delete({
            where: {
              sessionToken
            }
          })
        },

        async createVerificationRequest (identifier, url, token, _, provider) {
          const {
            sendVerificationRequest,
            maxAge
          } = provider
          let expires = null

          if (maxAge) {
            const dateExpires = new Date()
            dateExpires.setTime(dateExpires.getTime() + maxAge * 1000)
            expires = dateExpires.toISOString()
          }

          const verificationRequest = await prisma[VerificationRequest].create({
            data: {
              identifier,
              token: hashToken(token),
              expires
            }
          })
          await sendVerificationRequest({
            identifier,
            url,
            token,
            baseUrl: appOptions.baseUrl,
            provider
          })
          return verificationRequest
        },

        async getVerificationRequest (identifier, token) {
          const hashedToken = hashToken(token)
          const verificationRequest = await prisma[VerificationRequest].findFirst({
            where: {
              identifier,
              token: hashedToken
            }
          })

          if (verificationRequest && verificationRequest.expires && new Date() > verificationRequest.expires) {
            await prisma[VerificationRequest].deleteMany({
              where: {
                identifier,
                token: hashedToken
              }
            })
            return null
          }

          return verificationRequest
        },

        async deleteVerificationRequest (identifier, token) {
          await prisma[VerificationRequest].deleteMany({
            where: {
              identifier,
              token: hashToken(token)
            }
          })
        }

      }
    }

  }
}
