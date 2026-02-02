/**
 * Zod Schemas for Quire API Responses
 *
 * Runtime validation schemas for all Quire API response types.
 * These ensure type safety at runtime, not just compile time.
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Common Schemas
// ---------------------------------------------------------------------------

/**
 * Simple user reference schema (appears in many responses)
 */
export const QuireSimpleUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  nameText: z.string(),
  image: z.string().optional(),
});

// ---------------------------------------------------------------------------
// User Schemas
// ---------------------------------------------------------------------------

export const QuireUserSchema = z.object({
  id: z.string(),
  oid: z.string(),
  name: z.string(),
  nameText: z.string(),
  email: z.string().optional(),
  image: z.string().optional(),
  description: z.string().optional(),
  website: z.string().optional(),
  timezone: z.string().optional(),
  locale: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Organization Schemas
// ---------------------------------------------------------------------------

export const QuireOrganizationSchema = z.object({
  oid: z.string(),
  id: z.string(),
  name: z.string(),
  nameText: z.string(),
  description: z.string().optional(),
  descriptionText: z.string().optional(),
  image: z.string().optional(),
  icon: z.string().optional(),
  iconColor: z.string().optional(),
  url: z.string().optional(),
  website: z.string().optional(),
  memberCount: z.number().optional(),
  projectCount: z.number().optional(),
  createdAt: z.string().optional(),
  createdBy: QuireSimpleUserSchema.optional(),
  followers: z.array(QuireSimpleUserSchema).optional(),
});

// ---------------------------------------------------------------------------
// Project Schemas
// ---------------------------------------------------------------------------

export const QuireProjectSchema = z.object({
  oid: z.string(),
  id: z.string(),
  name: z.string(),
  nameText: z.string(),
  description: z.string().optional(),
  descriptionText: z.string().optional(),
  image: z.string().optional(),
  icon: z.string().optional(),
  iconColor: z.string().optional(),
  url: z.string().optional(),
  rootCount: z.number().optional(),
  taskCount: z.number().optional(),
  organization: z
    .object({
      oid: z.string(),
      id: z.string(),
      name: z.string(),
      nameText: z.string(),
    })
    .optional(),
  owner: QuireSimpleUserSchema.optional(),
  createdAt: z.string().optional(),
  createdBy: QuireSimpleUserSchema.optional(),
  followers: z.array(QuireSimpleUserSchema).optional(),
  archived: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// Task Schemas
// ---------------------------------------------------------------------------

export const QuireTaskSchema = z.object({
  oid: z.string(),
  id: z.number(),
  name: z.string(),
  nameText: z.string(),
  description: z.string().optional(),
  descriptionText: z.string().optional(),
  url: z.string().optional(),
  status: z.number().optional(),
  priority: z.number().optional(),
  start: z.string().optional(),
  due: z.string().optional(),
  peekaboo: z.string().optional(),
  recurring: z
    .object({
      type: z.string(),
      interval: z.number().optional(),
      byMonth: z.array(z.number()).optional(),
      byDay: z.array(z.number()).optional(),
    })
    .optional(),
  order: z.number().optional(),
  childCount: z.number().optional(),
  project: z
    .object({
      oid: z.string(),
      id: z.string(),
      name: z.string(),
      nameText: z.string(),
    })
    .optional(),
  parent: z
    .object({
      oid: z.string(),
      id: z.number(),
    })
    .optional(),
  assignees: z.array(QuireSimpleUserSchema).optional(),
  createdAt: z.string().optional(),
  createdBy: QuireSimpleUserSchema.optional(),
  completedAt: z.string().optional(),
  completedBy: QuireSimpleUserSchema.optional(),
  tags: z
    .array(
      z.object({
        id: z.number(),
        name: z.string(),
        nameText: z.string(),
        color: z.string().optional(),
      })
    )
    .optional(),
  followers: z.array(QuireSimpleUserSchema).optional(),
  togpiledChildren: z.boolean().optional(),
  etc: z.number().optional(),
  state: z.number().optional(),
});

// ---------------------------------------------------------------------------
// Tag Schemas
// ---------------------------------------------------------------------------

export const QuireTagSchema = z.object({
  oid: z.string(),
  id: z.number(),
  name: z.string(),
  nameText: z.string(),
  color: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Comment Schemas
// ---------------------------------------------------------------------------

export const QuireCommentSchema = z.object({
  oid: z.string(),
  description: z.string(),
  descriptionText: z.string(),
  createdAt: z.string(),
  createdBy: QuireSimpleUserSchema,
  updatedAt: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Status Schemas
// ---------------------------------------------------------------------------

export const QuireStatusSchema = z.object({
  value: z.number(),
  name: z.string(),
  nameText: z.string(),
  color: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Partner Schemas
// ---------------------------------------------------------------------------

export const QuirePartnerSchema = z.object({
  oid: z.string(),
  id: z.string(),
  name: z.string(),
  nameText: z.string(),
  description: z.string().optional(),
  url: z.string().optional(),
  image: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Document Schemas
// ---------------------------------------------------------------------------

export const QuireDocumentSchema = z.object({
  oid: z.string(),
  id: z.string(),
  name: z.string(),
  nameText: z.string(),
  content: z.string().optional(),
  contentText: z.string().optional(),
  url: z.string().optional(),
  createdAt: z.string().optional(),
  createdBy: QuireSimpleUserSchema.optional(),
});

// ---------------------------------------------------------------------------
// Sublist Schemas
// ---------------------------------------------------------------------------

export const QuireSublistSchema = z.object({
  oid: z.string(),
  id: z.string(),
  name: z.string(),
  nameText: z.string(),
  description: z.string().optional(),
  taskCount: z.number().optional(),
  createdAt: z.string().optional(),
  createdBy: QuireSimpleUserSchema.optional(),
});

// ---------------------------------------------------------------------------
// Chat Schemas
// ---------------------------------------------------------------------------

export const QuireChatSchema = z.object({
  oid: z.string(),
  id: z.string(),
  name: z.string(),
  nameText: z.string(),
  description: z.string().optional(),
  messageCount: z.number().optional(),
  createdAt: z.string().optional(),
  members: z.array(QuireSimpleUserSchema).optional(),
});

// ---------------------------------------------------------------------------
// Storage Schemas
// ---------------------------------------------------------------------------

export const QuireStorageEntrySchema = z.object({
  name: z.string(),
  value: z.unknown(),
});

// ---------------------------------------------------------------------------
// Attachment Schemas
// ---------------------------------------------------------------------------

export const QuireAttachmentSchema = z.object({
  oid: z.string(),
  name: z.string(),
  url: z.string(),
  size: z.number(),
  mimeType: z.string(),
  createdAt: z.string(),
  createdBy: QuireSimpleUserSchema,
});

// ---------------------------------------------------------------------------
// Delete Response Schemas
// ---------------------------------------------------------------------------

export const DeleteOidResponseSchema = z.object({
  oid: z.string(),
});

export const DeleteValueResponseSchema = z.object({
  value: z.number(),
});

export const DeleteNameResponseSchema = z.object({
  name: z.string(),
});

export const SuccessResponseSchema = z.object({
  success: z.boolean(),
});

// ---------------------------------------------------------------------------
// Type Inference (for convenience)
// ---------------------------------------------------------------------------

export type QuireUserSchemaType = z.infer<typeof QuireUserSchema>;
export type QuireOrganizationSchemaType = z.infer<
  typeof QuireOrganizationSchema
>;
export type QuireProjectSchemaType = z.infer<typeof QuireProjectSchema>;
export type QuireTaskSchemaType = z.infer<typeof QuireTaskSchema>;
export type QuireTagSchemaType = z.infer<typeof QuireTagSchema>;
export type QuireCommentSchemaType = z.infer<typeof QuireCommentSchema>;
export type QuireStatusSchemaType = z.infer<typeof QuireStatusSchema>;
export type QuirePartnerSchemaType = z.infer<typeof QuirePartnerSchema>;
export type QuireDocumentSchemaType = z.infer<typeof QuireDocumentSchema>;
export type QuireSublistSchemaType = z.infer<typeof QuireSublistSchema>;
export type QuireChatSchemaType = z.infer<typeof QuireChatSchema>;
export type QuireStorageEntrySchemaType = z.infer<
  typeof QuireStorageEntrySchema
>;
export type QuireAttachmentSchemaType = z.infer<typeof QuireAttachmentSchema>;
