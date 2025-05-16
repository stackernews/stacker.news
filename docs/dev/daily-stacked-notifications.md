# Daily Stacked Notifications

This feature sends daily summary notifications to users with details about how much they stacked and spent on the previous day.

## Implementation

The daily stacked notification system consists of several components:

1. **Database schema** - A `noteDailyStacked` preference column on the `users` table that users can toggle on/off.
1. **Worker job** - A scheduled job (`dailyStackedNotification`) that runs daily at 1:15 AM Central Time to send notifications.
1. **Notification content** - Shows how much the user stacked and spent the previous day, plus their net gain/loss.
1. **User preferences** - A toggle in the settings UI allows users to enable or disable these notifications.

## Setup

After deploying the code changes:

1. Run the migration:
1. Set up the PgBoss schedule:
   ```
   node scripts/add-daily-notification-schedule.js
   ```

## Testing

To manually test the notification:

```sql
INSERT INTO pgboss.job (name, data) VALUES ('dailyStackedNotification', '{}');
```

## Related Files

- `worker/dailyStackedNotification.js` - Worker implementation
- `worker/index.js` - Worker registration
- `lib/webPush.js` - Notification handling
- `pages/settings/index.js` - UI settings
- `api/typeDefs/user.js` - GraphQL schema
- `prisma/schema.prisma` - Database schema
