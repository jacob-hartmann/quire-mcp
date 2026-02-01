/**
 * Quire API Client
 *
 * A typed fetch wrapper for the Quire API with:
 * - Timeouts
 * - Retry/backoff on 429/503
 * - Consistent error mapping
 *
 * Rate Limits (Free plan):
 * - 25 requests per minute
 * - 120 requests per hour
 *
 * @see https://quire.io/dev/api/
 */

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
   */
  private async request<T>(
    endpoint: string,
    options?: {
      method?: "GET" | "POST" | "PUT" | "DELETE";
      body?: Record<string, unknown>;
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
        const data = (await response.json()) as T;
        return { success: true, data };
      }

      // Handle error responses
      const { code, retryable } = parseErrorCode(response.status);

      // Retry logic for retryable errors
      if (retryable && retryCount < this.maxRetries) {
        const delay = INITIAL_RETRY_DELAY_MS * Math.pow(2, retryCount);
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
    return this.request<QuireUser>("/user/id/me");
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
    return this.request<QuireOrganization[]>("/organization/list");
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
    return this.request<QuireOrganization>(endpoint);
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
      return this.request<QuireProject[]>(endpoint);
    }
    return this.request<QuireProject[]>("/project/list");
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
    return this.request<QuireProject>(endpoint);
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
    return this.request<QuireTask[]>(endpoint);
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
      return this.request<QuireTask[]>(`/task/${parentTaskOid}/task/list`);
    }
    const endpoint = isOid(projectIdOrOid)
      ? `/task/list/${projectIdOrOid}`
      : `/task/list/id/${projectIdOrOid}`;
    return this.request<QuireTask[]>(endpoint);
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
      return this.request<QuireTask>(endpoint);
    }
    // If no taskId provided, assume projectIdOrOid is actually the task OID
    return this.request<QuireTask>(`/task/${projectIdOrOid}`);
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
      });
    }
    // Called with OID and params - OID is for the task itself
    return this.request<QuireTask>(`/task/${projectIdOrOid}`, {
      method: "PUT",
      body: taskIdOrParams as Record<string, unknown>,
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
    return this.request<QuireTask[]>(`${endpoint}?${queryParams.toString()}`);
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
    });
  }

  /**
   * Search for tasks in a folder
   *
   * @see https://quire.io/dev/api/#taskSearchFolderFolderOid
   */
  async searchFolderTasks(
    folderOid: string,
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
    return this.request<QuireTask[]>(
      `/task/search-folder/${folderOid}?${queryParams.toString()}`
    );
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
      ? `/task/search-organization/${orgIdOrOid}`
      : `/task/search-organization/id/${orgIdOrOid}`;
    return this.request<QuireTask[]>(`${endpoint}?${queryParams.toString()}`);
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
    return this.request<QuireTag[]>(endpoint);
  }

  /**
   * Get a tag by OID
   *
   * @see https://quire.io/dev/api/#tagOid
   */
  async getTag(oid: string): Promise<QuireResult<QuireTag>> {
    return this.request<QuireTag>(`/tag/${oid}`);
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
      return this.request<QuireComment[]>(endpoint);
    }
    // Using task OID directly
    return this.request<QuireComment[]>(
      `/comment/list/task/${taskOidOrProjectId}`
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
    });
  }

  /**
   * Delete a comment
   *
   * @see https://quire.io/dev/api/#commentOid
   */
  async deleteComment(commentOid: string): Promise<QuireResult<{ oid: string }>> {
    return this.request<{ oid: string }>(`/comment/${commentOid}`, {
      method: "DELETE",
    });
  }

  /**
   * List comments on a chat channel
   *
   * @see https://quire.io/dev/api/#commentListChatChatOid
   */
  async listChatComments(chatOid: string): Promise<QuireResult<QuireComment[]>> {
    return this.request<QuireComment[]>(`/comment/list/chat/${chatOid}`);
  }

  /**
   * Add a comment to a chat channel
   *
   * @see https://quire.io/dev/api/#commentChatChatOid
   */
  async addChatComment(
    chatOid: string,
    params: CreateCommentParams
  ): Promise<QuireResult<QuireComment>> {
    const body: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        body[key] = value;
      }
    }
    return this.request<QuireComment>(`/comment/chat/${chatOid}`, {
      method: "POST",
      body,
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
    return this.request<QuireUser>(endpoint);
  }

  /**
   * List all users accessible to the current user
   *
   * @see https://quire.io/dev/api/#user
   */
  async listUsers(): Promise<QuireResult<QuireUser[]>> {
    return this.request<QuireUser[]>("/user/list");
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
    return this.request<QuireUser[]>(endpoint);
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
    return this.request<QuireStatus[]>(endpoint);
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
    return this.request<QuireStatus>(endpoint);
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
    return this.request<QuirePartner>(`/partner/${oid}`);
  }

  /**
   * List external teams (partners) in a project
   *
   * @see https://quire.io/dev/api/#partnerListProjectOid
   */
  async listPartners(projectIdOrOid: string): Promise<QuireResult<QuirePartner[]>> {
    const endpoint = isOid(projectIdOrOid)
      ? `/partner/list/${projectIdOrOid}`
      : `/partner/list/id/${projectIdOrOid}`;
    return this.request<QuirePartner[]>(endpoint);
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
    });
  }

  /**
   * Get a document by OID
   *
   * @see https://quire.io/dev/api/#docOid
   */
  async getDocument(oid: string): Promise<QuireResult<QuireDocument>> {
    return this.request<QuireDocument>(`/doc/${oid}`);
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
    return this.request<QuireDocument[]>(endpoint);
  }

  /**
   * Update a document
   *
   * @see https://quire.io/dev/api/#docOid
   */
  async updateDocument(
    oid: string,
    params: UpdateDocumentParams
  ): Promise<QuireResult<QuireDocument>> {
    const body: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        body[key] = value;
      }
    }
    return this.request<QuireDocument>(`/doc/${oid}`, {
      method: "PUT",
      body,
    });
  }

  /**
   * Delete a document
   *
   * @see https://quire.io/dev/api/#docOid
   */
  async deleteDocument(oid: string): Promise<QuireResult<{ oid: string }>> {
    return this.request<{ oid: string }>(`/doc/${oid}`, {
      method: "DELETE",
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
    });
  }

  /**
   * Get a sublist by OID
   *
   * @see https://quire.io/dev/api/#sublistOid
   */
  async getSublist(oid: string): Promise<QuireResult<QuireSublist>> {
    return this.request<QuireSublist>(`/sublist/${oid}`);
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
    return this.request<QuireSublist[]>(endpoint);
  }

  /**
   * Update a sublist
   *
   * @see https://quire.io/dev/api/#sublistOid
   */
  async updateSublist(
    oid: string,
    params: UpdateSublistParams
  ): Promise<QuireResult<QuireSublist>> {
    const body: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        body[key] = value;
      }
    }
    return this.request<QuireSublist>(`/sublist/${oid}`, {
      method: "PUT",
      body,
    });
  }

  /**
   * Delete a sublist
   *
   * @see https://quire.io/dev/api/#sublistOid
   */
  async deleteSublist(oid: string): Promise<QuireResult<{ oid: string }>> {
    return this.request<{ oid: string }>(`/sublist/${oid}`, {
      method: "DELETE",
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
    });
  }

  /**
   * Get a chat channel by OID
   *
   * @see https://quire.io/dev/api/#chatOid
   */
  async getChat(oid: string): Promise<QuireResult<QuireChat>> {
    return this.request<QuireChat>(`/chat/${oid}`);
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
    return this.request<QuireChat[]>(endpoint);
  }

  /**
   * Update a chat channel
   *
   * @see https://quire.io/dev/api/#chatOid
   */
  async updateChat(
    oid: string,
    params: UpdateChatParams
  ): Promise<QuireResult<QuireChat>> {
    const body: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        body[key] = value;
      }
    }
    return this.request<QuireChat>(`/chat/${oid}`, {
      method: "PUT",
      body,
    });
  }

  /**
   * Delete a chat channel
   *
   * @see https://quire.io/dev/api/#chatOid
   */
  async deleteChat(oid: string): Promise<QuireResult<{ oid: string }>> {
    return this.request<{ oid: string }>(`/chat/${oid}`, {
      method: "DELETE",
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
    return this.request<QuireStorageEntry>(`/storage/${encodeURIComponent(name)}`);
  }

  /**
   * List storage entries by prefix
   *
   * @see https://quire.io/dev/api/#storageListPrefix
   */
  async listStorageEntries(prefix: string): Promise<QuireResult<QuireStorageEntry[]>> {
    return this.request<QuireStorageEntry[]>(`/storage/list/${encodeURIComponent(prefix)}`);
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
    return this.request<QuireStorageEntry>(`/storage/${encodeURIComponent(name)}`, {
      method: "PUT",
      body: { value },
    });
  }

  /**
   * Delete a stored value
   *
   * @see https://quire.io/dev/api/#storageName
   */
  async deleteStorageValue(name: string): Promise<QuireResult<{ name: string }>> {
    return this.request<{ name: string }>(`/storage/${encodeURIComponent(name)}`, {
      method: "DELETE",
    });
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
        const data = (await response.json()) as QuireAttachment;
        return { success: true, data };
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
        error: new QuireClientError(errorMessage, code, response.status, retryable),
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
        const data = (await response.json()) as QuireAttachment;
        return { success: true, data };
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
        error: new QuireClientError(errorMessage, code, response.status, retryable),
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
