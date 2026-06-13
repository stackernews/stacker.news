# Wallets

## How to add a new wallet

**1. Update prisma.schema**

- add enum value to `WalletName` enum
- run `npx prisma migrate dev --create-only`

**2. Update migration file**

- append `COMMIT` to the `ALTER TYPE` statement in the migration
- insert new row into `ẀalletTemplate`
- run `npx prisma migrate dev`

Example migration:

```sql
ALTER TYPE "WalletName" ADD VALUE 'PHOENIX'; COMMIT;
INSERT INTO "WalletTemplate" (name, "sendProtocols", "recvProtocols")
VALUES (
    'PHOENIX',
    ARRAY[]::"WalletSendProtocolName"[],
    ARRAY['BOLT12']::"WalletRecvProtocolName"[]
);
```

**3. Customize how the wallet looks on the client via [wallets/lib/wallets.json](/wallets/lib/wallets.json)**

Example:

```json
{
    // must be same name as wallet template
    "name": "PHOENIX",
    // name to show in client
    "displayName": "Phoenix",
    // image to show in client
    // (dark mode will use /path/to/image-dark.png)
    "image": "/path/to/image.png",
    // url (planned) to show in client
    "url": "https://phoenix.acinq.co/"
}
```

_If the wallet supports a lightning address and the domain is different than the url, you can pass an object to `url`. Here is Zeus as an example:_

```json
{
    "name": "ZEUS",
    "displayName": "Zeus",
    "image": "/wallets/zeus.svg",
    "url": {
        "wallet": "https://zeusln.com/",
        // different domain for lightning address
        "lud16Domain": "zeuspay.com"
    }
},
```

That's it!

## How to add a new protocol

### 1. Update db schema

**1.1 Update prisma.schema**

- add enum value to `WalletProtocolName` enum
- add enum value to `WalletRecvProtocolName` or `WalletSendProtocolName`
- add table to store protocol config
- run `npx prisma migrate dev --create-only`
- **for send protocols, it is important that the names for encrypted columns end with `vaultId`**

**1.2 Update migration file**

- add `COMMIT` after statements to add enum values
- add required triggers: `wallet_to_jsonb` and, if send protocol, also `wallet_clear_vault`
- run `npx prisma migrate dev`

  ```sql
  CREATE TRIGGER wallet_to_jsonb
      AFTER INSERT OR UPDATE ON "WalletSendFoo"
      FOR EACH ROW
      EXECUTE PROCEDURE wallet_to_jsonb();
  ```

  `wallet_to_jsonb` fires immediately when the protocol relation row changes.
  Prisma writes nested Vault rows after the relation row, so protocol update
  helpers intentionally touch the relation row's `updatedAt` after nested writes
  complete. That second touch re-fires `wallet_to_jsonb` so
  `WalletProtocol.config` materializes the latest Vault values. Keep protocol
  config writes on `upsertProtocolInTransaction` and
  `updateExistingProtocolConfigInTransaction` unless you also preserve this
  post-write touch.

<details>
<summary>Example: DB schema changes to add Spark</summary>

```diff
diff --git a/prisma/migrations/<timestamp>_spark/migration.sql b/prisma/migrations/<timestamp>_spark/migration.sql
new file mode 100644
--- /dev/null
+++ b/prisma/migrations/<timestamp>_spark/migration.sql
+-- AlterEnum
+ALTER TYPE "WalletName" ADD VALUE 'SPARK'; COMMIT;
+
+-- AlterEnum
+ALTER TYPE "WalletProtocolName" ADD VALUE 'SPARK'; COMMIT;
+
+-- AlterEnum
+ALTER TYPE "WalletRecvProtocolName" ADD VALUE 'SPARK'; COMMIT;
+
+-- AlterEnum
+ALTER TYPE "WalletSendProtocolName" ADD VALUE 'SPARK'; COMMIT;
+
+INSERT INTO "WalletTemplate" ("name", "sendProtocols", "recvProtocols")
+VALUES ('SPARK', '{SPARK}', '{SPARK}');
+
+-- CreateTable
+CREATE TABLE "WalletSendSpark" (
+    "id" SERIAL NOT NULL,
+    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
+    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
+    "protocolId" INTEGER NOT NULL,
+    "mnemonicVaultId" INTEGER NOT NULL,
+
+    CONSTRAINT "WalletSendSpark_pkey" PRIMARY KEY ("id")
+);
+
+-- CreateTable
+CREATE TABLE "WalletRecvSpark" (
+    "id" SERIAL NOT NULL,
+    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
+    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
+    "protocolId" INTEGER NOT NULL,
+    "address" TEXT NOT NULL,
+
+    CONSTRAINT "WalletRecvSpark_pkey" PRIMARY KEY ("id")
+);
+
+-- CreateIndex
+CREATE UNIQUE INDEX "WalletSendSpark_protocolId_key" ON "WalletSendSpark"("protocolId");
+
+-- CreateIndex
+CREATE UNIQUE INDEX "WalletSendSpark_mnemonicVaultId_key" ON "WalletSendSpark"("mnemonicVaultId");
+
+-- CreateIndex
+CREATE UNIQUE INDEX "WalletRecvSpark_protocolId_key" ON "WalletRecvSpark"("protocolId");
+
+-- AddForeignKey
+ALTER TABLE "WalletSendSpark" ADD CONSTRAINT "WalletSendSpark_protocolId_fkey" FOREIGN KEY ("protocolId") REFERENCES "WalletProtocol"("id") ON DELETE CASCADE ON UPDATE CASCADE;
+
+-- AddForeignKey
+ALTER TABLE "WalletSendSpark" ADD CONSTRAINT "WalletSendSpark_mnemonicVaultId_fkey" FOREIGN KEY ("mnemonicVaultId") REFERENCES "Vault"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
+
+-- AddForeignKey
+ALTER TABLE "WalletRecvSpark" ADD CONSTRAINT "WalletRecvSpark_protocolId_fkey" FOREIGN KEY ("protocolId") REFERENCES "WalletProtocol"("id") ON DELETE CASCADE ON UPDATE CASCADE;
+
+CREATE TRIGGER wallet_to_jsonb
+    AFTER INSERT OR UPDATE ON "WalletSendSpark"
+    FOR EACH ROW
+    EXECUTE PROCEDURE wallet_to_jsonb();
+
+CREATE TRIGGER wallet_to_jsonb
+    AFTER INSERT OR UPDATE ON "WalletRecvSpark"
+    FOR EACH ROW
+    EXECUTE PROCEDURE wallet_to_jsonb();
+
+CREATE TRIGGER wallet_clear_vault
+   AFTER DELETE ON "WalletSendSpark"
+   FOR EACH ROW
+   EXECUTE PROCEDURE wallet_clear_vault();
diff --git a/prisma/schema.prisma b/prisma/schema.prisma
index 4f3cb9e2..c25c0fc8 100644
--- a/prisma/schema.prisma
+++ b/prisma/schema.prisma
@@ -221,6 +221,7 @@ model Vault {
   walletSendLNCRemoteKey     WalletSendLNC?      @relation("lncRemoteKey")
   walletSendLNCServerHost    WalletSendLNC?      @relation("lncServerHost")
   walletSendCLNRestRune      WalletSendCLNRest?  @relation("clnRune")
+  walletSendSparkMnemonic    WalletSendSpark?    @relation("sparkMnemonic")
 }

 model WalletLog {
@@ -1214,6 +1215,7 @@ enum WalletProtocolName {
   CLN_REST
   LND_GRPC
   CLINK
+  SPARK
 }

 enum WalletSendProtocolName {
@@ -1224,6 +1226,7 @@ enum WalletSendProtocolName {
   WEBLN
   LNC
   CLN_REST
+  SPARK
 }

 enum WalletRecvProtocolName {
@@ -1235,6 +1238,7 @@ enum WalletRecvProtocolName {
   CLN_REST
   LND_GRPC
   CLINK
+  SPARK
 }

 enum WalletProtocolStatus {
@@ -1270,6 +1274,7 @@ enum WalletName {
   LN_ADDR
   CASH_APP
   BLITZ
+  SPARK
 }

 model WalletTemplate {
@@ -1327,6 +1332,7 @@ model WalletProtocol {
   walletSendWebLN    WalletSendWebLN?
   walletSendLNC      WalletSendLNC?
   walletSendCLNRest  WalletSendCLNRest?
+  walletSendSpark    WalletSendSpark?

   walletRecvNWC              WalletRecvNWC?
   walletRecvLNbits           WalletRecvLNbits?
@@ -1336,6 +1342,7 @@ model WalletProtocol {
   walletRecvCLNRest          WalletRecvCLNRest?
   walletRecvLNDGRPC          WalletRecvLNDGRPC?
   walletRecvClink            WalletRecvClink?
+  walletRecvSpark            WalletRecvSpark?

   @@unique(name: "WalletProtocol_walletId_send_name_key", [walletId, send, name])
   @@index([walletId])
@@ -1420,6 +1427,16 @@ model WalletSendCLNRest {
   rune        Vault?         @relation("clnRune", fields: [runeVaultId], references: [id])
 }

+model WalletSendSpark {
+  id              Int            @id @default(autoincrement())
+  createdAt       DateTime       @default(now()) @map("created_at")
+  updatedAt       DateTime       @default(now()) @updatedAt @map("updated_at")
+  protocolId      Int            @unique
+  protocol        WalletProtocol @relation(fields: [protocolId], references: [id], onDelete: Cascade)
+  mnemonicVaultId Int            @unique
+  mnemonic        Vault?         @relation("sparkMnemonic", fields: [mnemonicVaultId], references: [id])
+}
+
 model WalletRecvNWC {
   id         Int            @id @default(autoincrement())
   createdAt  DateTime       @default(now()) @map("created_at")
@@ -1498,3 +1515,12 @@ model WalletRecvClink {
   protocol   WalletProtocol @relation(fields: [protocolId], references: [id], onDelete: Cascade)
   noffer     String
 }
+
+model WalletRecvSpark {
+  id         Int            @id @default(autoincrement())
+  createdAt  DateTime       @default(now()) @map("created_at")
+  updatedAt  DateTime       @default(now()) @updatedAt @map("updated_at")
+  protocolId Int            @unique
+  protocol   WalletProtocol @relation(fields: [protocolId], references: [id], onDelete: Cascade)
+  address    String
+}

```

</details>

### 2. Update JS code

**2.1 Add protocol lib file**

- add file to [wallets/lib/protocols](/wallets/lib/protocols) (see [JSDoc](/wallets/lib/protocols/index.js) for details)
- import in index.js file and add to default export
- update JSDoc in index.js by adding the name to `ProtocolName`

**2.2 Add protocol method file**

- if protocol to receive payments: Add file to [wallets/server/protocols](/wallets/server/protocols) (see [JSDoc](/wallets/server/protocols/index.js) for details)
- if protocol to send payments: Add file to [wallets/client/protocols](/wallets/client/protocols) (see [JSDoc](/wallets/client/protocols/index.js) for details)
- import in index.js file and add to default export

#### Protocol cancellation contract

Every wallet protocol method receives an `AbortSignal` in its options. Adapters
must respect that signal for sends, receives, tests, balance reads, and any
polling they start.

- Pass `signal` through to `snFetch`, `fetch`, LNURL/NWC helpers, or SDK calls
  that accept a signal.
- Use `throwIfAborted(signal)` before starting work that cannot be interrupted.
- Use `raceAbort(promise, signal)` around SDK/provider calls that do not accept a
  signal so the adapter rejects promptly when the wallet shell times out.
- Use `abortableSleep(ms, signal)` in polling loops. Plain `sleep(ms)` can leave
  a loop running after the caller gives up.
- Clean up local resources in `finally` blocks after aborts, such as pools,
  sockets, listeners, and temporary sessions.

Some wallet providers cannot cancel an already-submitted payment internally. In
those cases the adapter still must reject on `signal`; the underlying wallet may
continue in the background, and the send UI will show the in-flight warning.

#### Send failure-classification contract

"This payment definitively failed" is the claim that needs proof. Unless an
adapter proves it, `sendWalletPayment` classifies a send error as
settled-unknown and the direct-send UI warns "may still be in flight" instead
of inviting a retry that double-pays. A forgotten case over-warns; it never
loses money. To prove a failure is safe to retry:

- Throw `WalletPaymentRejectedError` exactly where the provider itself reports
  the payment terminally failed — an error response, a `FAILED` status, or a
  terminal `{ error }` returned by your `pollUntilSettled` classify callback
  (`pollUntilSettled` throws it for you).
- Throw `WalletValidationError`/`WalletConfigurationError` (or subclasses) for
  problems that occur before any payment is attempted, such as missing
  permissions or a missing browser extension.

Everything else — transport errors, SDK throws, abort/timeout rejections — is
classified as settled-unknown automatically; never convert one into a
definitive failure. When the payment settled but is unprovable (e.g. an
intra-ledger settlement), return a missing/`undefined` preimage and
`sendWalletPayment`'s proof check surfaces it as settled-unknown.

<details>
<summary>Example: JS code to add Spark</summary>

```diff
commit 53f6de1e4380a3209bf0beba966b9592259f11de
Author: ekzyis <ek@stacker.news>
Date:   Tue Sep 23 07:41:47 2025 +0200

    JS code for Spark

diff --git a/wallets/client/protocols/index.js b/wallets/client/protocols/index.js
index c25805f7..3d6b00f6 100644
--- a/wallets/client/protocols/index.js
+++ b/wallets/client/protocols/index.js
@@ -5,6 +5,7 @@ import * as blink from './blink'
 import * as webln from './webln'
 import * as lnc from './lnc'
 import * as clnRest from './clnRest'
+import * as spark from './spark'

 export * from './util'

@@ -54,5 +55,6 @@ export default [
   blink,
   webln,
   lnc,
-  clnRest
+  clnRest,
+  spark
 ]
diff --git a/wallets/client/protocols/spark.js b/wallets/client/protocols/spark.js
new file mode 100644
index 00000000..ef3209e6
--- /dev/null
+++ b/wallets/client/protocols/spark.js
@@ -0,0 +1,7 @@
+export const name = 'SPARK'
+
+export async function sendPayment (bolt11, { mnemonic }, { signal }) {
+  // TODO: implement
+}
+
+export async function testSendPayment (config, { signal }) {}
diff --git a/wallets/lib/protocols/index.js b/wallets/lib/protocols/index.js
index a999fb37..7812e23a 100644
--- a/wallets/lib/protocols/index.js
+++ b/wallets/lib/protocols/index.js
@@ -8,10 +8,11 @@ import phoenixdSuite from './phoenixd'
 import blinkSuite from './blink'
 import webln from './webln'
 import clink from './clink'
+import sparkSuite from './spark'

 /**
  * Protocol names as used in the database
- * @typedef {'NWC'|'LNBITS'|'PHOENIXD'|'BLINK'|'WEBLN'|'LN_ADDR'|'LNC'|'CLN_REST'|'LND_GRPC'|'CLINK'} ProtocolName
+ * @typedef {'NWC'|'LNBITS'|'PHOENIXD'|'BLINK'|'WEBLN'|'LN_ADDR'|'LNC'|'CLN_REST'|'LND_GRPC'|'CLINK'|'SPARK'} ProtocolName
  * @typedef {'text'|'password'} InputType
  */

@@ -49,5 +50,6 @@ export default [
   ...lnbitsSuite,
   ...blinkSuite,
   webln,
-  clink
+  clink,
+  ...sparkSuite
 ]
diff --git a/wallets/lib/protocols/spark.js b/wallets/lib/protocols/spark.js
new file mode 100644
index 00000000..0c4ba2dd
--- /dev/null
+++ b/wallets/lib/protocols/spark.js
@@ -0,0 +1,39 @@
+import { bip39Validator, externalLightningAddressValidator } from '@/wallets/lib/validate'
+
+// Spark
+// https://github.com/breez/spark-sdk
+// https://sdk-doc-spark.breez.technology/
+
+export default [
+  {
+    name: 'SPARK',
+    send: true,
+    displayName: 'Spark',
+    fields: [
+      {
+        name: 'mnemonic',
+        label: 'mnemonic',
+        type: 'password',
+        required: true,
+        validate: bip39Validator(),
+        encrypt: true
+      }
+    ],
+    relationName: 'walletSendSpark'
+  },
+  {
+    name: 'SPARK',
+    send: false,
+    displayName: 'Spark',
+    fields: [
+      {
+        name: 'address',
+        label: 'address',
+        type: 'text',
+        required: true,
+        validate: externalLightningAddressValidator
+      }
+    ],
+    relationName: 'walletRecvSpark'
+  }
+]
diff --git a/wallets/lib/wallets.json b/wallets/lib/wallets.json
index 1975a9d2..98fe5bf8 100644
--- a/wallets/lib/wallets.json
+++ b/wallets/lib/wallets.json
@@ -168,5 +168,9 @@
         "displayName": "Blitz Wallet",
         "image": "/wallets/blitz.png",
         "url": "https://blitz-wallet.com/"
+    },
+    {
+        "name": "SPARK",
+        "displayName": "Spark"
     }
 ]
diff --git a/wallets/server/protocols/index.js b/wallets/server/protocols/index.js
index 6bf8ca04..6151e217 100644
--- a/wallets/server/protocols/index.js
+++ b/wallets/server/protocols/index.js
@@ -6,6 +6,7 @@ import * as phoenixd from './phoenixd'
 import * as blink from './blink'
 import * as lndGrpc from './lndGrpc'
 import * as clink from './clink'
+import * as spark from './spark'

 export * from './util'

@@ -58,5 +59,6 @@ export default [
   phoenixd,
   blink,
   lndGrpc,
-  clink
+  clink,
+  spark
 ]
diff --git a/wallets/server/protocols/spark.js b/wallets/server/protocols/spark.js
new file mode 100644
index 00000000..abc610ac
--- /dev/null
+++ b/wallets/server/protocols/spark.js
@@ -0,0 +1,16 @@
+export const name = 'SPARK'
+
+export async function createInvoice (
+  { msats, description, descriptionHash, expiry },
+  { address },
+  { signal }
+) {
+  // TODO: implement
+}
+
+export async function testCreateInvoice ({ address }, { signal }) {
+  return await createInvoice(
+    { msats: 1000, description: 'SN test invoice', expiry: 1 },
+    { address },
+    { signal })
+}

```

</details>

### 3. Update GraphQL code

- add GraphQL output type for the protocol (e.g. `WalletSendSpark`)
- add the output type to the `WalletProtocolConfig` union
- add the output type to the `WalletProtocolFields` fragment via spread (...)
- add a typed config input (e.g. `WalletSendSparkConfigInput`) and a branch in
  the `WalletProtocolConfigInput @oneOf` wrapper, keyed by the protocol's
  relation name (e.g. `walletSendSpark`)
- for receive protocols, add a branch to the `WalletRecvProtocolTestInput @oneOf`
  wrapper (the recv config input doubles as the test input)
- resolve the output type in `mapWalletResolveTypes`

There is no per-protocol upsert/remove or test mutation: configure-save goes
through the atomic `saveWalletProtocols` mutation and probe-testing goes
through `testWalletRecvProtocol`. Both dispatch on the typed config branch via
`reverseProtocolRelationName`, so adding a protocol only touches the schema,
one client fragment, and one resolver helper.

<details>
<summary>Example: GraphQL changes to add Spark</summary>

```diff
diff --git a/api/typeDefs/wallet.js b/api/typeDefs/wallet.js
--- a/api/typeDefs/wallet.js
+++ b/api/typeDefs/wallet.js
@@ union WalletProtocolConfig =
     | WalletSendCLNRest
     | WalletSendClink
+    | WalletSendSpark
     | WalletRecvNWC
     ...
     | WalletRecvClink
+    | WalletRecvSpark

@@ type WalletSendClink {
     ndebit: VaultEntry!
     secretKey: VaultEntry!
   }

+  type WalletSendSpark {
+    id: ID!
+    mnemonic: VaultEntry!
+  }
+
   type WalletRecvNWC {
     ...
   }
@@ type WalletRecvClink {
     id: ID!
     noffer: String!
   }

+  type WalletRecvSpark {
+    id: ID!
+    address: String!
+  }

@@ input WalletProtocolConfigInput @oneOf {
     walletSendClink: WalletSendClinkConfigInput
     walletRecvClink: WalletRecvClinkConfigInput
+    walletSendSpark: WalletSendSparkConfigInput
+    walletRecvSpark: WalletRecvSparkConfigInput
     # WebLN has no fields; the boolean is a sentinel and must be true.
     walletSendWebLN: Boolean
   }

@@ input WalletRecvProtocolTestInput @oneOf {
     walletRecvClink: WalletRecvClinkConfigInput
+    walletRecvSpark: WalletRecvSparkConfigInput
   }

@@ input WalletRecvClinkConfigInput { noffer: String! }
+  input WalletSendSparkConfigInput { mnemonic: VaultEntryInput! }
+  input WalletRecvSparkConfigInput { address: String! }

diff --git a/wallets/client/fragments/wallet.js b/wallets/client/fragments/wallet.js
--- a/wallets/client/fragments/wallet.js
+++ b/wallets/client/fragments/wallet.js
@@ ... on WalletSendClink { ... }
+      ... on WalletSendSpark {
+        id
+        encryptedMnemonic: mnemonic {
+          ...VaultEntryFields
+        }
+      }
       ... on WalletRecvNWC {
         ...
       }
@@ ... on WalletRecvClink {
         id
         noffer
       }
+      ... on WalletRecvSpark {
+        id
+        address
+      }
     }
   }
 `

diff --git a/wallets/server/resolvers/util.js b/wallets/server/resolvers/util.js
--- a/wallets/server/resolvers/util.js
+++ b/wallets/server/resolvers/util.js
@@ case 'CLINK':
         return send ? 'WalletSendClink' : 'WalletRecvClink'
+      case 'SPARK':
+        return send ? 'WalletSendSpark' : 'WalletRecvSpark'
       default:
         return null
     }
```

Notes:
- Receive-side `WalletRecv*ConfigInput` types do double duty as the test-mutation
  inputs, so the `WalletRecvProtocolTestInput` branch reuses the same type
  instead of declaring a separate `*TestInput`.
- No new `gql` documents are needed in `wallets/client/fragments/protocol.js`
  and no new lookup-table cases are needed in `wallets/client/hooks/query.js` —
  `useSaveWallet` and `useTestCreateInvoice` already dispatch on the protocol's
  relation name.

</details>
