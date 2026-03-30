-- allow users to set sat filters to NULL (meaning "show all / no filter")
ALTER TABLE "users" ALTER COLUMN "postsSatsFilter" DROP NOT NULL;
ALTER TABLE "users" ALTER COLUMN "commentsSatsFilter" DROP NOT NULL;
