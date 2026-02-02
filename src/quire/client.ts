/**
 * Quire API Client
 *
 * A typed fetch wrapper for the Quire API with:
 * - Timeouts
 * - Retry/backoff on 429/503
 * - Consistent error mapping
 * - Runtime response validation with Zod schemas
 *
 * Rate Limits (Free plan):
 * - 25 requests per minute
 * - 120 requests per hour
 *
 * @see https://quire.io/dev/api/
 */

import type { ZodType } from "zod";
import type {
  QuireUser,
  QuireResult,
  QuireOrganization,
  QuireProject,
  QuireTask,
  QuireTag,
  QuireComment,
  QuireStatus,
  QuirePartner,
  QuireDocument,
  QuireSublist,
  QuireChat,
  QuireStorageEntry,
  QuireAttachment,
  CreateTaskParams,
  UpdateTaskParams,
  UpdateOrganizationParams,
  UpdateProjectParams,
  CreateTagParams,
  UpdateTagParams,
  CreateCommentParams,
  UpdateCommentParams,
  CreateStatusParams,
  UpdateStatusParams,
  CreateDocumentParams,
  UpdateDocumentParams,
  CreateSublistParams,
  UpdateSublistParams,
  CreateChatParams,
  UpdateChatParams,
  SendNotificationParams,
} from "./types.js";
import { QuireClientError } from "./types.js";
import {
  QuireUserSchema,
  QuireOrganizationSchema,
  QuireProjectSchema,
  QuireTaskSchema,
  QuireTagSchema,
  QuireCommentSchema,
  QuireStatusSchema,
  QuirePartnerSchema,
  QuireDocumentSchema,
  QuireSublistSchema,
  QuireChatSchema,
  QuireStorageEntrySchema,
  QuireAttachmentSchema,
  DeleteOidResponseSchema,
  DeleteValueResponseSchema,
  DeleteNameResponseSchema,
  SuccessResponseSchema,
} from "./schemas.js";

const QUIRE_API_BASE_URL = "https://quire.io/api";
const DEFAULT_TIMEOUT_MS = 30000;
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 1000;

/**
 * Detect if a value is a Quire OID vs a human-readable ID.
 *
 * OIDs are random alphanumeric strings, often with dots (e.g., "GZ5993VFJqJsPN.g9SpFhYrU")
 * or pure alphanumeric with mixed case (e.g., "9VFQ8YT7yQibEVfRrAy1lUS1").
 *
 * IDs are human-readable:
 * - Project/org IDs: lowercase slugs with hyphens (e.g., "my-project")
 * - User IDs: can have underscores and mixed case (e.g., "Jacob_Hartmann")
 */
function isOid(value: string): boolean {
  // Contains a dot → definitely OID (e.g., "GZ5993VFJqJsPN.g9SpFhYrU")
  if (value.includes(".")) return true;

  // Contains underscore → likely a user ID (e.g., "Jacob_Hartmann")
  if (value.includes("_")) return false;

  // All lowercase (may include hyphens) → ID/slug (e.g., "my-project")
  if (!/[A-Z]/.test(value)) return false;

  // Has uppercase and no underscores or dots → OID (e.g., "9VFQ8YT7yQibEVfRrAy1lUS1")
  return true;
}

interface ClientOptions {
  token: string;
  timeoutMs?: number;
  maxRetries?: number;
}

/**
 * Create an AbortSignal with timeout
 */
function createTimeoutSignal(timeoutMs: number): AbortSignal {
  return AbortSignal.timeout(timeoutMs);
}

/**
 * Sleep for a specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Parse error response from Quire API
 */
function parseErrorCode(
  status: number
): Pick<QuireClientError, "code" | "retryable"> {
  switch (status) {
    case 401:
      return { code: "UNAUTHORIZED", retryable: false };
    case 403:
      return { code: "FORBIDDEN", retryable: false };
    case 404:
      return { code: "NOT_FOUND", retryable: false };
    case 429:
      return { code: "RATE_LIMITED", retryable: true };
    case 503:
      return { code: "SERVER_ERROR", retryable: true };
    default:
      if (status >= 500) {
        return { code: "SERVER_ERROR", retryable: true };
      }
      return { code: "UNKNOWN", retryable: false };
  }
}

/**
 * Quire API Client class
 */
export class QuireClient {
  private readonly token: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;

  constructor(options: ClientOptions) {
    this.token = options.token;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.maxRetries = options.maxRetries ?? MAX_RETRIES;
  }

  /**
   * Make an authenticated request to the Quire API
   *
   * @param endpoint - API endpoint path
   * @param options - Request options (method, body, schema)
   * @param retryCount - Current retry count (internal use)
   */
  private async request<T>(
    endpoint: string,
    options?: {
      method?: "GET" | "POST" | "PUT" | "DELETE";
      body?: Record<string, unknown>;
      /** Zod schema for runtime response validation (uses ZodType<unknown> to avoid exactOptionalPropertyTypes conflicts) */
      schema?: ZodType<unknown>;
    },
    retryCount = 0
  ): Promise<QuireResult<T>> {
    const url = `${QUIRE_API_BASE_URL}${endpoint}`;
    const method = options?.method ?? "GET";

    try {
      const headers: Record<string, string> = {
        Authorization: `Bearer ${this.token}`,
        Accept: "application/json",
      };

      if (options?.body) {
        headers["Content-Type"] = "application/json";
      }

      const fetchOptions: RequestInit = {
        method,
        headers,
        signal: createTimeoutSignal(this.timeoutMs),
      };
      if (options?.body) {
        fetchOptions.body = JSON.stringify(options.body);
      }

      const response = await fetch(url, fetchOptions);

      if (response.ok) {
        const rawData: unknown = await response.json();

        // Validate response with Zod schema if provided
        if (options?.schema) {
          const parseResult = options.schema.safeParse(rawData);
          if (!parseResult.success) {
            console.error(
              "[quire-mcp] API response validation failed:",
              parseResult.error.message
            );
            return {
              success: false,
              error: new QuireClientError(
                `API response validation failed: ${parseResult.error.message}`,
                "UNKNOWN"
              ),
            };
          }
          // Cast to T after validation - schema ensures shape is correct
          return { success: true, data: parseResult.data as T };
        }

        // Fallback to type assertion if no schema (for backwards compatibility)
        return { success: true, data: rawData as T };
      }

      // Handle error responses
      const { code, retryable } = parseErrorCode(response.status);

      // Retry logic for retryable errors
      if (retryable && retryCount < this.maxRetries) {
        // Respect Retry-After header if present (for rate limiting)
        let delay = INITIAL_RETRY_DELAY_MS * Math.pow(2, retryCount);
        const retryAfter = response.headers.get("Retry-After");
        if (retryAfter) {
          const retryAfterSeconds = Number.parseInt(retryAfter, 10);
          if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
            delay = retryAfterSeconds * 1000;
          }
        }
        console.error(
          `[quire-mcp] Request failed with ${response.status}, retrying in ${delay}ms (attempt ${retryCount + 1}/${this.maxRetries})`
        );
        await sleep(delay);
        return await this.request<T>(endpoint, options, retryCount + 1);
      }

      // Parse error body if available
      let errorMessage = `HTTP ${response.status}`;
      try {
        const errorBody = (await response.json()) as { message?: string };
        if (errorBody.message) {
          errorMessage = errorBody.message;
        }
      } catch {
        // Ignore JSON parse errors for error body
      }

      return {
        success: false,
        error: new QuireClientError(
          errorMessage,
          code,
          response.status,
          retryable
        ),
      };
    } catch (error) {
      // Handle network/timeout errors
      if (error instanceof Error) {
        if (error.name === "TimeoutError" || error.name === "AbortError") {
          return {
            success: false,
            error: new QuireClientError(
              `Request timed out after ${this.timeoutMs}ms`,
              "TIMEOUT",
              undefined,
              true
            ),
          };
        }

        return {
          success: false,
          error: new QuireClientError(error.message, "NETWORK_ERROR"),
        };
      }

      return {
        success: false,
        error: new QuireClientError("Unknown error occurred", "UNKNOWN"),
      };
    }
  }

  /**
   * Get the current authenticated user's profile
   *
   * @see https://quire.io/dev/api/#userIdMe
   */
  async getMe(): Promise<QuireResult<QuireUser>> {
    return this.request<QuireUser>("/user/id/me", {
      schema: QuireUserSchema,
    });
  }

  // =====================
  // Organization Methods
  // =====================

  /**
   * List all organizations accessible to the current user
   *
   * @see https://quire.io/dev/api/#organization
   */
  async listOrganizations(): Promise<QuireResult<QuireOrganization[]>> {
    return this.request<QuireOrganization[]>("/organization/list", {
      schema: QuireOrganizationSchema.array(),
    });
  }

  /**
   * Get an organization by ID or OID
   *
   * @see https://quire.io/dev/api/#organizationIdOid
   */
  async getOrganization(
    idOrOid: string
  ): Promise<QuireResult<QuireOrganization>> {
    const endpoint = isOid(idOrOid)
      ? `/organization/${idOrOid}`
      : `/organization/id/${idOrOid}`;
    return this.request<QuireOrganization>(endpoint, {
      schema: QuireOrganizationSchema,
    });
  }

  /**
   * Update an organization's followers
   *
   * @see https://quire.io/dev/api/#organizationIdOid
   */
  async updateOrganization(
    idOrOid: string,
    params: UpdateOrganizationParams
  ): Promise<QuireResult<QuireOrganization>> {
    const endpoint = isOid(idOrOid)
      ? `/organization/${idOrOid}`
      : `/organization/id/${idOrOid}`;
    return this.request<QuireOrganization>(endpoint, {
      method: "PUT",
      body: params as Record<string, unknown>,
      schema: QuireOrganizationSchema,
    });
  }

  // =====================
  // Project Methods
  // =====================

  /**
   * List projects accessible to the current user
   * If organizationId is provided, only list projects in that organization
   *
   * @see https://quire.io/dev/api/#project
   */
  async listProjects(
    organizationId?: string
  ): Promise<QuireResult<QuireProject[]>> {
    if (organizationId) {
      const endpoint = isOid(organizationId)
        ? `/project/list/${organizationId}`
        : `/project/list/id/${organizationId}`;
      return this.request<QuireProject[]>(endpoint, {
        schema: QuireProjectSchema.array(),
      });
    }
    return this.request<QuireProject[]>("/project/list", {
      schema: QuireProjectSchema.array(),
    });
  }

  /**
   * Get a project by ID or OID
   *
   * @see https://quire.io/dev/api/#projectIdOid
   */
  async getProject(idOrOid: string): Promise<QuireResult<QuireProject>> {
    const endpoint = isOid(idOrOid)
      ? `/project/${idOrOid}`
      : `/project/id/${idOrOid}`;
    return this.request<QuireProject>(endpoint, {
      schema: QuireProjectSchema,
    });
  }

  /**
   * Update a project's settings
   *
   * @see https://quire.io/dev/api/#projectIdOid
   */
  async updateProject(
    idOrOid: string,
    params: UpdateProjectParams
  ): Promise<QuireResult<QuireProject>> {
    const endpoint = isOid(idOrOid)
      ? `/project/${idOrOid}`
      : `/project/id/${idOrOid}`;
    return this.request<QuireProject>(endpoint, {
      method: "PUT",
      body: params as Record<string, unknown>,
      schema: QuireProjectSchema,
    });
  }

  /**
   * Export a project's tasks to JSON or CSV format
   *
   * @see https://quire.io/dev/api/#projectIdOidExport
   */
  async exportProject(
    idOrOid: string,
    format: "json" | "csv" = "json"
  ): Promise<QuireResult<QuireTask[] | string>> {
    const exportType = format === "csv" ? "export-csv" : "export-json";
    const endpoint = isOid(idOrOid)
      ? `/project/${exportType}/${idOrOid}`
      : `/project/${exportType}/id/${idOrOid}`;

    if (format === "csv") {
      // For CSV, we need to handle the response as text
      const url = `${QUIRE_API_BASE_URL}${endpoint}`;
      try {
        const response = await fetch(url, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${this.token}`,
            Accept: "text/csv",
          },
          signal: createTimeoutSignal(this.timeoutMs),
        });
        if (response.ok) {
          const data = await response.text();
          return { success: true, data };
        }
        const { code, retryable } = parseErrorCode(response.status);
        return {
          success: false,
          error: new QuireClientError(
            `HTTP ${response.status}`,
            code,
            response.status,
            retryable
          ),
        };
      } catch (error) {
        if (error instanceof Error) {
          return {
            success: false,
            error: new QuireClientError(error.message, "NETWORK_ERROR"),
          };
        }
        return {
          success: false,
          error: new QuireClientError("Unknown error occurred", "UNKNOWN"),
        };
      }
    }
    return this.request<QuireTask[]>(endpoint, {
      schema: QuireTaskSchema.array(),
    });
  }

  // =====================
  // Task Methods
  // =====================

  /**
   * List root tasks in a project, or subtasks of a parent task
   *
   * @see https://quire.io/dev/api/#task
   */
  async listTasks(
    projectIdOrOid: string,
    parentTaskOid?: string
  ): Promise<QuireResult<QuireTask[]>> {
    if (parentTaskOid) {
      // Subtask listing endpoint uses task OID directly
      return this.request<QuireTask[]>(`/task/${parentTaskOid}/task/list`, {
        schema: QuireTaskSchema.array(),
      });
    }
    const endpoint = isOid(projectIdOrOid)
      ? `/task/list/${projectIdOrOid}`
      : `/task/list/id/${projectIdOrOid}`;
    return this.request<QuireTask[]>(endpoint, {
      schema: QuireTaskSchema.array(),
    });
  }

  /**
   * Get a task by project ID and task ID, or by OID
   *
   * @see https://quire.io/dev/api/#taskIdProjectIdId
   */
  async getTask(
    projectIdOrOid: string,
    taskId?: number
  ): Promise<QuireResult<QuireTask>> {
    if (taskId !== undefined) {
      // Using project ID + task number
      const endpoint = isOid(projectIdOrOid)
        ? `/task/${projectIdOrOid}/${taskId}`
        : `/task/id/${projectIdOrOid}/${taskId}`;
      return this.request<QuireTask>(endpoint, {
        schema: QuireTaskSchema,
      });
    }
    // If no taskId provided, assume projectIdOrOid is actually the task OID
    return this.request<QuireTask>(`/task/${projectIdOrOid}`, {
      schema: QuireTaskSchema,
    });
  }

  /**
   * Create a new task in a project
   *
   * @see https://quire.io/dev/api/#taskIdProjectId
   */
  async createTask(
    projectIdOrOid: string,
    params: CreateTaskParams
  ): Promise<QuireResult<QuireTask>> {
    // Filter out undefined values for exactOptionalPropertyTypes compatibility
    const body: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        body[key] = value;
      }
    }
    const endpoint = isOid(projectIdOrOid)
      ? `/task/${projectIdOrOid}`
      : `/task/id/${projectIdOrOid}`;
    return this.request<QuireTask>(endpoint, {
      method: "POST",
      body,
      schema: QuireTaskSchema,
    });
  }

  /**
   * Update a task
   *
   * @see https://quire.io/dev/api/#taskIdProjectIdId
   */
  async updateTask(
    projectIdOrOid: string,
    taskIdOrParams: number | UpdateTaskParams,
    params?: UpdateTaskParams
  ): Promise<QuireResult<QuireTask>> {
    if (typeof taskIdOrParams === "number") {
      // Called with projectId, taskId, params
      const endpoint = isOid(projectIdOrOid)
        ? `/task/${projectIdOrOid}/${taskIdOrParams}`
        : `/task/id/${projectIdOrOid}/${taskIdOrParams}`;
      return this.request<QuireTask>(endpoint, {
        method: "PUT",
        body: (params ?? {}) as Record<string, unknown>,
        schema: QuireTaskSchema,
      });
    }
    // Called with OID and params - OID is for the task itself
    return this.request<QuireTask>(`/task/${projectIdOrOid}`, {
      method: "PUT",
      body: taskIdOrParams as Record<string, unknown>,
      schema: QuireTaskSchema,
    });
  }

  /**
   * Delete a task and its subtasks
   *
   * @see https://quire.io/dev/api/#taskIdProjectIdId
   */
  async deleteTask(oid: string): Promise<QuireResult<{ oid: string }>> {
    return this.request<{ oid: string }>(`/task/${oid}`, {
      method: "DELETE",
      schema: DeleteOidResponseSchema,
    });
  }

  /**
   * Search for tasks in a project
   *
   * @see https://quire.io/dev/api/#taskSearch
   */
  async searchTasks(
    projectIdOrOid: string,
    keyword: string,
    options?: {
      status?: number;
      priority?: number;
      assigneeId?: string;
      tagId?: number;
    }
  ): Promise<QuireResult<QuireTask[]>> {
    const queryParams = new URLSearchParams({ keyword });
    if (options?.status !== undefined) {
      queryParams.set("status", options.status.toString());
    }
    if (options?.priority !== undefined) {
      queryParams.set("priority", options.priority.toString());
    }
    if (options?.assigneeId) {
      queryParams.set("assignee", options.assigneeId);
    }
    if (options?.tagId !== undefined) {
      queryParams.set("tag", options.tagId.toString());
    }
    const endpoint = isOid(projectIdOrOid)
      ? `/task/search/${projectIdOrOid}`
      : `/task/search/id/${projectIdOrOid}`;
    return this.request<QuireTask[]>(`${endpoint}?${queryParams.toString()}`, {
      schema: QuireTaskSchema.array(),
    });
  }

  /**
   * Create a task after a specified task
   *
   * @see https://quire.io/dev/api/#taskAfterOid
   */
  async createTaskAfter(
    taskOid: string,
    params: CreateTaskParams
  ): Promise<QuireResult<QuireTask>> {
    const body: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        body[key] = value;
      }
    }
    return this.request<QuireTask>(`/task/after/${taskOid}`, {
      method: "POST",
      body,
      schema: QuireTaskSchema,
    });
  }

  /**
   * Create a task before a specified task
   *
   * @see https://quire.io/dev/api/#taskBeforeOid
   */
  async createTaskBefore(
    taskOid: string,
    params: CreateTaskParams
  ): Promise<QuireResult<QuireTask>> {
    const body: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        body[key] = value;
      }
    }
    return this.request<QuireTask>(`/task/before/${taskOid}`, {
      method: "POST",
      body,
      schema: QuireTaskSchema,
    });
  }

  /**
   * Search for tasks in a folder
   *
   * @see https://quire.io/dev/api/#taskSearchFolderFolderOid
   */
  async searchFolderTasks(
    folderIdOrOid: string,
    keyword: string,
    options?: {
      status?: number;
      priority?: number;
      assigneeId?: string;
      tagId?: number;
    }
  ): Promise<QuireResult<QuireTask[]>> {
    const queryParams = new URLSearchParams({ keyword });
    if (options?.status !== undefined) {
      queryParams.set("status", options.status.toString());
    }
    if (options?.priority !== undefined) {
      queryParams.set("priority", options.priority.toString());
    }
    if (options?.assigneeId) {
      queryParams.set("assignee", options.assigneeId);
    }
    if (options?.tagId !== undefined) {
      queryParams.set("tag", options.tagId.toString());
    }
    const endpoint = isOid(folderIdOrOid)
      ? `/task/search/folder/${folderIdOrOid}`
      : `/task/search/folder/id/${folderIdOrOid}`;
    return this.request<QuireTask[]>(`${endpoint}?${queryParams.toString()}`, {
      schema: QuireTaskSchema.array(),
    });
  }

  /**
   * Search for tasks across an organization
   *
   * @see https://quire.io/dev/api/#taskSearchOrganizationOrgOid
   */
  async searchOrganizationTasks(
    orgIdOrOid: string,
    keyword: string,
    options?: {
      status?: number;
      priority?: number;
      assigneeId?: string;
      tagId?: number;
    }
  ): Promise<QuireResult<QuireTask[]>> {
    const queryParams = new URLSearchParams({ keyword });
    if (options?.status !== undefined) {
      queryParams.set("status", options.status.toString());
    }
    if (options?.priority !== undefined) {
      queryParams.set("priority", options.priority.toString());
    }
    if (options?.assigneeId) {
      queryParams.set("assignee", options.assigneeId);
    }
    if (options?.tagId !== undefined) {
      queryParams.set("tag", options.tagId.toString());
    }
    const endpoint = isOid(orgIdOrOid)
      ? `/task/search/organization/${orgIdOrOid}`
      : `/task/search/organization/id/${orgIdOrOid}`;
    return this.request<QuireTask[]>(`${endpoint}?${queryParams.toString()}`, {
      schema: QuireTaskSchema.array(),
    });
  }

  // =====================
  // Tag Methods
  // =====================

  /**
   * List all tags in a project
   *
   * @see https://quire.io/dev/api/#tag
   */
  async listTags(projectIdOrOid: string): Promise<QuireResult<QuireTag[]>> {
    const endpoint = isOid(projectIdOrOid)
      ? `/tag/list/${projectIdOrOid}`
      : `/tag/list/id/${projectIdOrOid}`;
    return this.request<QuireTag[]>(endpoint, {
      schema: QuireTagSchema.array(),
    });
  }

  /**
   * Get a tag by OID
   *
   * @see https://quire.io/dev/api/#tagOid
   */
  async getTag(oid: string): Promise<QuireResult<QuireTag>> {
    return this.request<QuireTag>(`/tag/${oid}`, {
      schema: QuireTagSchema,
    });
  }

  /**
   * Create a new tag in a project
   *
   * @see https://quire.io/dev/api/#tagIdProjectId
   */
  async createTag(
    projectIdOrOid: string,
    params: CreateTagParams
  ): Promise<QuireResult<QuireTag>> {
    const body: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        body[key] = value;
      }
    }
    const endpoint = isOid(projectIdOrOid)
      ? `/tag/${projectIdOrOid}`
      : `/tag/id/${projectIdOrOid}`;
    return this.request<QuireTag>(endpoint, {
      method: "POST",
      body,
      schema: QuireTagSchema,
    });
  }

  /**
   * Update a tag
   *
   * @see https://quire.io/dev/api/#tagOid
   */
  async updateTag(
    oid: string,
    params: UpdateTagParams
  ): Promise<QuireResult<QuireTag>> {
    return this.request<QuireTag>(`/tag/${oid}`, {
      method: "PUT",
      body: params as Record<string, unknown>,
      schema: QuireTagSchema,
    });
  }

  /**
   * Delete a tag
   *
   * @see https://quire.io/dev/api/#tagOid
   */
  async deleteTag(oid: string): Promise<QuireResult<{ oid: string }>> {
    return this.request<{ oid: string }>(`/tag/${oid}`, {
      method: "DELETE",
      schema: DeleteOidResponseSchema,
    });
  }

  // =====================
  // Comment Methods
  // =====================

  /**
   * List comments on a task
   *
   * @see https://quire.io/dev/api/#comment
   */
  async listTaskComments(
    taskOidOrProjectId: string,
    taskId?: number
  ): Promise<QuireResult<QuireComment[]>> {
    if (taskId !== undefined) {
      // Using project ID + task number
      const endpoint = isOid(taskOidOrProjectId)
        ? `/comment/list/${taskOidOrProjectId}/task/${taskId}`
        : `/comment/list/id/${taskOidOrProjectId}/task/${taskId}`;
      return this.request<QuireComment[]>(endpoint, {
        schema: QuireCommentSchema.array(),
      });
    }
    // Using task OID directly
    return this.request<QuireComment[]>(
      `/comment/list/task/${taskOidOrProjectId}`,
      { schema: QuireCommentSchema.array() }
    );
  }

  /**
   * Add a comment to a task
   *
   * @see https://quire.io/dev/api/#commentIdProjectIdTaskId
   */
  async addTaskComment(
    taskOidOrProjectId: string,
    paramsOrTaskId: CreateCommentParams | number,
    params?: CreateCommentParams
  ): Promise<QuireResult<QuireComment>> {
    if (typeof paramsOrTaskId === "number") {
      // Using project ID + task number
      const body: Record<string, unknown> = {};
      if (params) {
        for (const [key, value] of Object.entries(params)) {
          if (value !== undefined) {
            body[key] = value;
          }
        }
      }
      const endpoint = isOid(taskOidOrProjectId)
        ? `/comment/${taskOidOrProjectId}/task/${paramsOrTaskId}`
        : `/comment/id/${taskOidOrProjectId}/task/${paramsOrTaskId}`;
      return this.request<QuireComment>(endpoint, {
        method: "POST",
        body,
        schema: QuireCommentSchema,
      });
    }
    // Using task OID directly
    const body: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(paramsOrTaskId)) {
      if (value !== undefined) {
        body[key] = value;
      }
    }
    return this.request<QuireComment>(`/comment/task/${taskOidOrProjectId}`, {
      method: "POST",
      body,
      schema: QuireCommentSchema,
    });
  }

  /**
   * Update a comment
   *
   * @see https://quire.io/dev/api/#commentOid
   */
  async updateComment(
    commentOid: string,
    params: UpdateCommentParams
  ): Promise<QuireResult<QuireComment>> {
    const body: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        body[key] = value;
      }
    }
    return this.request<QuireComment>(`/comment/${commentOid}`, {
      method: "PUT",
      body,
      schema: QuireCommentSchema,
    });
  }

  /**
   * Delete a comment
   *
   * @see https://quire.io/dev/api/#commentOid
   */
  async deleteComment(
    commentOid: string
  ): Promise<QuireResult<{ oid: string }>> {
    return this.request<{ oid: string }>(`/comment/${commentOid}`, {
      method: "DELETE",
      schema: DeleteOidResponseSchema,
    });
  }

  /**
   * List comments on a chat channel by OID or by project ID and chat ID
   *
   * @see https://quire.io/dev/api/#commentListChatChatOid
   * @see https://quire.io/dev/api/#commentListIdProjectIdChatChatId
   */
  async listChatComments(
    chatOidOrProjectId: string,
    chatId?: string
  ): Promise<QuireResult<QuireComment[]>> {
    if (chatId !== undefined) {
      // Using project ID + chat ID
      const endpoint = isOid(chatOidOrProjectId)
        ? `/comment/list/${chatOidOrProjectId}/chat/${chatId}`
        : `/comment/list/id/${chatOidOrProjectId}/chat/${chatId}`;
      return this.request<QuireComment[]>(endpoint, {
        schema: QuireCommentSchema.array(),
      });
    }
    // Using chat OID directly
    return this.request<QuireComment[]>(
      `/comment/list/chat/${chatOidOrProjectId}`,
      { schema: QuireCommentSchema.array() }
    );
  }

  /**
   * Add a comment to a chat channel by OID or by project ID and chat ID
   *
   * @see https://quire.io/dev/api/#commentChatChatOid
   * @see https://quire.io/dev/api/#commentIdProjectIdChatChatId
   */
  async addChatComment(
    chatOidOrProjectId: string,
    paramsOrChatId: CreateCommentParams | string,
    params?: CreateCommentParams
  ): Promise<QuireResult<QuireComment>> {
    let endpoint: string;
    let commentParams: CreateCommentParams;

    if (typeof paramsOrChatId === "string") {
      // Using project ID + chat ID
      const chatId = paramsOrChatId;
      commentParams = params ?? { description: "" };
      endpoint = isOid(chatOidOrProjectId)
        ? `/comment/${chatOidOrProjectId}/chat/${chatId}`
        : `/comment/id/${chatOidOrProjectId}/chat/${chatId}`;
    } else {
      // Using chat OID directly
      endpoint = `/comment/chat/${chatOidOrProjectId}`;
      commentParams = paramsOrChatId;
    }

    const body: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(commentParams)) {
      if (value !== undefined) {
        body[key] = value;
      }
    }
    return this.request<QuireComment>(endpoint, {
      method: "POST",
      body,
      schema: QuireCommentSchema,
    });
  }

  // =====================
  // User Methods
  // =====================

  /**
   * Get a user by ID, OID, or email
   *
   * @see https://quire.io/dev/api/#userIdOid
   */
  async getUser(idOrOid: string): Promise<QuireResult<QuireUser>> {
    const endpoint = isOid(idOrOid)
      ? `/user/${idOrOid}`
      : `/user/id/${idOrOid}`;
    return this.request<QuireUser>(endpoint, {
      schema: QuireUserSchema,
    });
  }

  /**
   * List all users accessible to the current user
   *
   * @see https://quire.io/dev/api/#user
   */
  async listUsers(): Promise<QuireResult<QuireUser[]>> {
    return this.request<QuireUser[]>("/user/list", {
      schema: QuireUserSchema.array(),
    });
  }

  /**
   * List members of a project
   *
   * @see https://quire.io/dev/api/#userListProject
   */
  async listProjectMembers(
    projectIdOrOid: string
  ): Promise<QuireResult<QuireUser[]>> {
    const endpoint = isOid(projectIdOrOid)
      ? `/user/list/project/${projectIdOrOid}`
      : `/user/list/project/id/${projectIdOrOid}`;
    return this.request<QuireUser[]>(endpoint, {
      schema: QuireUserSchema.array(),
    });
  }

  // =====================
  // Status Methods
  // =====================

  /**
   * List custom statuses in a project
   *
   * @see https://quire.io/dev/api/#status
   */
  async listStatuses(
    projectIdOrOid: string
  ): Promise<QuireResult<QuireStatus[]>> {
    const endpoint = isOid(projectIdOrOid)
      ? `/status/list/${projectIdOrOid}`
      : `/status/list/id/${projectIdOrOid}`;
    return this.request<QuireStatus[]>(endpoint, {
      schema: QuireStatusSchema.array(),
    });
  }

  /**
   * Get a status by project and value
   *
   * @see https://quire.io/dev/api/#statusIdProjectIdValue
   */
  async getStatus(
    projectIdOrOid: string,
    value: number
  ): Promise<QuireResult<QuireStatus>> {
    const endpoint = isOid(projectIdOrOid)
      ? `/status/${projectIdOrOid}/${value}`
      : `/status/id/${projectIdOrOid}/${value}`;
    return this.request<QuireStatus>(endpoint, {
      schema: QuireStatusSchema,
    });
  }

  /**
   * Create a custom status in a project
   *
   * @see https://quire.io/dev/api/#statusIdProjectId
   */
  async createStatus(
    projectIdOrOid: string,
    params: CreateStatusParams
  ): Promise<QuireResult<QuireStatus>> {
    const body: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        body[key] = value;
      }
    }
    const endpoint = isOid(projectIdOrOid)
      ? `/status/${projectIdOrOid}`
      : `/status/id/${projectIdOrOid}`;
    return this.request<QuireStatus>(endpoint, {
      method: "POST",
      body,
      schema: QuireStatusSchema,
    });
  }

  /**
   * Update a custom status
   *
   * @see https://quire.io/dev/api/#statusIdProjectIdValue
   */
  async updateStatus(
    projectIdOrOid: string,
    value: number,
    params: UpdateStatusParams
  ): Promise<QuireResult<QuireStatus>> {
    const endpoint = isOid(projectIdOrOid)
      ? `/status/${projectIdOrOid}/${value}`
      : `/status/id/${projectIdOrOid}/${value}`;
    return this.request<QuireStatus>(endpoint, {
      method: "PUT",
      body: params as Record<string, unknown>,
      schema: QuireStatusSchema,
    });
  }

  /**
   * Delete a custom status
   *
   * @see https://quire.io/dev/api/#statusIdProjectIdValue
   */
  async deleteStatus(
    projectIdOrOid: string,
    value: number
  ): Promise<QuireResult<{ value: number }>> {
    const endpoint = isOid(projectIdOrOid)
      ? `/status/${projectIdOrOid}/${value}`
      : `/status/id/${projectIdOrOid}/${value}`;
    return this.request<{ value: number }>(endpoint, {
      method: "DELETE",
      schema: DeleteValueResponseSchema,
    });
  }

  // =====================
  // Partner Methods
  // =====================

  /**
   * Get an external team (partner) by OID
   *
   * @see https://quire.io/dev/api/#partnerOid
   */
  async getPartner(oid: string): Promise<QuireResult<QuirePartner>> {
    return this.request<QuirePartner>(`/partner/${oid}`, {
      schema: QuirePartnerSchema,
    });
  }

  /**
   * List external teams (partners) in a project
   *
   * @see https://quire.io/dev/api/#partnerListProjectOid
   */
  async listPartners(
    projectIdOrOid: string
  ): Promise<QuireResult<QuirePartner[]>> {
    const endpoint = isOid(projectIdOrOid)
      ? `/partner/list/${projectIdOrOid}`
      : `/partner/list/id/${projectIdOrOid}`;
    return this.request<QuirePartner[]>(endpoint, {
      schema: QuirePartnerSchema.array(),
    });
  }

  // =====================
  // Document Methods
  // =====================

  /**
   * Create a document
   *
   * @see https://quire.io/dev/api/#docOwnerTypeOwnerOid
   */
  async createDocument(
    ownerType: "organization" | "project",
    ownerIdOrOid: string,
    params: CreateDocumentParams
  ): Promise<QuireResult<QuireDocument>> {
    const body: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        body[key] = value;
      }
    }
    const endpoint = isOid(ownerIdOrOid)
      ? `/doc/${ownerType}/${ownerIdOrOid}`
      : `/doc/${ownerType}/id/${ownerIdOrOid}`;
    return this.request<QuireDocument>(endpoint, {
      method: "POST",
      body,
      schema: QuireDocumentSchema,
    });
  }

  /**
   * Get a document by OID or by owner type/ID and document ID
   *
   * @see https://quire.io/dev/api/#docOid
   * @see https://quire.io/dev/api/#docIdOwnerTypeOwnerIdId
   */
  async getDocument(
    oidOrOwnerType: string,
    ownerId?: string,
    documentId?: string
  ): Promise<QuireResult<QuireDocument>> {
    if (ownerId !== undefined && documentId !== undefined) {
      // Using ownerType/ownerId/documentId
      const ownerType = oidOrOwnerType as "organization" | "project";
      const endpoint = isOid(ownerId)
        ? `/doc/${ownerType}/${ownerId}/${documentId}`
        : `/doc/id/${ownerType}/${ownerId}/${documentId}`;
      return this.request<QuireDocument>(endpoint, {
        schema: QuireDocumentSchema,
      });
    }
    // Using OID directly
    return this.request<QuireDocument>(`/doc/${oidOrOwnerType}`, {
      schema: QuireDocumentSchema,
    });
  }

  /**
   * List documents for an owner
   *
   * @see https://quire.io/dev/api/#docListOwnerTypeOwnerOid
   */
  async listDocuments(
    ownerType: "organization" | "project",
    ownerIdOrOid: string
  ): Promise<QuireResult<QuireDocument[]>> {
    const endpoint = isOid(ownerIdOrOid)
      ? `/doc/list/${ownerType}/${ownerIdOrOid}`
      : `/doc/list/${ownerType}/id/${ownerIdOrOid}`;
    return this.request<QuireDocument[]>(endpoint, {
      schema: QuireDocumentSchema.array(),
    });
  }

  /**
   * Update a document by OID or by owner type/ID and document ID
   *
   * @see https://quire.io/dev/api/#docOid
   * @see https://quire.io/dev/api/#docIdOwnerTypeOwnerIdId
   */
  async updateDocument(
    oidOrOwnerType: string,
    paramsOrOwnerId: UpdateDocumentParams | string,
    documentIdOrParams?: string | UpdateDocumentParams,
    params?: UpdateDocumentParams
  ): Promise<QuireResult<QuireDocument>> {
    let endpoint: string;
    let updateParams: UpdateDocumentParams;

    if (typeof paramsOrOwnerId === "string") {
      // Using ownerType/ownerId/documentId/params
      const ownerType = oidOrOwnerType as "organization" | "project";
      const ownerId = paramsOrOwnerId;
      const documentId = documentIdOrParams as string;
      updateParams = params ?? {};
      endpoint = isOid(ownerId)
        ? `/doc/${ownerType}/${ownerId}/${documentId}`
        : `/doc/id/${ownerType}/${ownerId}/${documentId}`;
    } else {
      // Using OID and params
      endpoint = `/doc/${oidOrOwnerType}`;
      updateParams = paramsOrOwnerId;
    }

    const body: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(updateParams)) {
      if (value !== undefined) {
        body[key] = value;
      }
    }
    return this.request<QuireDocument>(endpoint, {
      method: "PUT",
      body,
      schema: QuireDocumentSchema,
    });
  }

  /**
   * Delete a document by OID or by owner type/ID and document ID
   *
   * @see https://quire.io/dev/api/#docOid
   * @see https://quire.io/dev/api/#docIdOwnerTypeOwnerIdId
   */
  async deleteDocument(
    oidOrOwnerType: string,
    ownerId?: string,
    documentId?: string
  ): Promise<QuireResult<{ oid: string }>> {
    let endpoint: string;
    if (ownerId !== undefined && documentId !== undefined) {
      // Using ownerType/ownerId/documentId
      const ownerType = oidOrOwnerType as "organization" | "project";
      endpoint = isOid(ownerId)
        ? `/doc/${ownerType}/${ownerId}/${documentId}`
        : `/doc/id/${ownerType}/${ownerId}/${documentId}`;
    } else {
      // Using OID directly
      endpoint = `/doc/${oidOrOwnerType}`;
    }
    return this.request<{ oid: string }>(endpoint, {
      method: "DELETE",
      schema: DeleteOidResponseSchema,
    });
  }

  // =====================
  // Sublist Methods
  // =====================

  /**
   * Create a sublist
   *
   * @see https://quire.io/dev/api/#sublistOwnerTypeOwnerOid
   */
  async createSublist(
    ownerType: "organization" | "project",
    ownerIdOrOid: string,
    params: CreateSublistParams
  ): Promise<QuireResult<QuireSublist>> {
    const body: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        body[key] = value;
      }
    }
    const endpoint = isOid(ownerIdOrOid)
      ? `/sublist/${ownerType}/${ownerIdOrOid}`
      : `/sublist/${ownerType}/id/${ownerIdOrOid}`;
    return this.request<QuireSublist>(endpoint, {
      method: "POST",
      body,
      schema: QuireSublistSchema,
    });
  }

  /**
   * Get a sublist by OID or by owner type/ID and sublist ID
   *
   * @see https://quire.io/dev/api/#sublistOid
   * @see https://quire.io/dev/api/#sublistIdOwnerTypeOwnerIdId
   */
  async getSublist(
    oidOrOwnerType: string,
    ownerId?: string,
    sublistId?: string
  ): Promise<QuireResult<QuireSublist>> {
    if (ownerId !== undefined && sublistId !== undefined) {
      // Using ownerType/ownerId/sublistId
      const ownerType = oidOrOwnerType as "organization" | "project";
      const endpoint = isOid(ownerId)
        ? `/sublist/${ownerType}/${ownerId}/${sublistId}`
        : `/sublist/id/${ownerType}/${ownerId}/${sublistId}`;
      return this.request<QuireSublist>(endpoint, {
        schema: QuireSublistSchema,
      });
    }
    // Using OID directly
    return this.request<QuireSublist>(`/sublist/${oidOrOwnerType}`, {
      schema: QuireSublistSchema,
    });
  }

  /**
   * List sublists for an owner
   *
   * @see https://quire.io/dev/api/#sublistListOwnerTypeOwnerOid
   */
  async listSublists(
    ownerType: "organization" | "project",
    ownerIdOrOid: string
  ): Promise<QuireResult<QuireSublist[]>> {
    const endpoint = isOid(ownerIdOrOid)
      ? `/sublist/list/${ownerType}/${ownerIdOrOid}`
      : `/sublist/list/${ownerType}/id/${ownerIdOrOid}`;
    return this.request<QuireSublist[]>(endpoint, {
      schema: QuireSublistSchema.array(),
    });
  }

  /**
   * Update a sublist by OID or by owner type/ID and sublist ID
   *
   * @see https://quire.io/dev/api/#sublistOid
   * @see https://quire.io/dev/api/#sublistIdOwnerTypeOwnerIdId
   */
  async updateSublist(
    oidOrOwnerType: string,
    paramsOrOwnerId: UpdateSublistParams | string,
    sublistIdOrParams?: string | UpdateSublistParams,
    params?: UpdateSublistParams
  ): Promise<QuireResult<QuireSublist>> {
    let endpoint: string;
    let updateParams: UpdateSublistParams;

    if (typeof paramsOrOwnerId === "string") {
      // Using ownerType/ownerId/sublistId/params
      const ownerType = oidOrOwnerType as "organization" | "project";
      const ownerId = paramsOrOwnerId;
      const sublistId = sublistIdOrParams as string;
      updateParams = params ?? {};
      endpoint = isOid(ownerId)
        ? `/sublist/${ownerType}/${ownerId}/${sublistId}`
        : `/sublist/id/${ownerType}/${ownerId}/${sublistId}`;
    } else {
      // Using OID and params
      endpoint = `/sublist/${oidOrOwnerType}`;
      updateParams = paramsOrOwnerId;
    }

    const body: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(updateParams)) {
      if (value !== undefined) {
        body[key] = value;
      }
    }
    return this.request<QuireSublist>(endpoint, {
      method: "PUT",
      body,
      schema: QuireSublistSchema,
    });
  }

  /**
   * Delete a sublist by OID or by owner type/ID and sublist ID
   *
   * @see https://quire.io/dev/api/#sublistOid
   * @see https://quire.io/dev/api/#sublistIdOwnerTypeOwnerIdId
   */
  async deleteSublist(
    oidOrOwnerType: string,
    ownerId?: string,
    sublistId?: string
  ): Promise<QuireResult<{ oid: string }>> {
    let endpoint: string;
    if (ownerId !== undefined && sublistId !== undefined) {
      // Using ownerType/ownerId/sublistId
      const ownerType = oidOrOwnerType as "organization" | "project";
      endpoint = isOid(ownerId)
        ? `/sublist/${ownerType}/${ownerId}/${sublistId}`
        : `/sublist/id/${ownerType}/${ownerId}/${sublistId}`;
    } else {
      // Using OID directly
      endpoint = `/sublist/${oidOrOwnerType}`;
    }
    return this.request<{ oid: string }>(endpoint, {
      method: "DELETE",
      schema: DeleteOidResponseSchema,
    });
  }

  // =====================
  // Chat Methods
  // =====================

  /**
   * Create a chat channel
   *
   * @see https://quire.io/dev/api/#chatOwnerTypeOwnerOid
   */
  async createChat(
    ownerType: "organization" | "project",
    ownerIdOrOid: string,
    params: CreateChatParams
  ): Promise<QuireResult<QuireChat>> {
    const body: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        body[key] = value;
      }
    }
    const endpoint = isOid(ownerIdOrOid)
      ? `/chat/${ownerType}/${ownerIdOrOid}`
      : `/chat/${ownerType}/id/${ownerIdOrOid}`;
    return this.request<QuireChat>(endpoint, {
      method: "POST",
      body,
      schema: QuireChatSchema,
    });
  }

  /**
   * Get a chat channel by OID or by owner type/ID and chat ID
   *
   * @see https://quire.io/dev/api/#chatOid
   * @see https://quire.io/dev/api/#chatIdOwnerTypeOwnerIdId
   */
  async getChat(
    oidOrOwnerType: string,
    ownerId?: string,
    chatId?: string
  ): Promise<QuireResult<QuireChat>> {
    if (ownerId !== undefined && chatId !== undefined) {
      // Using ownerType/ownerId/chatId
      const ownerType = oidOrOwnerType as "organization" | "project";
      const endpoint = isOid(ownerId)
        ? `/chat/${ownerType}/${ownerId}/${chatId}`
        : `/chat/id/${ownerType}/${ownerId}/${chatId}`;
      return this.request<QuireChat>(endpoint, {
        schema: QuireChatSchema,
      });
    }
    // Using OID directly
    return this.request<QuireChat>(`/chat/${oidOrOwnerType}`, {
      schema: QuireChatSchema,
    });
  }

  /**
   * List chat channels for an owner
   *
   * @see https://quire.io/dev/api/#chatListOwnerTypeOwnerOid
   */
  async listChats(
    ownerType: "organization" | "project",
    ownerIdOrOid: string
  ): Promise<QuireResult<QuireChat[]>> {
    const endpoint = isOid(ownerIdOrOid)
      ? `/chat/list/${ownerType}/${ownerIdOrOid}`
      : `/chat/list/${ownerType}/id/${ownerIdOrOid}`;
    return this.request<QuireChat[]>(endpoint, {
      schema: QuireChatSchema.array(),
    });
  }

  /**
   * Update a chat channel by OID or by owner type/ID and chat ID
   *
   * @see https://quire.io/dev/api/#chatOid
   * @see https://quire.io/dev/api/#chatIdOwnerTypeOwnerIdId
   */
  async updateChat(
    oidOrOwnerType: string,
    paramsOrOwnerId: UpdateChatParams | string,
    chatIdOrParams?: string | UpdateChatParams,
    params?: UpdateChatParams
  ): Promise<QuireResult<QuireChat>> {
    let endpoint: string;
    let updateParams: UpdateChatParams;

    if (typeof paramsOrOwnerId === "string") {
      // Using ownerType/ownerId/chatId/params
      const ownerType = oidOrOwnerType as "organization" | "project";
      const ownerId = paramsOrOwnerId;
      const chatId = chatIdOrParams as string;
      updateParams = params ?? {};
      endpoint = isOid(ownerId)
        ? `/chat/${ownerType}/${ownerId}/${chatId}`
        : `/chat/id/${ownerType}/${ownerId}/${chatId}`;
    } else {
      // Using OID and params
      endpoint = `/chat/${oidOrOwnerType}`;
      updateParams = paramsOrOwnerId;
    }

    const body: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(updateParams)) {
      if (value !== undefined) {
        body[key] = value;
      }
    }
    return this.request<QuireChat>(endpoint, {
      method: "PUT",
      body,
      schema: QuireChatSchema,
    });
  }

  /**
   * Delete a chat channel by OID or by owner type/ID and chat ID
   *
   * @see https://quire.io/dev/api/#chatOid
   * @see https://quire.io/dev/api/#chatIdOwnerTypeOwnerIdId
   */
  async deleteChat(
    oidOrOwnerType: string,
    ownerId?: string,
    chatId?: string
  ): Promise<QuireResult<{ oid: string }>> {
    let endpoint: string;
    if (ownerId !== undefined && chatId !== undefined) {
      // Using ownerType/ownerId/chatId
      const ownerType = oidOrOwnerType as "organization" | "project";
      endpoint = isOid(ownerId)
        ? `/chat/${ownerType}/${ownerId}/${chatId}`
        : `/chat/id/${ownerType}/${ownerId}/${chatId}`;
    } else {
      // Using OID directly
      endpoint = `/chat/${oidOrOwnerType}`;
    }
    return this.request<{ oid: string }>(endpoint, {
      method: "DELETE",
      schema: DeleteOidResponseSchema,
    });
  }

  // =====================
  // Storage Methods
  // =====================

  /**
   * Get a stored value by name
   *
   * @see https://quire.io/dev/api/#storageName
   */
  async getStorageValue(name: string): Promise<QuireResult<QuireStorageEntry>> {
    return this.request<QuireStorageEntry>(
      `/storage/${encodeURIComponent(name)}`,
      { schema: QuireStorageEntrySchema }
    );
  }

  /**
   * List storage entries by prefix
   *
   * @see https://quire.io/dev/api/#storageListPrefix
   */
  async listStorageEntries(
    prefix: string
  ): Promise<QuireResult<QuireStorageEntry[]>> {
    return this.request<QuireStorageEntry[]>(
      `/storage/list/${encodeURIComponent(prefix)}`,
      { schema: QuireStorageEntrySchema.array() }
    );
  }

  /**
   * Store a value
   *
   * @see https://quire.io/dev/api/#storageName
   */
  async putStorageValue(
    name: string,
    value: unknown
  ): Promise<QuireResult<QuireStorageEntry>> {
    return this.request<QuireStorageEntry>(
      `/storage/${encodeURIComponent(name)}`,
      {
        method: "PUT",
        body: { value },
        schema: QuireStorageEntrySchema,
      }
    );
  }

  /**
   * Delete a stored value
   *
   * @see https://quire.io/dev/api/#storageName
   */
  async deleteStorageValue(
    name: string
  ): Promise<QuireResult<{ name: string }>> {
    return this.request<{ name: string }>(
      `/storage/${encodeURIComponent(name)}`,
      {
        method: "DELETE",
        schema: DeleteNameResponseSchema,
      }
    );
  }

  // =====================
  // Notification Methods
  // =====================

  /**
   * Send a notification to users
   *
   * @see https://quire.io/dev/api/#notification
   */
  async sendNotification(
    params: SendNotificationParams
  ): Promise<QuireResult<{ success: boolean }>> {
    const body: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        body[key] = value;
      }
    }
    return this.request<{ success: boolean }>("/notification", {
      method: "POST",
      body,
      schema: SuccessResponseSchema,
    });
  }

  // =====================
  // Attachment Methods
  // =====================

  /**
   * Upload a file attachment to a task
   *
   * @see https://quire.io/dev/api/#taskAttachTaskOidFilename
   */
  async uploadTaskAttachment(
    taskOid: string,
    filename: string,
    content: string,
    mimeType = "application/octet-stream"
  ): Promise<QuireResult<QuireAttachment>> {
    const url = `${QUIRE_API_BASE_URL}/task/attach/${taskOid}/${encodeURIComponent(filename)}`;

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Content-Type": mimeType,
        },
        body: content,
        signal: createTimeoutSignal(this.timeoutMs),
      });

      if (response.ok) {
        const rawData: unknown = await response.json();
        const parseResult = QuireAttachmentSchema.safeParse(rawData);
        if (!parseResult.success) {
          console.error(
            "[quire-mcp] Attachment response validation failed:",
            parseResult.error.message
          );
          return {
            success: false,
            error: new QuireClientError(
              `API response validation failed: ${parseResult.error.message}`,
              "UNKNOWN"
            ),
          };
        }
        // Cast to QuireAttachment after validation
        return { success: true, data: parseResult.data as QuireAttachment };
      }

      const { code, retryable } = parseErrorCode(response.status);
      let errorMessage = `HTTP ${response.status}`;
      try {
        const errorBody = (await response.json()) as { message?: string };
        if (errorBody.message) {
          errorMessage = errorBody.message;
        }
      } catch {
        // Ignore JSON parse errors
      }

      return {
        success: false,
        error: new QuireClientError(
          errorMessage,
          code,
          response.status,
          retryable
        ),
      };
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === "TimeoutError" || error.name === "AbortError") {
          return {
            success: false,
            error: new QuireClientError(
              `Request timed out after ${this.timeoutMs}ms`,
              "TIMEOUT",
              undefined,
              true
            ),
          };
        }
        return {
          success: false,
          error: new QuireClientError(error.message, "NETWORK_ERROR"),
        };
      }
      return {
        success: false,
        error: new QuireClientError("Unknown error occurred", "UNKNOWN"),
      };
    }
  }

  /**
   * Upload a file attachment to a comment
   *
   * @see https://quire.io/dev/api/#commentAttachCommentOidFilename
   */
  async uploadCommentAttachment(
    commentOid: string,
    filename: string,
    content: string,
    mimeType = "application/octet-stream"
  ): Promise<QuireResult<QuireAttachment>> {
    const url = `${QUIRE_API_BASE_URL}/comment/attach/${commentOid}/${encodeURIComponent(filename)}`;

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Content-Type": mimeType,
        },
        body: content,
        signal: createTimeoutSignal(this.timeoutMs),
      });

      if (response.ok) {
        const rawData: unknown = await response.json();
        const parseResult = QuireAttachmentSchema.safeParse(rawData);
        if (!parseResult.success) {
          console.error(
            "[quire-mcp] Attachment response validation failed:",
            parseResult.error.message
          );
          return {
            success: false,
            error: new QuireClientError(
              `API response validation failed: ${parseResult.error.message}`,
              "UNKNOWN"
            ),
          };
        }
        // Cast to QuireAttachment after validation
        return { success: true, data: parseResult.data as QuireAttachment };
      }

      const { code, retryable } = parseErrorCode(response.status);
      let errorMessage = `HTTP ${response.status}`;
      try {
        const errorBody = (await response.json()) as { message?: string };
        if (errorBody.message) {
          errorMessage = errorBody.message;
        }
      } catch {
        // Ignore JSON parse errors
      }

      return {
        success: false,
        error: new QuireClientError(
          errorMessage,
          code,
          response.status,
          retryable
        ),
      };
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === "TimeoutError" || error.name === "AbortError") {
          return {
            success: false,
            error: new QuireClientError(
              `Request timed out after ${this.timeoutMs}ms`,
              "TIMEOUT",
              undefined,
              true
            ),
          };
        }
        return {
          success: false,
          error: new QuireClientError(error.message, "NETWORK_ERROR"),
        };
      }
      return {
        success: false,
        error: new QuireClientError("Unknown error occurred", "UNKNOWN"),
      };
    }
  }
}

/**
 * Create a QuireClient from environment variables (synchronous).
 * Only checks QUIRE_ACCESS_TOKEN; does not support OAuth flow.
 * For OAuth support, use createClientFromAuth() instead.
 *
 * @throws {QuireClientError} if QUIRE_ACCESS_TOKEN is not set
 */
export function createClientFromEnv(): QuireResult<QuireClient> {
  const token = process.env["QUIRE_ACCESS_TOKEN"];

  if (!token) {
    return {
      success: false,
      error: new QuireClientError(
        "QUIRE_ACCESS_TOKEN environment variable is not set. " +
          "Please configure QUIRE_OAUTH_CLIENT_ID and QUIRE_OAUTH_CLIENT_SECRET " +
          "for OAuth authentication.",
        "MISSING_TOKEN"
      ),
    };
  }

  return {
    success: true,
    data: new QuireClient({ token }),
  };
}

/**
 * Create a QuireClient using the full authentication chain:
 *   1. QUIRE_ACCESS_TOKEN env var (if set)
 *   2. Cached token from disk
 *   3. Refresh using stored refresh_token
 *   4. Interactive OAuth login
 *
 * This is async because it may need to perform OAuth or token refresh.
 */
export async function createClientFromAuth(): Promise<
  QuireResult<QuireClient>
> {
  // Import dynamically to avoid circular deps and keep sync path fast
  const { getQuireAccessToken, QuireAuthError } = await import("./auth.js");

  try {
    const result = await getQuireAccessToken();
    return {
      success: true,
      data: new QuireClient({ token: result.accessToken }),
    };
  } catch (err) {
    if (err instanceof QuireAuthError) {
      return {
        success: false,
        error: new QuireClientError(err.message, "MISSING_TOKEN"),
      };
    }
    return {
      success: false,
      error: new QuireClientError(
        err instanceof Error ? err.message : "Unknown authentication error",
        "UNKNOWN"
      ),
    };
  }
}
