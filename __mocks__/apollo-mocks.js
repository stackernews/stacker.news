import { BLOCK_HEIGHT } from '../fragments/blockHeight'
import { CHAIN_FEE } from '../fragments/chainFee'
import { PRICE } from '../fragments/price'
import { SUB_FIELDS, SUB_FULL } from '../fragments/subs'
import { ME } from '../fragments/users'
const mockUser = {
  me: {
    id: 'user-123',
    name: 'John Doe',
    bioId: 'bio-456',
    privates: {
      autoDropBolt11s: true,
      diagnostics: false,
      fiatCurrency: 'USD',
      greeterMode: true,
      hideCowboyHat: false,
      hideFromTopUsers: true,
      hideInvoiceDesc: false,
      hideIsContributor: true,
      hideWalletBalance: false,
      hideWelcomeBanner: true,
      imgproxyOnly: false,
      lastCheckedJobs: new Date().toISOString(), // Assuming ISO string format for dates
      nostrCrossposting: true,
      noteAllDescendants: false,
      noteTerritoryPosts: true,
      noteCowboyHat: false,
      noteDeposits: true,
      noteEarning: false,
      noteForwardedSats: true,
      noteInvites: false,
      noteItemSats: true,
      noteJobIndicator: false,
      noteMentions: true,
      sats: 1000,
      tipDefault: 100,
      tipPopover: true,
      turboTipping: false,
      upvotePopover: true,
      wildWestMode: false,
      withdrawMaxFeeDefault: 500,
      lnAddr: 'lnbc1...',
      autoWithdrawMaxFeePercent: 1,
      autoWithdrawThreshold: 100000
    },
    optional: {
      isContributor: true,
      stacked: 5000,
      streak: 10
    }
  }
}

const mockPrice = {
  data: {
    price: 123.45,
    createdAt: Date.now()
  }
}
const mockBlockHeight = {
  data: {
    blockHeight: 123456
  }
}
const mockChainFee = {
  data: {
    chainFee: 0
  }
}

const mockSubFields = {
  name: 'ExampleSub',
  postTypes: ['text', 'image', 'video'],
  allowFreebies: true,
  rankingType: 'engagement',
  billingType: 'subscription',
  billingCost: 5.99,
  billingAutoRenew: true,
  billedLastAt: '2023-01-01T00:00:00Z',
  baseCost: 4.99,
  userId: 'user-123',
  desc: 'This is an example description of the sub.',
  status: 'active',
  moderated: false,
  moderatedCount: 10,
  meMuteSub: false,
  nsfw: false
}

const mockSubFull = {
  ...mockSubFields,
  user: {
    name: 'User Name',
    id: 'user-123',
    optional: {
      streak: 5
    }
  }
}

export default [
  {
    request: {
      operationName: 'price',
      query: PRICE,
      variables: {
        fiatCurrency: undefined
      },
      result: mockPrice
    }
  },
  {
    request: {
      operationName: 'me',
      query: ME,
      result: mockUser
    }
  },
  {
    request: {
      operationName: 'blockHeight',
      query: BLOCK_HEIGHT,
      result: mockBlockHeight
    }
  },
  {
    request: {
      operationName: 'chainFee',
      query: CHAIN_FEE,
      result: mockChainFee,
      maxUsageCount: Number.POSITIVE_INFINITY
    }
  },
  {
    request: {
      operationName: 'subFields',
      query: SUB_FIELDS,
      result: mockSubFields,
      maxUsageCount: Number.POSITIVE_INFINITY
    }
  },
  {
    request: {
      operationName: 'subFull',
      query: SUB_FULL,
      result: mockSubFull,
      maxUsageCount: Number.POSITIVE_INFINITY
    }
  }

]
