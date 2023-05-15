-- DropForeignKey
ALTER TABLE "Bookmark" DROP CONSTRAINT "Bookmark_itemId_fkey";

-- DropForeignKey
ALTER TABLE "Bookmark" DROP CONSTRAINT "Bookmark_userId_fkey";

-- DropForeignKey
ALTER TABLE "Donation" DROP CONSTRAINT "Donation_userId_fkey";

-- DropForeignKey
ALTER TABLE "Earn" DROP CONSTRAINT "Earn_userId_fkey";

-- DropForeignKey
ALTER TABLE "Invite" DROP CONSTRAINT "Invite_userId_fkey";

-- DropForeignKey
ALTER TABLE "Invoice" DROP CONSTRAINT "Invoice_userId_fkey";

-- DropForeignKey
ALTER TABLE "Item" DROP CONSTRAINT "Item_userId_fkey";

-- DropForeignKey
ALTER TABLE "ItemAct" DROP CONSTRAINT "ItemAct_itemId_fkey";

-- DropForeignKey
ALTER TABLE "ItemAct" DROP CONSTRAINT "ItemAct_userId_fkey";

-- DropForeignKey
ALTER TABLE "Mention" DROP CONSTRAINT "Mention_itemId_fkey";

-- DropForeignKey
ALTER TABLE "Mention" DROP CONSTRAINT "Mention_userId_fkey";

-- DropForeignKey
ALTER TABLE "Message" DROP CONSTRAINT "Message_userId_fkey";

-- DropForeignKey
ALTER TABLE "PollOption" DROP CONSTRAINT "PollOption_itemId_fkey";

-- DropForeignKey
ALTER TABLE "PollVote" DROP CONSTRAINT "PollVote_itemId_fkey";

-- DropForeignKey
ALTER TABLE "PollVote" DROP CONSTRAINT "PollVote_pollOptionId_fkey";

-- DropForeignKey
ALTER TABLE "PollVote" DROP CONSTRAINT "PollVote_userId_fkey";

-- DropForeignKey
ALTER TABLE "ReferralAct" DROP CONSTRAINT "ReferralAct_itemActId_fkey";

-- DropForeignKey
ALTER TABLE "ReferralAct" DROP CONSTRAINT "ReferralAct_referrerId_fkey";

-- DropForeignKey
ALTER TABLE "Streak" DROP CONSTRAINT "Streak_userId_fkey";

-- DropForeignKey
ALTER TABLE "Subscription" DROP CONSTRAINT "Subscription_subName_fkey";

-- DropForeignKey
ALTER TABLE "Subscription" DROP CONSTRAINT "Subscription_userId_fkey";

-- DropForeignKey
ALTER TABLE "Upload" DROP CONSTRAINT "Upload_userId_fkey";

-- DropForeignKey
ALTER TABLE "UserNostrRelay" DROP CONSTRAINT "UserNostrRelay_nostrRelayAddr_fkey";

-- DropForeignKey
ALTER TABLE "UserNostrRelay" DROP CONSTRAINT "UserNostrRelay_userId_fkey";

-- DropForeignKey
ALTER TABLE "Withdrawl" DROP CONSTRAINT "Withdrawl_userId_fkey";

-- AlterTable
ALTER TABLE "ItemAct" RENAME CONSTRAINT "Vote_pkey" TO "ItemAct_pkey";

-- AddForeignKey
ALTER TABLE "Streak" ADD CONSTRAINT "Streak_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserNostrRelay" ADD CONSTRAINT "UserNostrRelay_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserNostrRelay" ADD CONSTRAINT "UserNostrRelay_nostrRelayAddr_fkey" FOREIGN KEY ("nostrRelayAddr") REFERENCES "NostrRelay"("addr") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Donation" ADD CONSTRAINT "Donation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Upload" ADD CONSTRAINT "Upload_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Earn" ADD CONSTRAINT "Earn_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invite" ADD CONSTRAINT "Invite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PollOption" ADD CONSTRAINT "PollOption_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PollVote" ADD CONSTRAINT "PollVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PollVote" ADD CONSTRAINT "PollVote_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PollVote" ADD CONSTRAINT "PollVote_pollOptionId_fkey" FOREIGN KEY ("pollOptionId") REFERENCES "PollOption"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_subName_fkey" FOREIGN KEY ("subName") REFERENCES "Sub"("name") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralAct" ADD CONSTRAINT "ReferralAct_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralAct" ADD CONSTRAINT "ReferralAct_itemActId_fkey" FOREIGN KEY ("itemActId") REFERENCES "ItemAct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemAct" ADD CONSTRAINT "ItemAct_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemAct" ADD CONSTRAINT "ItemAct_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mention" ADD CONSTRAINT "Mention_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mention" ADD CONSTRAINT "Mention_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Withdrawl" ADD CONSTRAINT "Withdrawl_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bookmark" ADD CONSTRAINT "Bookmark_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bookmark" ADD CONSTRAINT "Bookmark_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "Bookmark.created_at_index" RENAME TO "Bookmark_created_at_idx";

-- RenameIndex
ALTER INDEX "Earn.created_at_index" RENAME TO "Earn_created_at_idx";

-- RenameIndex
ALTER INDEX "Earn.created_at_userId_index" RENAME TO "Earn_created_at_userId_idx";

-- RenameIndex
ALTER INDEX "Earn.userId_index" RENAME TO "Earn_userId_idx";

-- RenameIndex
ALTER INDEX "Invite.created_at_index" RENAME TO "Invite_created_at_idx";

-- RenameIndex
ALTER INDEX "Invite.userId_index" RENAME TO "Invite_userId_idx";

-- RenameIndex
ALTER INDEX "Invoice.created_at_index" RENAME TO "Invoice_created_at_idx";

-- RenameIndex
ALTER INDEX "Invoice.hash_unique" RENAME TO "Invoice_hash_key";

-- RenameIndex
ALTER INDEX "Invoice.userId_index" RENAME TO "Invoice_userId_idx";

-- RenameIndex
ALTER INDEX "Item.bio_index" RENAME TO "Item_bio_idx";

-- RenameIndex
ALTER INDEX "Item.created_at_index" RENAME TO "Item_created_at_idx";

-- RenameIndex
ALTER INDEX "Item.freebie_index" RENAME TO "Item_freebie_idx";

-- RenameIndex
ALTER INDEX "Item.maxBid_index" RENAME TO "Item_maxBid_idx";

-- RenameIndex
ALTER INDEX "Item.parentId_index" RENAME TO "Item_parentId_idx";

-- RenameIndex
ALTER INDEX "Item.path_index" RENAME TO "Item_path_idx";

-- RenameIndex
ALTER INDEX "Item.pinId_index" RENAME TO "Item_pinId_idx";

-- RenameIndex
ALTER INDEX "Item.rootId_index" RENAME TO "Item_rootId_idx";

-- RenameIndex
ALTER INDEX "Item.statusUpdatedAt_index" RENAME TO "Item_statusUpdatedAt_idx";

-- RenameIndex
ALTER INDEX "Item.status_index" RENAME TO "Item_status_idx";

-- RenameIndex
ALTER INDEX "Item.subName_index" RENAME TO "Item_subName_idx";

-- RenameIndex
ALTER INDEX "Item.userId_index" RENAME TO "Item_userId_idx";

-- RenameIndex
ALTER INDEX "Item.weightedDownVotes_index" RENAME TO "Item_weightedDownVotes_idx";

-- RenameIndex
ALTER INDEX "Item.weightedVotes_index" RENAME TO "Item_weightedVotes_idx";

-- RenameIndex
ALTER INDEX "ItemAct.act_index" RENAME TO "ItemAct_act_idx";

-- RenameIndex
ALTER INDEX "ItemAct.created_at_index" RENAME TO "ItemAct_created_at_idx";

-- RenameIndex
ALTER INDEX "ItemAct.itemId_act_userId_index" RENAME TO "ItemAct_itemId_act_userId_idx";

-- RenameIndex
ALTER INDEX "LnAuth.k1_unique" RENAME TO "LnAuth_k1_key";

-- RenameIndex
ALTER INDEX "LnWith.k1_unique" RENAME TO "LnWith_k1_key";

-- RenameIndex
ALTER INDEX "Mention.created_at_index" RENAME TO "Mention_created_at_idx";

-- RenameIndex
ALTER INDEX "Mention.itemId_index" RENAME TO "Mention_itemId_idx";

-- RenameIndex
ALTER INDEX "Mention.itemId_userId_unique" RENAME TO "Mention_itemId_userId_key";

-- RenameIndex
ALTER INDEX "Mention.userId_index" RENAME TO "Mention_userId_idx";

-- RenameIndex
ALTER INDEX "PollOption.itemId_index" RENAME TO "PollOption_itemId_idx";

-- RenameIndex
ALTER INDEX "PollVote.itemId_userId_unique" RENAME TO "PollVote_itemId_userId_key";

-- RenameIndex
ALTER INDEX "PollVote.pollOptionId_index" RENAME TO "PollVote_pollOptionId_idx";

-- RenameIndex
ALTER INDEX "PollVote.userId_index" RENAME TO "PollVote_userId_idx";

-- RenameIndex
ALTER INDEX "Streak.startedAt_userId_unique" RENAME TO "Streak_startedAt_userId_key";

-- RenameIndex
ALTER INDEX "Streak.userId_index" RENAME TO "Streak_userId_idx";

-- RenameIndex
ALTER INDEX "Upload.created_at_index" RENAME TO "Upload_created_at_idx";

-- RenameIndex
ALTER INDEX "Upload.itemId_index" RENAME TO "Upload_itemId_idx";

-- RenameIndex
ALTER INDEX "Upload.itemId_unique" RENAME TO "Upload_itemId_key";

-- RenameIndex
ALTER INDEX "Upload.userId_index" RENAME TO "Upload_userId_idx";

-- RenameIndex
ALTER INDEX "Withdrawl.created_at_index" RENAME TO "Withdrawl_created_at_idx";

-- RenameIndex
ALTER INDEX "Withdrawl.userId_index" RENAME TO "Withdrawl_userId_idx";

-- RenameIndex
ALTER INDEX "accounts.compound_id_unique" RENAME TO "accounts_compound_id_key";

-- RenameIndex
ALTER INDEX "accounts.provider_account_id_index" RENAME TO "accounts_provider_account_id_idx";

-- RenameIndex
ALTER INDEX "accounts.provider_id_index" RENAME TO "accounts_provider_id_idx";

-- RenameIndex
ALTER INDEX "accounts.user_id_index" RENAME TO "accounts_user_id_idx";

-- RenameIndex
ALTER INDEX "sessions.access_token_unique" RENAME TO "sessions_access_token_key";

-- RenameIndex
ALTER INDEX "sessions.session_token_unique" RENAME TO "sessions_session_token_key";

-- RenameIndex
ALTER INDEX "users.created_at_index" RENAME TO "users_created_at_idx";

-- RenameIndex
ALTER INDEX "users.email_unique" RENAME TO "users_email_key";

-- RenameIndex
ALTER INDEX "users.inviteId_index" RENAME TO "users_inviteId_idx";

-- RenameIndex
ALTER INDEX "users.name_unique" RENAME TO "users_name_key";

-- RenameIndex
ALTER INDEX "users.pubkey_unique" RENAME TO "users_pubkey_key";

-- RenameIndex
ALTER INDEX "users.slashtagId_unique" RENAME TO "users_slashtagId_key";

-- RenameIndex
ALTER INDEX "verification_requests.token_unique" RENAME TO "verification_requests_token_key";
