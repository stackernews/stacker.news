# Paid Actions

Paid actions are actions that require payments to perform. Given that we support several payment flows, some of which require more than one round of communication either with LND or the client, we have this plugin-like interface to easily add new paid actions.

## Payment Flows

There are three payment flows:
    - Fee credits: The client has enough fee credits to pay for the action. This is the simplest flow and is similar to a normal request.
    - Optimistic: If the client doesn't have enough fee credits, we store the action in a `PENDING` state on the server, then return a payment request to the client. The client pays the invoice and the server checks if the payment was successful. If it was, the action is executed fully. Importantly, the client doesn't need to wait for the payment to complete before proceeding. Also, these actions can be retried by the client repeatedly in the case of a failed payment.
    - Pessimistic: If the client doesn't have enough fee credits, we return a payment request to the client. After the client pays the invoice, the client resends the action with proof of payment and action is executed fully. The client must wait for the payment to complete before proceeding.

## Adding a new paid action

### Interface

TODO: describe the interface

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

We use a `read committed` isolation level for actions. This means paid actions need to be mindful of concurrency issues.

### The big deals
1. If you read from the database and intend to use the read data to write to the database, and it's possible that a concurrent transaction could change the data you've read (it usually is), you need to be prepared to handle that. Generally, this means:
    - you'll want to take row level locks on the rows you read, using something like a `SELECT ... FOR UPDATE` statement to lock the rows you've read.
    - you'll want to avoid having to read data to modify other data
    - you'll want to check that the data you read is still valid before writing it back to the database i.e. optimistic concurrency control
2. The above applies to `WITH` queries (CTEs) and subqueries within the same statement in addition to independent statements.

