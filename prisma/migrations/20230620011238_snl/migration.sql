-- CreateTable
CREATE TABLE "Snl" (
    "id" SERIAL NOT NULL,
    "live" BOOLEAN NOT NULL DEFAULT false,

    PRIMARY KEY ("id")
);

INSERT INTO "Snl" ("live")  VALUES (false);
INSERT INTO "users" ("name")  VALUES ('live');
