-- CreateIndex
CREATE INDEX "Invite.userId_index" ON "Invite"("userId");

-- CreateIndex
CREATE INDEX "Invite.created_at_index" ON "Invite"("created_at");

-- CreateIndex
CREATE INDEX "users.inviteId_index" ON "users"("inviteId");
