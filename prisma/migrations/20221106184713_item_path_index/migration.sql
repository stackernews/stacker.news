-- This is an empty migration.
ALTER EXTENSION ltree UPDATE TO '1.2';
DROP INDEX "Item.path_index";
CREATE INDEX "Item.path_index" ON "Item" USING GIST  ("path" gist_ltree_ops(siglen=2024));