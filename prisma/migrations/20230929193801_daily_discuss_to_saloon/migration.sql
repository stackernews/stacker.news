UPDATE "Item"
SET "userId" = 17226
WHERE "pinId" = (select "pinId" from "Item" where title = 'Stacker Saloon' and "userId" = 17226 limit 1);