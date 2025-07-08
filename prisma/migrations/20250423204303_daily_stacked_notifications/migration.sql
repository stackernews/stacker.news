-- Add notification preference for daily stacked notifications
ALTER TABLE users ADD COLUMN "noteDailyStacked" BOOLEAN NOT NULL DEFAULT true;