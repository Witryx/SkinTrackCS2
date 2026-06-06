import crypto from "crypto";

const VERSION = "v1";
const IV_BYTES = 12;
const TAG_BYTES = 16;

const getSecret = () => process.env.APP_ENCRYPTION_KEY?.trim() ?? "";

const deriveKey = () => {
  const secret = getSecret();
  if (!secret) {
    throw new Error("APP_ENCRYPTION_KEY is required for encrypted data.");
  }

  const base64 = Buffer.from(secret, "base64");
  if (base64.length === 32) return base64;

  const hex = Buffer.from(secret, "hex");
  if (hex.length === 32) return hex;

  return crypto.createHash("sha256").update(secret).digest();
};

export const normalizeSensitiveEmail = (value: string) =>
  value.trim().toLowerCase();

export function encryptSensitiveValue(value: string) {
  const key = deriveKey();
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [
    VERSION,
    iv.toString("base64"),
    tag.toString("base64"),
    ciphertext.toString("base64"),
  ].join(":");
}

export function decryptSensitiveValue(payload?: string | null) {
  if (!payload) return null;

  const [version, ivBase64, tagBase64, ciphertextBase64] = payload.split(":");
  if (version !== VERSION || !ivBase64 || !tagBase64 || !ciphertextBase64) {
    return null;
  }

  const iv = Buffer.from(ivBase64, "base64");
  const tag = Buffer.from(tagBase64, "base64");
  const ciphertext = Buffer.from(ciphertextBase64, "base64");
  if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) {
    return null;
  }

  const decipher = crypto.createDecipheriv("aes-256-gcm", deriveKey(), iv);
  decipher.setAuthTag(tag);

  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
}

export function hashSensitiveLookup(value: string) {
  return crypto
    .createHmac("sha256", deriveKey())
    .update(value)
    .digest("hex");
}

export function getUserContactEmail(user: {
  email?: string | null;
  emailEncrypted?: string | null;
}) {
  if (user.emailEncrypted) {
    try {
      return decryptSensitiveValue(user.emailEncrypted);
    } catch (error) {
      console.error("Encrypted e-mail could not be decrypted", error);
      return null;
    }
  }

  return user.email ?? null;
}
