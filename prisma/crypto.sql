-- Run once against your Neon database after prisma db push (after schema/connection.prisma exists).
-- Enables pgcrypto so encrypt/decrypt of Connection.secret works via pgp_sym_encrypt/pgp_sym_decrypt.
-- Key comes from process.env.CONNECTION_SECRET_KEY at query time (passed by src/lib/crypto.ts).

CREATE EXTENSION IF NOT EXISTS pgcrypto;
