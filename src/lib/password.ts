import "server-only";

import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

// Node's built-in scrypt, so there's no native dependency to compile.
// N=2^15 is the OWASP-suggested floor.
const COST = 32768;
const BLOCK_SIZE = 8;
const PARALLELISM = 1;
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

// promisify() drops scrypt's options overload, so wrap it by hand.
function derive(
  password: string,
  salt: Buffer,
  keyLength: number,
  cost: number,
  blockSize: number,
  parallelism: number,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password.normalize("NFKC"),
      salt,
      keyLength,
      {
        N: cost,
        r: blockSize,
        p: parallelism,
        // scrypt needs memory proportional to N*r*128; the 32MB default is too low.
        maxmem: 128 * cost * blockSize * 2,
      },
      (error, key) => (error ? reject(error) : resolve(key)),
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const key = await derive(
    password,
    salt,
    KEY_LENGTH,
    COST,
    BLOCK_SIZE,
    PARALLELISM,
  );

  return [
    "scrypt",
    COST,
    BLOCK_SIZE,
    PARALLELISM,
    salt.toString("base64"),
    key.toString("base64"),
  ].join("$");
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const [scheme, cost, blockSize, parallelism, salt, key] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !key) return false;

  const expected = Buffer.from(key, "base64");
  const actual = await derive(
    password,
    Buffer.from(salt, "base64"),
    expected.length,
    Number(cost),
    Number(blockSize),
    Number(parallelism),
  );

  return timingSafeEqual(expected, actual);
}
