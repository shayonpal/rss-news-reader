import { test, expect } from "@playwright/test";

test.describe("AI Settings Complete User Journey", () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication
    await page.route("**/api/auth/session", async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          user: {
            id: "test-user-id",
            email: "test@example.com",
            name: "Test User",
          },
        },
      });
    });

    // Mock user preferences endpoint
    await page.route("**/api/users/*/preferences", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          json: {
            ai: {
              provider: "anthropic",
              model: null,
              hasApiKey: false,
              summaryLengthMin: 3,
              summaryLengthMax: 7,
              summaryStyle: "objective",
              contentFocus: "key-points",
            },
            theme: "system",
            notifications: true,
          },
        });
      }
    });

    // Navigate to settings page
    await page.goto("/reader/settings");
    await page.waitForLoadState("networkidle");
  });

  test("should complete full AI configuration flow", async ({ page }) => {
    // Step 1: Verify page loaded with AI settings section
    await expect(page.locator('h2:has-text("AI Summarization")')).toBeVisible();

    // Step 2: Mock models endpoint
    await page.route("**/api/ai/models", async (route) => {
      await route.fulfill({
        status: 200,
        headers: {
          ETag: '"models-v1"',
          "Cache-Control": "public, max-age=300",
        },
        json: {
          models: [
            {
              id: "claude-3-opus-20240229",
              name: "Claude 3 Opus",
              provider: "anthropic",
              description: "Most capable model for complex tasks",
            },
            {
              id: "claude-3-sonnet-20240229",
              name: "Claude 3 Sonnet",
              provider: "anthropic",
              description: "Balanced performance and cost",
            },
            {
              id: "claude-3-haiku-20240307",
              name: "Claude 3 Haiku",
              provider: "anthropic",
              description: "Fast and efficient",
            },
          ],
        },
      });
    });

    // Step 3: Check model dropdown is populated
    const modelDropdown = page.locator('select[name="ai.model"]');
    await expect(modelDropdown).toBeVisible();

    // Wait for models to load
    await page.waitForResponse("**/api/ai/models");

    // Verify dropdown has options
    const options = await modelDropdown.locator("option").count();
    expect(options).toBeGreaterThan(1);

    // Step 4: Select a model
    await modelDropdown.selectOption("claude-3-opus-20240229");
    await expect(modelDropdown).toHaveValue("claude-3-opus-20240229");

    // Step 5: Enter API key
    const apiKeyInput = page.locator('input[name="ai.apiKey"]');
    await expect(apiKeyInput).toBeVisible();
    await apiKeyInput.fill("sk-ant-test-key-123456789");

    // Step 6: Mock validation endpoint
    let validationCalled = false;
    await page.route("**/api/ai/validate-key", async (route) => {
      validationCalled = true;
      const request = route.request();
      const body = request.postDataJSON();

      // Verify request structure
      expect(body).toHaveProperty("provider", "anthropic");
      expect(body).toHaveProperty("apiKey");

      await route.fulfill({
        status: 200,
        json: { valid: true },
      });
    });

    // Step 7: Click Test Connection button
    const testButton = page.locator('button:has-text("Test Connection")');
    await expect(testButton).toBeVisible();
    await testButton.click();

    // Wait for validation
    await page.waitForTimeout(600); // Account for 500ms debounce
    expect(validationCalled).toBe(true);

    // Step 8: Verify validation feedback
    await expect(
      page.locator("text=API key validated successfully")
    ).toBeVisible();

    // Step 9: Configure summary settings
    // Summary length dual slider
    const minSlider = page.locator('input[name="ai.summaryLengthMin"]');
    const maxSlider = page.locator('input[name="ai.summaryLengthMax"]');

    await minSlider.fill("2");
    await maxSlider.fill("8");

    // Summary style radio buttons
    const analyticalRadio = page.locator('input[value="analytical"]');
    await analyticalRadio.check();
    await expect(analyticalRadio).toBeChecked();

    // Content focus dropdown
    const focusDropdown = page.locator('select[name="ai.contentFocus"]');
    await focusDropdown.selectOption("main-arguments");

    // Step 10: Mock save endpoint
    let saveCalled = false;
    await page.route("**/api/users/*/preferences", async (route) => {
      if (route.request().method() === "PUT") {
        saveCalled = true;
        const body = route.request().postDataJSON();

        // Verify save payload structure
        expect(body).toHaveProperty("ai");
        expect(body.ai).toHaveProperty("provider", "anthropic");
        expect(body.ai).toHaveProperty("model", "claude-3-opus-20240229");
        expect(body.ai).toHaveProperty("summaryLengthMin", 2);
        expect(body.ai).toHaveProperty("summaryLengthMax", 8);
        expect(body.ai).toHaveProperty("summaryStyle", "analytical");
        expect(body.ai).toHaveProperty("contentFocus", "main-arguments");

        expect(body).toHaveProperty("apiKeyAction");
        expect(body.apiKeyAction).toHaveProperty("provider", "anthropic");
        expect(body.apiKeyAction).toHaveProperty("action", "update");
        expect(body.apiKeyAction).toHaveProperty("apiKey");

        await route.fulfill({
          status: 200,
          json: {
            ai: {
              ...body.ai,
              hasApiKey: true,
            },
          },
        });
      }
    });

    // Step 11: Save preferences
    const saveButton = page.locator('button:has-text("Save Changes")');
    await expect(saveButton).toBeVisible();
    await saveButton.click();

    // Verify save was called
    await page.waitForResponse("**/api/users/*/preferences");
    expect(saveCalled).toBe(true);

    // Step 12: Verify success feedback
    await expect(
      page.locator("text=Settings saved successfully")
    ).toBeVisible();
  });

  test("should handle validation errors gracefully", async ({ page }) => {
    // Mock invalid API key validation
    await page.route("**/api/ai/validate-key", async (route) => {
      await route.fulfill({
        status: 200,
        json: { valid: false },
      });
    });

    // Enter API key
    const apiKeyInput = page.locator('input[name="ai.apiKey"]');
    await apiKeyInput.fill("invalid-key");

    // Test connection
    const testButton = page.locator('button:has-text("Test Connection")');
    await testButton.click();

    // Wait for validation
    await page.waitForTimeout(600);

    // Verify error feedback
    await expect(page.locator("text=Invalid API key")).toBeVisible();

    // Verify save button is disabled
    const saveButton = page.locator('button:has-text("Save Changes")');
    await expect(saveButton).toBeDisabled();
  });

  test("should handle network timeout on validation", async ({ page }) => {
    // Mock timeout response
    await page.route("**/api/ai/validate-key", async (route) => {
      // Delay for 3.5 seconds to trigger timeout
      await new Promise((resolve) => setTimeout(resolve, 3500));
      await route.fulfill({
        status: 408,
        json: {
          error: "Validation timeout",
          valid: false,
        },
      });
    });

    // Enter API key
    const apiKeyInput = page.locator('input[name="ai.apiKey"]');
    await apiKeyInput.fill("sk-ant-test-key-123");

    // Test connection
    const testButton = page.locator('button:has-text("Test Connection")');
    await testButton.click();

    // Show loading state
    await expect(page.locator("text=Validating...")).toBeVisible();

    // Wait for timeout
    await page.waitForTimeout(3600);

    // Verify timeout error
    await expect(page.locator("text=Validation timeout")).toBeVisible();
  });

  test("should maintain state after page refresh", async ({ page }) => {
    // Configure initial state
    await page.route("**/api/users/*/preferences", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          json: {
            ai: {
              provider: "anthropic",
              model: "claude-3-opus-20240229",
              hasApiKey: true,
              summaryLengthMin: 4,
              summaryLengthMax: 6,
              summaryStyle: "retrospective",
              contentFocus: "comprehensive",
            },
          },
        });
      }
    });

    // Refresh page
    await page.reload();
    await page.waitForLoadState("networkidle");

    // Verify state is restored
    const modelDropdown = page.locator('select[name="ai.model"]');
    await expect(modelDropdown).toHaveValue("claude-3-opus-20240229");

    const minSlider = page.locator('input[name="ai.summaryLengthMin"]');
    await expect(minSlider).toHaveValue("4");

    const maxSlider = page.locator('input[name="ai.summaryLengthMax"]');
    await expect(maxSlider).toHaveValue("6");

    const retrospectiveRadio = page.locator('input[value="retrospective"]');
    await expect(retrospectiveRadio).toBeChecked();

    const focusDropdown = page.locator('select[name="ai.contentFocus"]');
    await expect(focusDropdown).toHaveValue("comprehensive");

    // Verify API key indicator
    await expect(page.locator("text=API key configured")).toBeVisible();
  });

  test("should handle clear API key action", async ({ page }) => {
    // Start with configured API key
    await page.route("**/api/users/*/preferences", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          json: {
            ai: {
              provider: "anthropic",
              model: "claude-3-opus-20240229",
              hasApiKey: true,
            },
          },
        });
      } else if (route.request().method() === "PUT") {
        const body = route.request().postDataJSON();

        // Verify clear action
        expect(body.apiKeyAction).toHaveProperty("action", "clear");

        await route.fulfill({
          status: 200,
          json: {
            ai: {
              ...body.ai,
              hasApiKey: false,
            },
          },
        });
      }
    });

    await page.reload();
    await page.waitForLoadState("networkidle");

    // Click clear API key button
    const clearButton = page.locator('button:has-text("Clear API Key")');
    await expect(clearButton).toBeVisible();
    await clearButton.click();

    // Confirm in dialog
    await page.locator('button:has-text("Confirm")').click();

    // Save changes
    const saveButton = page.locator('button:has-text("Save Changes")');
    await saveButton.click();

    // Verify success
    await expect(page.locator("text=API key cleared")).toBeVisible();
  });

  test("should enforce input validation rules", async ({ page }) => {
    // Test summary length clamping
    const minSlider = page.locator('input[name="ai.summaryLengthMin"]');
    const maxSlider = page.locator('input[name="ai.summaryLengthMax"]');

    // Try to set invalid values
    await minSlider.fill("-5");
    await maxSlider.fill("15");

    // Trigger validation
    await page.locator('button:has-text("Save Changes")').click();

    // Wait for save
    await page.waitForResponse("**/api/users/*/preferences");

    // Values should be clamped
    await expect(minSlider).toHaveValue("1"); // Clamped to minimum
    await expect(maxSlider).toHaveValue("10"); // Clamped to maximum
  });

  test("should show loading states during async operations", async ({
    page,
  }) => {
    // Slow down API responses
    await page.route("**/api/ai/models", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await route.fulfill({
        status: 200,
        json: { models: [] },
      });
    });

    await page.reload();

    // Verify loading state for models
    await expect(page.locator("text=Loading models...")).toBeVisible();

    await page.waitForResponse("**/api/ai/models");

    // Loading state should disappear
    await expect(page.locator("text=Loading models...")).not.toBeVisible();
  });
});
