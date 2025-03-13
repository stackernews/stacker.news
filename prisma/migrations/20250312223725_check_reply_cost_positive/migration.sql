-- Add constraint to ensure replyCost is positive
ALTER TABLE "Sub" ADD CONSTRAINT "Sub_replyCost_positive" CHECK ("replyCost" > 0);