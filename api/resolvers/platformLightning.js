import { isLndMaintenance, LND_MAINTENANCE_MESSAGE } from '@/api/lnd/maintenance'

export default {
  Query: {
    platformLightningStatus: () => {
      const maintenance = isLndMaintenance()
      return {
        available: !maintenance,
        message: maintenance ? LND_MAINTENANCE_MESSAGE : null
      }
    }
  }
}
