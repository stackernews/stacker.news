-- make sure integers/floats are positive (or null if optional)

-- users
ALTER TABLE users ADD CONSTRAINT "msats_positive" CHECK ("msats" >= 0) NOT VALID;
ALTER TABLE users ADD CONSTRAINT "stackedMsats_positive" CHECK ("stackedMsats" >= 0) NOT VALID;
ALTER TABLE users ADD CONSTRAINT "freeComments_positive" CHECK ("freeComments" >= 0) NOT VALID;
ALTER TABLE users ADD CONSTRAINT "freePosts_positive" CHECK ("freePosts" >= 0) NOT VALID;
ALTER TABLE users ADD CONSTRAINT "tipDefault_positive" CHECK ("tipDefault" >= 0) NOT VALID;

-- upload
ALTER TABLE "Upload" ADD CONSTRAINT "size_positive" CHECK ("size" >= 0) NOT VALID;
ALTER TABLE "Upload" ADD CONSTRAINT "width_positive" CHECK ("width" IS NULL OR "width" >= 0) NOT VALID;
ALTER TABLE "Upload" ADD CONSTRAINT "height_positive" CHECK ("height" IS NULL OR "height" >= 0) NOT VALID;

-- earn
ALTER TABLE "Earn" ADD CONSTRAINT "msats_positive" CHECK ("msats" >= 0) NOT VALID;

-- invite
ALTER TABLE "Invite" ADD CONSTRAINT "gift_positive" CHECK ("gift" IS NULL OR "gift" >= 0) NOT VALID;
ALTER TABLE "Invite" ADD CONSTRAINT "limit_positive" CHECK ("limit" IS NULL OR "limit" >= 0) NOT VALID;

-- item
ALTER TABLE "Item" ADD CONSTRAINT "boost_positive" CHECK ("boost" >= 0) NOT VALID;
ALTER TABLE "Item" ADD CONSTRAINT "minSalary_positive" CHECK ("minSalary" IS NULL OR "minSalary" >= 0) NOT VALID;
ALTER TABLE "Item" ADD CONSTRAINT "maxSalary_positive" CHECK ("maxSalary" IS NULL OR "maxSalary" >= 0) NOT VALID;
ALTER TABLE "Item" ADD CONSTRAINT "maxBid_positive" CHECK ("maxBid" IS NULL OR "maxBid" >= 0) NOT VALID;
ALTER TABLE "Item" ADD CONSTRAINT "pollCost_positive" CHECK ("pollCost" IS NULL OR "pollCost" >= 0) NOT VALID;

-- sub
ALTER TABLE "Sub" ADD CONSTRAINT "baseCost_positive" CHECK ("baseCost" >= 0) NOT VALID;

-- item_act
ALTER TABLE "ItemAct" ADD CONSTRAINT "sats_positive" CHECK ("sats" >= 0) NOT VALID;

-- invoice
ALTER TABLE "Invoice" ADD CONSTRAINT "msatsRequested_positive" CHECK ("msatsRequested" >= 0) NOT VALID;
ALTER TABLE "Invoice" ADD CONSTRAINT "msatsReceived_positive" CHECK ("msatsReceived" IS NULL OR "msatsReceived" >= 0) NOT VALID;

-- withdrawl
ALTER TABLE "Withdrawl" ADD CONSTRAINT "msatsPaying_positive" CHECK ("msatsPaying" >= 0) NOT VALID;
ALTER TABLE "Withdrawl" ADD CONSTRAINT "msatsPaid_positive" CHECK ("msatsPaid" IS NULL OR "msatsPaid" >= 0) NOT VALID;
ALTER TABLE "Withdrawl" ADD CONSTRAINT "msatsFeePaying_positive" CHECK ("msatsFeePaying" >= 0) NOT VALID;
ALTER TABLE "Withdrawl" ADD CONSTRAINT "msatsFeePaid_positive" CHECK ("msatsFeePaid" IS NULL OR "msatsFeePaid" >= 0) NOT VALID;