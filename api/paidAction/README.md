# Paid Actions

Paid actions are actions that require payments to perform. Given that we support several payment flows, some of which require more than one round of communication either with LND or the client, we have this plugin-like interface to easily add new paid actions.

## Payment Flows

There are three payment flows:
- Fee credits: The client has enough fee credits to pay for the action. This is the simplest flow and is similar to a normal request.
- Optimistic: If the client doesn't have enough fee credits, we store the action in a `PENDING` state on the server, then return a payment request to the client. The client pays the invoice however and whenever they wish, and the server monitors payment progress. If the payment succeeds, the action is executed fully. Otherwise, the client is notified and the payment can be retried. Unpaid actions are only viewable by the client that created them.
- Pessimistic: If the client doesn't have enough fee credits, we return a payment request to the client. After the client pays the invoice, the client resends the action with proof of payment and action is executed fully. Pessimistic actions are never stored in a pending state on the server, and require the client to wait for the payment to complete.

## Adding a new paid action

### Interface

TODO: describe the interface in further detail

#### Properties
- anonable: can be performed anonymously
- supportsPessimism: supports pessimistic payment flow
- supportsOptimism: supports optimistic payment flow

#### Functions
- getCost: returns the cost of the action
- perform: performs the action
- onPaid: called when the action is paid (useful for marking optimistic actions as paid, and performing side effects)
- onFail: called when the action fails (useful for marking optimistic actions as failed)
- retry: called when the action is retried with any new invoice information
- describe: returns a description of the action which is added to the invoice

## `IMPORTANT: transaction isolation`

We use a `read committed` isolation level for actions. This means paid actions need to be mindful of concurrency issues. Specifically, reading data from the database and then writing it back in `read committed` is a common source of consistency bugs.

### This is a big deal
1. If you read from the database and intend to use that data to write to the database, and it's possible that a concurrent transaction could change the data you've read (it usually is), you need to be prepared to handle that.
2. This applies to **ALL**, and I really mean **ALL**, read data regardless of how you read the data:
   - independent statements
   - `WITH` queries (CTEs) in the same statement
   - subqueries in the same statement

### How to handle it
1. take row level locks on the rows you read, using something like a `SELECT ... FOR UPDATE` statement
    - NOTE: this does not protect against missing concurrent inserts. It only prevents concurrent updates to the rows you've already read.
    - read about row level locks available in postgres: https://www.postgresql.org/docs/current/explicit-locking.html#LOCKING-ROWS
2. check that the data you read is still valid before writing it back to the database i.e. optimistic concurrency control
    - NOTE: this does not protect against missing concurrent inserts. It only prevents concurrent updates to the rows you've already read.
3. avoid having to read data from one row to modify the data of another row all together

### Example

Let's say you are aggregating total sats for an item from a table `zaps` and updating the total sats for that item in another table `item_zaps`. Two 100 sat zaps are requested for the same item at the same time in two concurrent transactions. The total sats for the item should be 200, but because of the way `read committed` works, the following statements lead to a total sats of 100:

*the statements here are listed in the order they are executed, but each transaction is happening concurrently*

#### Incorrect

```sql
-- transaction 1
BEGIN;
INSERT INTO zaps (item_id, sats) VALUES (1, 100);
SELECT sum(sats) INTO total_sats FROM zaps WHERE item_id = 1;
-- total_sats is 100
-- transaction 2
BEGIN;
INSERT INTO zaps (item_id, sats) VALUES (1, 100);
SELECT sum(sats) INTO total_sats FROM zaps WHERE item_id = 1;
-- total_sats is still 100, because transaction 1 hasn't committed yet
-- transaction 1
UPDATE item_zaps SET sats = total_sats WHERE item_id = 1;
-- sets sats to 100
-- transaction 2
UPDATE item_zaps SET sats = total_sats WHERE item_id = 1;
-- sets sats to 100
COMMIT;
-- transaction 1
COMMIT;
-- item_zaps.sats is 100, but we would expect it to be 200
```

Note that row level locks wouldn't help in this case, because we can't lock the rows that the transactions doesn't know to exist yet.

#### Correct

```sql
-- transaction 1
BEGIN;
INSERT INTO zaps (item_id, sats) VALUES (1, 100);
-- transaction 2
BEGIN;
INSERT INTO zaps (item_id, sats) VALUES (1, 100);
-- transaction 1
UPDATE item_zaps SET sats = sats + 100 WHERE item_id = 1;
-- transaction 2
UPDATE item_zaps SET sats = sats + 100 WHERE item_id = 1;
COMMIT;
-- transaction 1
COMMIT;
-- item_zaps.sats is 200
```

The above works because `UPDATE` takes a lock on the rows it's updating, so the second transaction will block until the first transaction commits.

