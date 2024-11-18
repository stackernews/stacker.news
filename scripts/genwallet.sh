#!/usr/bin/env bash

cat <<EOF
                                     .__  .__          __
   ____   ____   ______  _  _______  |  | |  |   _____/  |_
  / ___\_/ __ \ /    \ \/ \/ /\__  \ |  | |  | _/ __ \   __\\
 / /_/  >  ___/|   |  \     /  / __ \|  |_|  |_\  ___/|  |
 \___  / \___  >___|  /\/\_/  (____  /____/____/\___  >__|
/_____/      \/     \/             \/               \/

EOF

error () {
    echo -n "error: $1"
    exit 1
}

wallet=$1
[ -z $wallet ] && read -p "Enter wallet name: " wallet
[ -z $wallet ] && error "name required"

# default is wallet in UPPERCASE
walletType="${wallet^^}"
read -p "Enter walletType (default $walletType): " _walletType
if [ ! -z $_walletType ]; then
    walletType=$_walletType
fi

# default is wallet capitalized with "wallet" prefix
walletField="wallet${wallet^}"
read -p "Enter walletField (default $walletField): " _walletField
if [ ! -z $_walletField ]; then
    walletField=$_walletField
fi

# exit on first failed command
set -e

todo() {
    echo "// $wallet::TODO"
}

# create folder and index.js
mkdir -p wallets/$wallet
cat > wallets/$wallet/index.js <<EOF
$(todo)
// create validation schema for wallet and import here
// import { ${wallet}Schema } from '@/lib/validate'

export const name = '$wallet'

$(todo)
// configure wallet fields
export const fields = []

$(todo)
// configure wallet card
export const card = {
    title: '$wallet',
    subtitle: '',
}

$(todo)
// set validation schema
export const fieldValidation = null // ${wallet}Schema

export const walletType = '$walletType'

export const walletField = '$walletField'

EOF

# create client.js
cat > wallets/$wallet/client.js <<EOF
export * from '@/wallets/$wallet'

export async function testSendPayment (config, { logger }) {
    $(todo)
}

export async function sendPayment (bolt11, config) {
    $(todo)
}

EOF

# create server.js
cat > wallets/$wallet/server.js <<EOF
export * from '@/wallets/$wallet'

export async function testCreateInvoice (config) {
    $(todo)
}

export async function createInvoice (
    { msats, description, descriptionHash, expiry },
    config
) {
    $(todo)
}

EOF

# add TODOs where manual update is needed
fragments=fragments/wallet.js
i=0
grep -n "// XXX \[WALLET\]" $fragments | while read -r match;
do
    lineno=$(echo $match | cut -d':' -f1)
    sed -i "$((lineno+i))i $(todo)" $fragments
    i=$((i+1))
done

client=wallets/client.js
lineno=$(grep -n "export default" $client | cut -d':' -f1)
sed -i "${lineno}i $(todo)" $client

server=wallets/server.js
lineno=$(grep -n "export default" $server | cut -d':' -f1)
sed -i "${lineno}i $(todo)" $server

# need to disable exit on failure since we run grep to check its exit code
set +e

# check if prisma/schema.prisma needs patch
schema=prisma/schema.prisma
grep --quiet "$walletField" $schema
if [ $? -eq 1 ]; then
    tablename=${walletField^}
    # find line to insert walletField in wallet model
    lineno=$(grep -n "model Wallet {" $schema | cut -d':' -f1)
    offset=$(tail -n +$lineno $schema | grep -nm 1 "}" | cut -d':' -f1)
    offset=$(tail -n +$lineno $schema | head -n $offset | grep -nE "wallet[[:alpha:]]+\s+ Wallet[[:alpha:]]" | cut -d':' -f1 | tail -n1)
    sed -i "$((lineno+offset))i\ \ $walletField $tablename?" $schema

    # find line to insert model for wallet
    lineno=$(grep -nE "model Wallet[[:alpha:]]+ {" $schema | cut -d':' -f1 | tail -n1)
    offset=$(tail -n +$((lineno+1)) $schema | grep -nm 1 "{" | cut -d':' -f1)
    i=$((lineno+offset))
    sed -i "${i}i $(todo)" $schema
    sed -i "$((i+1))i model Wallet${wallet^} {\n" $schema
    sed -i "$((i+2))i\ \ id Int @id @default(autoincrement())" $schema
    sed -i "$((i+3))i\ \ walletId Int @unique" $schema
    sed -i "$((i+4))i\ \ wallet Wallet @relation(fields: [walletId], references: [id], onDelete: Cascade)" $schema
    sed -i "$((i+5))i\ \ createdAt DateTime @default(now()) @map(\"created_at\")" $schema
    sed -i "$((i+6))i\ \ updatedAt DateTime @default(now()) @updatedAt @map(\"updated_at\")" $schema
    sed -i "$((i+7))i }" $schema

    # find line to insert wallet type
    lineno=$(grep -nE "enum WalletType {" $schema | cut -d':' -f1)
    offset=$(tail -n +$lineno $schema | grep -nm 1 "}" | cut -d':' -f1)
    i=$((lineno+offset-1))
    sed -i "${i} i\ \ ${walletType}" $schema

    # create migration file with TODOs
    migrationDir="prisma/migrations/$(date +%Y%m%d%H%M%S_$wallet)"
    mkdir -p $migrationDir
    cat > $migrationDir/migration.sql <<EOF
-- AlterEnum
ALTER TYPE "WalletType" ADD VALUE '${walletType}';

-- CreateTable
CREATE TABLE "$tablename" (
    "id" SERIAL NOT NULL,
    "walletId" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- $wallet::TODO

    CONSTRAINT "${tablename}_pkey" PRIMARY KEY ("int")
);

-- CreateIndex
CREATE UNIQUE INDEX "${tablename}_walletId_key" ON "$tablename"("walletId");

-- AddForeignKey
ALTER TABLE "$tablename" ADD CONSTRAINT "${tablename}_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TRIGGER wallet_${wallet}_as_jsonb
AFTER INSERT OR UPDATE ON "$tablename"
FOR EACH ROW EXECUTE PROCEDURE wallet_wallet_type_as_jsonb();
EOF
fi
