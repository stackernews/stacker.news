git clone https://gitlab.com/dalibo/postgresql_anonymizer.git
make extension
make install

-- todo need a function to modify foreign key distribution
-- like randomly assign a valid foreign key to a row

anon.random_in(SELECT id FROM users)

ALTER DATABASE sample SET session_preload_libraries = 'anon';
ALTER DATABASE sample SET anon.privacy_by_default = true;
-- restart session
-- turn off triggers
SET session_replication_role = replica;
CREATE EXTENSION IF NOT EXISTS anon CASCADE;
SELECT anon.init();

-- basically we dont want to mask the following columns ... preferring instead to shuffle the data
-- and in some cases introduce noise
-- users
SELECT anon.shuffle_column('users', 'created_at', 'id');
SELECT anon.shuffle_column('users', 'updated_at', 'id');
SELECT anon.shuffle_column('users', 'lastSeenAt', 'id');
SELECT anon.shuffle_column('users', 'inviteId', 'id');
SELECT anon.shuffle_column('users', 'referrerId', 'id');
SELECT anon.shuffle_column('users', 'msats', 'id');
SELECT anon.shuffle_column('users', 'stackedMsats', 'id');
SELECT anon.shuffle_column('users', 'bioId', 'id');
-- introduce noise on these columns
SELECT anon.add_noise_on_numeric_column('users', 'msats', 1);
SELECT anon.add_noise_on_numeric_column('users', 'stackedMsats', 1);
-- set masking for columns we want to mask
SECURITY LABEL FOR anon ON COLUMN users.name
IS 'MASKED WITH VALUE anon.fake_first_name() || anon.fake_last_name() || anon.random_string(3)';
-- set not to mask for columns we don't want to mask
SECURITY LABEL FOR anon ON COLUMN users.created_at
IS 'NOT MASKED';
SECURITY LABEL FOR anon ON COLUMN users.updated_at
IS 'NOT MASKED';
SECURITY LABEL FOR anon ON COLUMN users."lastSeenAt"
IS 'NOT MASKED';
SECURITY LABEL FOR anon ON COLUMN users."inviteId"
IS 'NOT MASKED';
SECURITY LABEL FOR anon ON COLUMN users."referrerId"
IS 'NOT MASKED';
SECURITY LABEL FOR anon ON COLUMN users.msats
IS 'NOT MASKED';
SECURITY LABEL FOR anon ON COLUMN users."stackedMsats"
IS 'NOT MASKED';
SECURITY LABEL FOR anon ON COLUMN users."bioId"
IS 'NOT MASKED';

select

-- donation
SELECT anon.shuffle_column('"Donation"', 'created_at', 'id');
SELECT anon.shuffle_column('"Donation"', 'updated_at', 'id');
-- introduce noise on these columns
SELECT anon.add_noise_on_numeric_column('"Donation"', 'sats', 1);
-- set masking for columns we want to mask
SECURITY LABEL FOR anon ON COLUMN "Donation"."userId"
IS 'MASKED WITH FUNCTION anon.random_in(ARRAY(SELECT id FROM users))';
-- set not to mask for columns we don't want to mask
SECURITY LABEL FOR anon ON COLUMN "Donation".created_at
IS 'NOT MASKED';
SECURITY LABEL FOR anon ON COLUMN "Donation".updated_at
IS 'NOT MASKED';
SECURITY LABEL FOR anon ON COLUMN users."lastSeenAt"
IS 'NOT MASKED';



-- earn
-- Invite
-- Item
-- ItemAct
-- ItemForward
-- PollOption
-- PollVote
-- Sub
-- SubAct
-- Pin
-- ReferralAct

-- truncate tables that are irrelevant for local development
TRUNCATE TABLE "Wallet";
TRUNCATE TABLE "WalletLightningAddress";
TRUNCATE TABLE "WalletLND";
TRUNCATE TABLE "Mute";
TRUNCATE TABLE "Arc";
TRUNCATE TABLE "Streak";
TRUNCATE TABLE "NostrRelay";
TRUNCATE TABLE "UserNostrRelay";
TRUNCATE TABLE "LNAuth";
TRUNCATE TABLE "LnWith";
TRUNCATE TABLE "Message";
TRUNCATE TABLE "MuteSub";
TRUNCATE TABLE "Mention";
TRUNCATE TABLE "Invoice";
TRUNCATE TABLE "Withdrawal";
TRUNCATE TABLE "Account";
TRUNCATE TABLE "OFAC";
TRUNCATE TABLE "Session";
TRUNCATE TABLE "VerificationToken";
TRUNCATE TABLE "ThreadSubscription";
TRUNCATE TABLE "UserSubscription";
TRUNCATE TABLE "PushSubscription";
TRUNCATE TABLE "Log";

SELECT anon.add_noise_on_datetime_column('users', 'created_at', '1 year');
SELECT anon.add_noise_on_datetime_column('users', 'updated_at', '1 year');




SELECT anon.shuffle_column('"Item"', 'userId', 'id');