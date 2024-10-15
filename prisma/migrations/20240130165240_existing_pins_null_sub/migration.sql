-- all existing pins shouldn't have a subName
-- this only impacts old daily discussion threads
update "Item" set "subName" = null where "pinId" is not null;