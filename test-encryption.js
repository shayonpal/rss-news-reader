const crypto = require("crypto");

const ENCRYPTION_KEY =
  "367649d22465a95203ddcffee4882e37718bef016c98f18227efe011035e3498";
const ENCRYPTION_ALGORITHM = "aes-256-gcm";

function encrypt(text) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(
    ENCRYPTION_ALGORITHM,
    Buffer.from(ENCRYPTION_KEY, "hex"),
    iv
  );

  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag();

  return {
    encrypted,
    iv: iv.toString("hex"),
    authTag: authTag.toString("hex"),
  };
}

try {
  const result = encrypt("sk-ant-api03-test-key");
  console.log("Encryption successful:", result);
} catch (error) {
  console.error("Encryption failed:", error.message);
}
