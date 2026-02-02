/**
 * Quire API Types
 *
 * Type definitions for the Quire API responses.
 * These are based on the Quire API documentation: https://quire.io/dev/api/
 */

/**
 * User profile returned by GET /user/id/me
 */
export interface QuireUser {
  id: string;
  oid: string;
  name: string;
  nameText?: string;
  nameHtml?: string;
  email?: string;
  image?: string;
  description?: string;
  descriptionText?: string;
  descriptionHtml?: string;
  website?: string;
  url?: string;
  iconColor?: string;
  timezone?: string;
  locale?: string;
}

/**
 * Simple user reference in API responses
 */
export interface QuireSimpleUser {
  id: string;
  oid?: string;
  name: string;
  nameText?: string;
  image?: string;
  url?: string;
  iconColor?: string;
}

/**
 * Organization returned by the Quire API
 * @see https://quire.io/dev/api/#organization
 */
export interface QuireOrganization {
  oid: string;
  id: string;
  name: string;
  nameText?: string;
  nameHtml?: string;
  description?: string;
  descriptionText?: string;
  descriptionHtml?: string;
  image?: string;
  icon?: string;
  iconColor?: string;
  url?: string;
  website?: string;
  email?: string;
  memberCount?: number;
  projectCount?: number;
  subscription?: {
    plan: string;
    due?: string;
    expired?: boolean;
  };
  createdAt?: string;
  createdBy?: QuireSimpleUser;
  followers?: QuireSimpleUser[];
}

/**
 * Project returned by the Quire API
 * @see https://quire.io/dev/api/#project
 */
export interface QuireProject {
  oid: string;
  id: string;
  name: string;
  nameText?: string;
  nameHtml?: string;
  description?: string;
  descriptionText?: string;
  descriptionHtml?: string;
  image?: string;
  icon?: string;
  iconColor?: string;
  url?: string;
  rootCount?: number;
  taskCount?: number;
  organization?: {
    oid: string;
    id: string;
    name: string;
    nameText?: string;
  };
  owner?: QuireSimpleUser;
  createdAt?: string;
  createdBy?: QuireSimpleUser;
  followers?: QuireSimpleUser[];
  archived?: boolean;
  archivedAt?: string;
}

/**
 * Task returned by the Quire API
 * @see https://quire.io/dev/api/#task
 */
export interface QuireTask {
  oid: string;
  id: number;
  name: string;
  nameText?: string;
  description?: string;
  descriptionText?: string;
  url?: string;
  status?: {
    value: number;
    name: string;
    nameText?: string;
    color?: string;
  };
  priority?: {
    value: number;
    name: string;
    nameText?: string;
    color?: string;
  };
  start?: string;
  due?: string;
  peekaboo?: boolean;
  recurring?: {
    type: string;
    interval?: number;
    byMonth?: number[];
    byDay?: number[];
  };
  order?: number;
  childCount?: number;
  project?: {
    oid: string;
    id: string;
    name: string;
    nameText?: string;
  };
  parent?: {
    oid: string;
    id: number;
  };
  assignees?: QuireSimpleUser[];
  createdAt?: string;
  createdBy?: QuireSimpleUser;
  completedAt?: string;
  completedBy?: QuireSimpleUser;
  tags?: {
    id: number;
    name: string;
    nameText?: string;
    color?: string;
  }[];
  followers?: QuireSimpleUser[];
  togpiledChildren?: boolean;
  etc?: number;
  state?: number;
}

/**
 * Task creation parameters
 */
export interface CreateTaskParams {
  name: string;
  description?: string;
  priority?: number;
  status?: number;
  due?: string;
  start?: string;
  assignees?: string[];
  tags?: number[];
  parentOid?: string;
  afterOid?: string;
}

/**
 * Task update parameters
 */
export interface UpdateTaskParams {
  name?: string;
  description?: string;
  priority?: number;
  status?: number;
  due?: string;
  start?: string;
  assignees?: string[];
  addAssignees?: string[];
  removeAssignees?: string[];
  tags?: number[];
  addTags?: number[];
  removeTags?: number[];
}

/**
 * Organization update parameters
 */
export interface UpdateOrganizationParams {
  followers?: string[];
  addFollowers?: string[];
  removeFollowers?: string[];
}

/**
 * Project update parameters
 */
export interface UpdateProjectParams {
  name?: string;
  description?: string;
  archived?: boolean;
  followers?: string[];
  addFollowers?: string[];
  removeFollowers?: string[];
}

/**
 * Result type for Quire API calls
 */
export type QuireResult<T> =
  | { success: true; data: T }
  | { success: false; error: QuireClientError };

/**
 * Custom error class for Quire client errors
 */
export class QuireClientError extends Error {
  constructor(
    message: string,
    public readonly code: QuireErrorCode,
    public readonly statusCode?: number,
    public readonly retryable = false
  ) {
    super(message);
    this.name = "QuireClientError";
  }
}

/**
 * Error codes for categorizing Quire client errors
 */
export type QuireErrorCode =
  | "MISSING_TOKEN"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "SERVER_ERROR"
  | "NETWORK_ERROR"
  | "TIMEOUT"
  | "UNKNOWN";

// =====================
// Tag Types
// =====================

/**
 * Tag returned by the Quire API
 * @see https://quire.io/dev/api/#tag
 */
export interface QuireTag {
  oid: string;
  id?: number;
  name: string;
  nameText?: string;
  color?: string;
}

/**
 * Tag creation parameters
 */
export interface CreateTagParams {
  name: string;
  color?: string;
}

/**
 * Tag update parameters
 */
export interface UpdateTagParams {
  name?: string;
  color?: string;
}

// =====================
// Comment Types
// =====================

/**
 * Comment returned by the Quire API
 * @see https://quire.io/dev/api/#comment
 */
export interface QuireComment {
  oid: string;
  description: string;
  descriptionText: string;
  descriptionHtml?: string;
  attachments?: unknown[];
  createdAt: string;
  createdBy: QuireSimpleUser;
  editedAt?: string;
  editedBy?: QuireSimpleUser;
  pinAt?: string;
  pinBy?: QuireSimpleUser;
  url?: string;
}

/**
 * Comment creation parameters
 */
export interface CreateCommentParams {
  description: string;
  asUser?: boolean;
  pinned?: boolean;
}

/**
 * Comment update parameters
 */
export interface UpdateCommentParams {
  description?: string;
  pinned?: boolean;
}

// =====================
// Status Types
// =====================

/**
 * Custom status returned by the Quire API
 * @see https://quire.io/dev/api/#status
 */
export interface QuireStatus {
  value: number;
  name: string;
  nameText?: string;
  color?: string;
}

/**
 * Status creation parameters
 */
export interface CreateStatusParams {
  name: string;
  color?: string;
}

/**
 * Status update parameters
 */
export interface UpdateStatusParams {
  name?: string;
  color?: string;
}

// =====================
// Partner Types
// =====================

/**
 * External team (partner) returned by the Quire API
 * @see https://quire.io/dev/api/#partner
 */
export interface QuirePartner {
  oid: string;
  name: string;
  color?: string;
}

// =====================
// Document Types
// =====================

/**
 * Document returned by the Quire API
 * @see https://quire.io/dev/api/#doc
 */
export interface QuireDocument {
  oid: string;
  id: string;
  name: string;
  nameText?: string;
  description?: string;
  descriptionText?: string;
  url?: string;
  createdAt?: string;
  createdBy?: QuireSimpleUser;
}

/**
 * Document creation parameters
 */
export interface CreateDocumentParams {
  name: string;
  description?: string;
}

/**
 * Document update parameters
 */
export interface UpdateDocumentParams {
  name?: string;
  description?: string;
}

// =====================
// Sublist Types
// =====================

/**
 * Sublist returned by the Quire API
 * @see https://quire.io/dev/api/#sublist
 */
export interface QuireSublist {
  oid: string;
  id: string;
  name: string;
  nameText?: string;
  nameHtml?: string;
  description?: string;
  descriptionText?: string;
  descriptionHtml?: string;
  iconColor?: string;
  image?: string;
  url?: string;
  taskCount?: number;
  createdAt?: string;
  createdBy?: QuireSimpleUser;
  archivedAt?: string;
  start?: string;
  due?: string;
}

/**
 * Sublist creation parameters
 */
export interface CreateSublistParams {
  name: string;
  description?: string;
}

/**
 * Sublist update parameters
 */
export interface UpdateSublistParams {
  name?: string;
  description?: string;
}

// =====================
// Chat Types
// =====================

/**
 * Chat channel returned by the Quire API
 * @see https://quire.io/dev/api/#chat
 */
export interface QuireChat {
  oid: string;
  id: string;
  name: string;
  nameText?: string;
  nameHtml?: string;
  description?: string;
  descriptionText?: string;
  descriptionHtml?: string;
  iconColor?: string;
  image?: string;
  url?: string;
  messageCount?: number;
  createdAt?: string;
  members?: QuireSimpleUser[];
  archivedAt?: string;
  start?: string;
  due?: string;
}

/**
 * Chat channel creation parameters
 */
export interface CreateChatParams {
  name: string;
  description?: string;
  members?: string[];
}

/**
 * Chat channel update parameters
 */
export interface UpdateChatParams {
  name?: string;
  description?: string;
  members?: string[];
  addMembers?: string[];
  removeMembers?: string[];
}

// =====================
// Storage Types
// =====================

/**
 * Key-value storage entry returned by the Quire API
 * @see https://quire.io/dev/api/#storage
 */
export interface QuireStorageEntry {
  name: string;
  value: unknown;
}

/**
 * Storage put parameters
 */
export interface PutStorageParams {
  value: unknown;
}

// =====================
// Notification Types
// =====================

/**
 * Parameters for sending a notification
 * @see https://quire.io/dev/api/#notification
 */
export interface SendNotificationParams {
  userIds: string[];
  message: string;
  url?: string;
}

// =====================
// Attachment Types
// =====================

/**
 * Attachment returned by the Quire API
 * Upload endpoints return SimpleAttachment with only name, length, url.
 * Full attachment objects may have additional fields.
 * @see https://quire.io/dev/api/#attachment
 */
export interface QuireAttachment {
  name: string;
  length: number;
  url: string;
  // Additional fields that may appear in full attachment objects
  oid?: string;
  type?: number;
  createdAt?: string;
  createdBy?: QuireSimpleUser;
}
