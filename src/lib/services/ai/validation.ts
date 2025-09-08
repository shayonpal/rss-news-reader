// Validation service for AI provider API keys

const VALIDATION_TIMEOUT = 3000;

async function validateAnthropicKey(apiKey: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), VALIDATION_TIMEOUT);

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-3-haiku-20240307",
        max_tokens: 1,
        messages: [{ role: "user", content: "Hi" }],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // 401 means invalid key, other errors might be rate limits or service issues
    // We consider the key valid if we get any response other than 401
    return response.status !== 401;
  } catch (error: unknown) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Validation timeout");
    }
    // Network errors or other issues - assume key might be valid
    return false;
  }
}

async function validateOpenAIKey(apiKey: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), VALIDATION_TIMEOUT);

    const response = await fetch("https://api.openai.com/v1/models", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    return response.status !== 401;
  } catch (error: unknown) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Validation timeout");
    }
    return false;
  }
}

export async function validateApiKey(
  provider: string,
  apiKey: string
): Promise<{ valid: boolean }> {
  switch (provider) {
    case "anthropic":
      const valid = await validateAnthropicKey(apiKey);
      return { valid };
    case "openai":
      const validOpenAI = await validateOpenAIKey(apiKey);
      return { valid: validOpenAI };
    default:
      return { valid: false };
  }
}
