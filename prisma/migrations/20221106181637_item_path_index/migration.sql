-- This is an empty migration.
DROP INDEX "Item.path_index";
CREATE INDEX "Item.path_index" ON "Item" USING GIST  ("path" gist_ltree_ops(siglen=2024));
