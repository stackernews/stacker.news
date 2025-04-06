-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN "userCancel" BOOLEAN;

-- Migrate existing rows
UPDATE "Invoice" SET "userCancel" = false;

-- Add constraint to ensure consistent cancel state
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_cancel" CHECK (
  ("cancelled" = true AND "cancelledAt" IS NOT NULL AND "userCancel" IS NOT NULL) OR
  ("cancelled" = false AND "cancelledAt" IS NULL AND "userCancel" IS NULL)
);

-- Add trigger to set userCancel to false by default when cancelled updated and userCancel not specified
CREATE OR REPLACE FUNCTION invoice_set_user_cancel_default()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.cancelled AND NEW."userCancel" IS NULL THEN
    NEW."userCancel" := false;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER invoice_user_cancel_trigger
  BEFORE UPDATE ON "Invoice"
  FOR EACH ROW
  EXECUTE FUNCTION invoice_set_user_cancel_default();

