import 'server-only';
import { prisma } from '@/lib/prisma';

// ==== Connection secret crypto ====
// Wrappers around pgcrypto's pgp_sym_encrypt/pgp_sym_decrypt. Symmetric so we
// can replay credentials on every external fetch. Key lives in env so DB dumps
// alone don't leak credentials.
//
// Run prisma/crypto.sql once after `prisma db push` to enable pgcrypto.

function getKey(): string {
  const key = process.env.CONNECTION_SECRET_KEY;
  if (!key) throw new Error('CONNECTION_SECRET_KEY is not set');
  return key;
}

/** Encrypt a JSON-serializable value into bytea for storage in Connection.secret. */
export async function encryptSecret(value: unknown): Promise<Buffer> {
  const plaintext = JSON.stringify(value ?? {});
  const key = getKey();
  const [row] = await prisma.$queryRaw<[{ ciphertext: Buffer }]>`
    SELECT pgp_sym_encrypt(${plaintext}::text, ${key}::text) AS ciphertext
  `;
  return Buffer.from(row.ciphertext);
}

/** Decrypt a Connection.secret bytea back into its original JSON value. */
export async function decryptSecret<T = unknown>(ciphertext: Uint8Array | Buffer): Promise<T> {
  const key = getKey();
  const [row] = await prisma.$queryRaw<[{ plaintext: string }]>`
    SELECT pgp_sym_decrypt(${ciphertext}::bytea, ${key}::text) AS plaintext
  `;
  return JSON.parse(row.plaintext) as T;
}
