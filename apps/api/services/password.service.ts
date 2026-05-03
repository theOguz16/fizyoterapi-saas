// Bu servis modulu backend tarafinda password.service ile ilgili tekrar kullanilan is kurallarini toplar.
// Controller'larin zayif kalmasi ve ayni mantigin farkli endpointlerde paylasilmasi icin ayrilmistir.
import bcrypt from "bcryptjs";

const DEFAULT_BCRYPT_ROUNDS = 12;
const MIN_BCRYPT_ROUNDS = 10;
const MAX_BCRYPT_ROUNDS = 14;

export function getBcryptRounds() {
  const raw = Number(process.env.BCRYPT_ROUNDS ?? DEFAULT_BCRYPT_ROUNDS);
  if (!Number.isFinite(raw)) return DEFAULT_BCRYPT_ROUNDS;
  return Math.max(MIN_BCRYPT_ROUNDS, Math.min(MAX_BCRYPT_ROUNDS, Math.floor(raw)));
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, getBcryptRounds());
}

export async function verifyPassword(password: string, passwordHash: string) {
  return bcrypt.compare(password, passwordHash);
}
