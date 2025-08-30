import type {
  OpenAPIObject,
  PathItemObject,
  OperationObject,
  ParameterObject,
  RequestBodyObject,
  SchemaObject,
} from "openapi3-ts/oas31";

/**
 * Generates a unique ID for Insomnia resources
 */
export function generateInsomniaId(prefix: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 9);
  return `${prefix}_${timestamp}${random}`;
}

/**
 * Converts OpenAPI specification to Insomnia v4 export format
 * Memory-efficient implementation using streaming-friendly structure
 */
export function convertOpenAPIToInsomnia(
  spec: OpenAPIObject,
  baseUrl: string
): any {
  // Validate input
  if (!spec || !spec.info) {
    throw new Error("Invalid OpenAPI specification: missing info object");
  }

  if (!baseUrl || typeof baseUrl !== "string") {
    throw new Error("Invalid base URL provided");
  }

  const workspaceId = generateInsomniaId("wrk");
  const environmentId = generateInsomniaId("env");
  const baseEnvironmentId = generateInsomniaId("env");

  // Build resources array
  const resources: any[] = [];

  // Add workspace
  resources.push({
    _id: workspaceId,
    _type: "workspace",
    name: spec.info.title || "RSS Reader API",
    description: spec.info.description || "",
    scope: "collection",
  });

  // Add base environment
  resources.push({
    _id: baseEnvironmentId,
    _type: "environment",
    parentId: workspaceId,
    name: "Base Environment",
    data: {},
    dataPropertyOrder: {},
    color: null,
    metaSortKey: 1,
  });

  // Add main environment with base_url variable
  resources.push({
    _id: environmentId,
    _type: "environment",
    parentId: baseEnvironmentId,
    name: "RSS Reader Environment",
    data: {
      base_url: baseUrl,
      api_key: "{{ _.api_key }}",
      auth_token: "{{ _.auth_token }}",
    },
    dataPropertyOrder: {
      "&": ["base_url", "api_key", "auth_token"],
    },
    color: "#7d69cb",
    metaSortKey: 2,
  });

  // Track folders by tag
  const foldersByTag = new Map<string, string>();
  let folderSortKey = 1000;
  let requestSortKey = 2000;

  // Process paths and create requests
  if (spec.paths) {
    for (const [path, pathItem] of Object.entries(spec.paths)) {
      if (!pathItem || typeof pathItem !== "object") continue;

      const pathItemObj = pathItem as PathItemObject;

      // Process each HTTP method
      for (const method of [
        "get",
        "post",
        "put",
        "delete",
        "patch",
        "head",
        "options",
      ] as const) {
        const operation = pathItemObj[method] as OperationObject | undefined;
        if (!operation) continue;

        // Get or create folder for tags
        const tag = operation.tags?.[0] || "General";
        let folderId = foldersByTag.get(tag);

        if (!folderId) {
          folderId = generateInsomniaId("fld");
          foldersByTag.set(tag, folderId);

          resources.push({
            _id: folderId,
            _type: "request_group",
            parentId: workspaceId,
            name: tag,
            description: "",
            environment: {},
            environmentPropertyOrder: null,
            metaSortKey: folderSortKey++,
          });
        }

        // Create request
        const requestId = generateInsomniaId("req");
        const request: any = {
          _id: requestId,
          _type: "request",
          parentId: folderId,
          name: operation.summary || `${method.toUpperCase()} ${path}`,
          description: operation.description || "",
          method: method.toUpperCase(),
          url: `{{ _.base_url }}${path.replace(/{([^}]+)}/g, "{{ _.$1 }}")}`,
          body: {},
          parameters: [],
          headers: [],
          authentication: {},
          metaSortKey: requestSortKey++,
          settingStoreCookies: true,
          settingSendCookies: true,
          settingDisableRenderRequestBody: false,
          settingEncodeUrl: true,
          settingRebuildPath: true,
          settingFollowRedirects: "global",
        };

        // Add parameters
        if (operation.parameters) {
          for (const param of operation.parameters) {
            const paramObj = param as ParameterObject;

            if (paramObj.in === "query") {
              request.parameters.push({
                name: paramObj.name,
                value: `{{ _.${paramObj.name} }}`,
                disabled: !paramObj.required,
                description: paramObj.description || "",
              });
            } else if (paramObj.in === "header") {
              request.headers.push({
                name: paramObj.name,
                value: `{{ _.${paramObj.name} }}`,
                disabled: !paramObj.required,
                description: paramObj.description || "",
              });
            } else if (paramObj.in === "path") {
              // Path parameters are handled in the URL template
              // Add to environment for reference
              if (!resources[2].data[paramObj.name]) {
                resources[2].data[paramObj.name] = `{{ _.${paramObj.name} }}`;
              }
            }
          }
        }

        // Add request body if present
        if (operation.requestBody) {
          const requestBody = operation.requestBody as RequestBodyObject;
          const content = requestBody.content;

          if (content?.["application/json"]) {
            request.body = {
              mimeType: "application/json",
              text: JSON.stringify(
                generateExampleFromSchema(
                  content["application/json"].schema as SchemaObject
                ),
                null,
                2
              ),
            };

            request.headers.push({
              name: "Content-Type",
              value: "application/json",
            });
          } else if (content?.["application/x-www-form-urlencoded"]) {
            request.body = {
              mimeType: "application/x-www-form-urlencoded",
              params: [],
            };
          } else if (content?.["multipart/form-data"]) {
            request.body = {
              mimeType: "multipart/form-data",
              params: [],
            };
          }
        }

        // Add authentication if needed
        if (spec.components?.securitySchemes) {
          const firstScheme = Object.values(
            spec.components.securitySchemes
          )[0] as any;

          if (
            firstScheme?.type === "http" &&
            firstScheme?.scheme === "bearer"
          ) {
            request.authentication = {
              type: "bearer",
              token: "{{ _.auth_token }}",
            };
          } else if (firstScheme?.type === "apiKey") {
            if (firstScheme.in === "header") {
              request.headers.push({
                name: firstScheme.name,
                value: "{{ _.api_key }}",
              });
            } else if (firstScheme.in === "query") {
              request.parameters.push({
                name: firstScheme.name,
                value: "{{ _.api_key }}",
              });
            }
          }
        }

        resources.push(request);
      }
    }
  }

  // Return Insomnia export format
  return {
    _type: "export",
    __export_format: 4,
    __export_date: new Date().toISOString(),
    __export_source: "rss-reader-openapi-converter",
    resources,
  };
}

/**
 * Generates example data from OpenAPI schema
 */
function generateExampleFromSchema(schema: SchemaObject | undefined): any {
  if (!schema) return {};

  // Check for circular references
  const visited = new Set<SchemaObject>();

  function generate(s: SchemaObject): any {
    if (visited.has(s)) return null;
    visited.add(s);

    // Handle examples
    if ("example" in s) return s.example;
    if ("examples" in s && Array.isArray(s.examples) && s.examples.length > 0) {
      return s.examples[0];
    }

    // Handle different types
    if (s.type === "object") {
      const obj: any = {};
      if (s.properties) {
        for (const [key, prop] of Object.entries(s.properties)) {
          obj[key] = generate(prop as SchemaObject);
        }
      }
      return obj;
    }

    if (s.type === "array") {
      if (s.items) {
        return [generate(s.items as SchemaObject)];
      }
      return [];
    }

    if (s.type === "string") {
      if (s.enum && s.enum.length > 0) return s.enum[0];
      if (s.format === "date-time") return new Date().toISOString();
      if (s.format === "date") return new Date().toISOString().split("T")[0];
      if (s.format === "email") return "user@example.com";
      if (s.format === "uri") return "https://example.com";
      if (s.format === "uuid") return "123e4567-e89b-12d3-a456-426614174000";
      return "string";
    }

    if (s.type === "number" || s.type === "integer") {
      if (s.minimum !== undefined) return s.minimum;
      if (s.maximum !== undefined) return s.maximum;
      return s.type === "integer" ? 1 : 1.0;
    }

    if (s.type === "boolean") return true;

    if (s.type === "null") return null;

    // Handle anyOf, oneOf, allOf
    if (s.anyOf && s.anyOf.length > 0) {
      return generate(s.anyOf[0] as SchemaObject);
    }
    if (s.oneOf && s.oneOf.length > 0) {
      return generate(s.oneOf[0] as SchemaObject);
    }
    if (s.allOf && s.allOf.length > 0) {
      // Merge all schemas
      const merged: any = {};
      for (const subSchema of s.allOf) {
        const generated = generate(subSchema as SchemaObject);
        if (typeof generated === "object" && generated !== null) {
          Object.assign(merged, generated);
        }
      }
      return merged;
    }

    return null;
  }

  return generate(schema);
}
