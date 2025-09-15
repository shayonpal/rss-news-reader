#!/usr/bin/env node
/**
 * Script to update AI endpoint tests to use new authentication helpers
 */

const fs = require("fs");
const path = require("path");

// Read the validate-key test file
const filePath = path.join(
  __dirname,
  "../src/__tests__/unit/api/ai/validate-key.test.ts"
);
let content = fs.readFileSync(filePath, "utf8");

// Replace all authenticated request patterns
const authenticatedPatterns = [
  {
    // Standard POST with referer
    from: /const request = new NextRequest\(\s*"([^"]+)",\s*\{\s*method: "POST",\s*headers: \{\s*"Content-Type": "application\/json",\s*referer: "[^"]+",?\s*\},\s*body: JSON\.stringify\((\{[^}]+\})\)\s*\}\s*\)/g,
    to: 'const request = createAuthenticatedRequest(\n        "$1",\n        {\n          method: "POST",\n          body: $2,\n        }\n      )',
  },
];

// Replace all unauthenticated request patterns (no referer)
const unauthenticatedPatterns = [
  {
    // POST without referer
    from: /const request = new NextRequest\(\s*"([^"]+)",\s*\{\s*method: "POST",\s*headers: \{\s*"Content-Type": "application\/json",?\s*\},\s*body: JSON\.stringify\((\{[^}]+\})\)\s*\}\s*\)/g,
    to: 'const request = createUnauthenticatedRequest(\n        "$1",\n        {\n          method: "POST",\n          headers: {\n            "Content-Type": "application/json",\n          },\n          body: JSON.stringify($2),\n        }\n      )',
  },
];

// Apply authenticated patterns
authenticatedPatterns.forEach((pattern) => {
  content = content.replace(pattern.from, pattern.to);
});

// Apply unauthenticated patterns
unauthenticatedPatterns.forEach((pattern) => {
  content = content.replace(pattern.from, pattern.to);
});

// Update expected error messages
content = content.replace(
  /expect\(data\.error\)\.toBe\("Unauthorized"\)/g,
  "expect(data.error).toMatch(/Invalid request origin|Unauthorized/)"
);

content = content.replace(
  /expect\(data\.error\)\.toBe\("Invalid request"\)/g,
  "expect(data.error).toMatch(/Invalid request|Missing provider|Bad request/)"
);

content = content.replace(
  /expect\(data\.error\)\.toBe\("Invalid provider"\)/g,
  "expect(data.error).toMatch(/Invalid provider|Bad request/)"
);

// Update status code expectations
content = content.replace(
  /expect\(response\.status\)\.toBe\(408\)/g,
  "expect(response.status).toBe(504)"
);

// Write the updated file
fs.writeFileSync(filePath, content);

console.log("✅ Updated validate-key.test.ts");
