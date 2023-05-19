-- DropIndex
DROP INDEX IF EXISTS "ItemAct.itemId_act_userId_index";

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ItemAct.itemId_userId_act_index" ON "ItemAct"("itemId", "userId", "act");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ItemAct.userId_created_at_act_index" ON "ItemAct"("userId", "created_at", "act");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ItemAct.itemId_created_at_act_index" ON "ItemAct"("itemId", "created_at", "act");
