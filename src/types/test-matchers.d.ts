// Custom Vitest matcher type definitions
import "vitest";

declare module "vitest" {
  interface Assertion<T = any> {
    /**
     * Custom matcher to check if a value is one of several possible values
     * @example expect(statusCode).toBeOneOf([200, 201, 202])
     */
    toBeOneOf(expected: any[]): T;
  }

  interface AsymmetricMatchersContaining {
    /**
     * Custom matcher to check if a value is one of several possible values
     * @example expect(statusCode).toBeOneOf([200, 201, 202])
     */
    toBeOneOf(expected: any[]): any;
  }
}

// Additional test utilities type extensions
declare global {
  namespace Vi {
    interface JestAssertion<T = any> {
      /**
       * Custom matcher for Jest compatibility
       */
      toBeOneOf(expected: any[]): T;
    }
  }
}
