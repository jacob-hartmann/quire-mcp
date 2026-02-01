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
  nameText: string;
  email?: string;
  image?: string;
  description?: string;
  website?: string;
  timezone?: string;
  locale?: string;
}

/**
 * Simple user reference in API responses
 */
export interface QuireSimpleUser {
  id: string;
  name: string;
  nameText: string;
  image?: string;
}

/**
 * Organization returned by the Quire API
 * @see https://quire.io/dev/api/#organization
 */
export interface QuireOrganization {
  oid: string;
  id: string;
  name: string;
  nameText: string;
  description?: string;
  descriptionText?: string;
  image?: string;
  icon?: string;
  iconColor?: string;
  url?: string;
  website?: string;
  memberCount?: number;
  projectCount?: number;
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
  nameText: string;
  description?: string;
  descriptionText?: string;
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
    nameText: string;
  };
  owner?: QuireSimpleUser;
  createdAt?: string;
  createdBy?: QuireSimpleUser;
  followers?: QuireSimpleUser[];
  archived?: boolean;
}

/**
 * Task returned by the Quire API
 * @see https://quire.io/dev/api/#task
 */
export interface QuireTask {
  oid: string;
  id: number;
  name: string;
  nameText: string;
  description?: string;
  descriptionText?: string;
  url?: string;
  status?: number;
  priority?: number;
  start?: string;
  due?: string;
  peekaboo?: string;
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
    nameText: string;
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
    nameText: string;
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
  icon?: string;
  iconColor?: string;
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
  id: number;
  name: string;
  nameText: string;
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
  createdAt: string;
  createdBy: QuireSimpleUser;
  updatedAt?: string;
}

/**
 * Comment creation parameters
 */
export interface CreateCommentParams {
  description: string;
}

/**
 * Comment update parameters
 */
export interface UpdateCommentParams {
  description: string;
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
  nameText: string;
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
  id: string;
  name: string;
  nameText: string;
  description?: string;
  url?: string;
  image?: string;
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
  nameText: string;
  content?: string;
  contentText?: string;
  url?: string;
  createdAt?: string;
  createdBy?: QuireSimpleUser;
}

/**
 * Document creation parameters
 */
export interface CreateDocumentParams {
  name: string;
  content?: string;
}

/**
 * Document update parameters
 */
export interface UpdateDocumentParams {
  name?: string;
  content?: string;
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
  nameText: string;
  description?: string;
  taskCount?: number;
  createdAt?: string;
  createdBy?: QuireSimpleUser;
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
  nameText: string;
  description?: string;
  messageCount?: number;
  createdAt?: string;
  members?: QuireSimpleUser[];
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
 * @see https://quire.io/dev/api/#attachment
 */
export interface QuireAttachment {
  oid: string;
  name: string;
  url: string;
  size: number;
  mimeType: string;
  createdAt: string;
  createdBy: QuireSimpleUser;
}
