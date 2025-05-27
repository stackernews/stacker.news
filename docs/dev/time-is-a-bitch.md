We store times in the db as `timestamp(3)` which implicitly means
- store time without a time zone
- when we store a timestamp, it removes the timezone without any other modification, and we effectively lose it
- when we read a timestamp, it has no timezone

In production and the `sndev` environment, the database's configured time zone is `UTC`. This means `now()` returns UTC, and all timestamps are stored in UTC, except for statistics, which are kept in `America/Chicago`.

In most instances, we interested in relative times (e.g. is this item's time greater than this item) so the timezone is not relevant. However, when we want to do things at exact times in specific time zones it can get complicated.

We do a lot of things that depend on knowing the time in `America/Chicago` (ie Austin's time zone), so we regularly need to read and write times from the db taking care of the time zones.

1. If you want the time of an item in America/Chicago, you'll convert it by doing the following: `"Item".created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Chicago'`

	 `AT TIME ZONE 'UTC'` assigns the UTC time zone to the timestamp. Then, `AT TIME ZONE 'America/Chicago'` converts this timestamp to the `America/Chicago` time zone.

	 This is useful if you want to know the day in `America/Chicago` that `"Item".created_at` corresponds to, e.g. `date_trunc('day', "Item".created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Chicago')`

2. All of our materialized views that deal with discrete periods of time (e.g. days, hours) store time as `America/Chicago`, but without a time zone (heh).

	This means that if you want to see if a row in `user_values_days` is today in `America/Chicago`, you'd do the following: `date_trunc('day', user_values_days.t) = date_trunc('day', now() AT TIME ZONE 'America/Chicago')`

	 Note: `now()` returns a timestamp with a time zone, so `AT TIME ZONE 'UTC'` is not needed

3. When we pass absolute times from the frontend to the backend we use unix timestamps, seconds, or milliseconds, since Jan 1, 1970 UTC. When we use these for querying materialized views, which store discrete time periods in `America/Chicago`, they need to be converted to `America/Chicago` to use them as filters on queries.

	For example, we might use `user_values_days.t >= date_trunc('day', ${new Date(input)} AT TIME ZONE 'America/Chicago')`. This converts the input day (which includes a time zone) to the corresponding day in `America/Chicago`.

4. Often we want to send `America/Chicago` dates to the frontend. When we do that, we need to make sure the times passed have a time zone, otherwise the time will be assumed to be `UTC`.

	For example, if we want to pass an Austin day to the frontend, we'll want to say so like `date_trunc('day', user_values.day.t) AT TIME ZONE 'America/Chicago'`

5. Beware of daylight savings when doing time zone conversions. `(now() - interval '1 month') AT TIME ZONE 'America/Chicago' <> now() AT TIME ZONE 'America/Chicago' - interval '1 month'` if there was a time change in the last month. If you want one month ago in `America/Chicago`, you should do `now() AT TIME ZONE 'America/Chicago' - interval '1 month'`