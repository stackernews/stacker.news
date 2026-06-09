Deleting DB columns from the application will typically causes brief outages if not done carefully.

This is because we do rolling updates on deployments and several incompatible versions of the application may be running at different layers of the stack.

Avoiding this usually requires three deployments in this order:

1. first remove any reference to the column from client side graphql queries
2. then remove the column from any graphql type definitions and use the `@ignore` directive in the prisma schema to prevent the column from being included in prisma's generated client code
3. finally, run a prisma migration to remove the column from the database

Why?

1. if the graphql type definitions change before clients, clients with older versions will query fields that don't exist
2. if the database schema changes before prisma's generated client code, servers running the old generated client code will attempt to read columns that don't exist