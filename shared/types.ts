/**
 * Shared BriefRoom domain vocabulary and API view models.
 * Imported by the Express server and the React client — keep it free of Node and DOM APIs.
 */
import type { SnapshotDiff, BriefSnapshot } from './snapshot.ts';

export type Role = 'seller' | 'customer';
export const ROLES: Role[] = ['seller', 'customer'];
export const roleLabel = (r: Role) => (r === 'seller' ? 'Seller' : 'Customer');
export const otherRole = (r: Role): Role => (r === 'seller' ? 'customer' : 'seller');

export type SpecValue = string | number | boolean | string[];
export type Spec = Record<string, SpecValue>;

/* ------------------------------------------------------------------ order lifecycle */

export const ORDER_STATUSES = ['collecting', 'awaiting_clarification', 'awaiting_approval', 'changes_requested', 'agreed', 'completed'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_META: Record<OrderStatus, { label: string; tone: 'neutral' | 'warning' | 'info' | 'danger' | 'success' | 'muted'; nextAction: { seller: string; customer: string } }> = {
  collecting: { label: 'Collecting details', tone: 'neutral', nextAction: { seller: 'Fill in the price and details, then send it for approval', customer: 'Draw a box on the photo and say what you want there' } },
  awaiting_clarification: { label: 'Questions open', tone: 'warning', nextAction: { seller: 'Answer the open questions in To-do', customer: 'Answer the open questions in To-do' } },
  awaiting_approval: { label: 'Waiting for approval', tone: 'info', nextAction: { seller: 'Check the final version and approve it', customer: 'Check the final version and approve it' } },
  changes_requested: { label: 'Changes asked for', tone: 'danger', nextAction: { seller: 'Make the requested changes, then send it again', customer: 'Wait — the shop is updating it for you' } },
  agreed: { label: 'Agreed', tone: 'success', nextAction: { seller: 'You both agreed. Make it, then mark it completed', customer: 'All done — you both agreed. Nothing more to do' } },
  completed: { label: 'Completed', tone: 'muted', nextAction: { seller: 'Done', customer: 'Done' } },
};

/* ------------------------------------------------------------------ annotations */

export const ANNOTATION_KINDS = ['keep', 'change', 'colour', 'remove', 'add', 'question', 'custom'] as const;
export type AnnotationKind = (typeof ANNOTATION_KINDS)[number];
/** Semantic colour family (design tokens `--annotation-<tone>`), never the only signal: each kind also has a label and icon. */
export type AnnotationTone = 'keep' | 'change' | 'remove' | 'question' | 'add';

export const ANNOTATION_KIND_META: Record<AnnotationKind, { label: string; short: string; tone: AnnotationTone; icon: string; prompt: string }> = {
  keep: { label: 'Keep exactly', short: 'Keep', tone: 'keep', icon: 'lock', prompt: 'What should stay exactly as it is?' },
  change: { label: 'Change this', short: 'Change', tone: 'change', icon: 'pencil', prompt: 'What should change here?' },
  colour: { label: 'Change colour', short: 'Colour', tone: 'change', icon: 'palette', prompt: 'Which colour should this be?' },
  remove: { label: 'Remove', short: 'Remove', tone: 'remove', icon: 'eraser', prompt: 'What should be removed?' },
  add: { label: 'Add something', short: 'Add', tone: 'add', icon: 'plus', prompt: 'What should be added here?' },
  question: { label: 'Ask a question', short: 'Ask', tone: 'question', icon: 'circle-help', prompt: 'What would you like to ask?' },
  custom: { label: 'Something else', short: 'Other', tone: 'change', icon: 'message-square-text', prompt: 'What do you want here?' },
};

export const ANNOTATION_STATUSES = ['open', 'discussion', 'resolved'] as const;
export type AnnotationStatus = (typeof ANNOTATION_STATUSES)[number];
export type AnnotationShape = 'rect' | 'point';

export interface CommentView {
  id: string;
  authorRole: Role;
  authorName: string;
  body: string;
  createdAt: number;
}

export interface AnnotationView {
  id: string;
  number: number;
  referenceId: string;
  kind: AnnotationKind;
  shape: AnnotationShape;
  /** Normalised image coordinates, 0..1 of the original image (resize-safe). */
  x: number;
  y: number;
  w: number;
  h: number;
  color: string | null;
  note: string;
  status: AnnotationStatus;
  resolutionRequestedBy: Role | null;
  resolvedBy: Role | null;
  resolvedAt: number | null;
  createdByRole: Role;
  createdAt: number;
  updatedAt: number;
  comments: CommentView[];
}

/* ------------------------------------------------------------------ references */

export interface ReferenceView {
  id: string;
  url: string;
  width: number;
  height: number;
  mimeType: string;
  sha256: string;
  caption: string;
  source: 'upload' | 'chat';
  createdByRole: Role;
  createdAt: number;
  removed: boolean;
}

/* ------------------------------------------------------------------ clarifications & suggestions */

export const CLARIFICATION_STATUSES = ['open', 'discussion', 'resolved'] as const;
export type ClarificationStatus = (typeof CLARIFICATION_STATUSES)[number];
export type ClarificationSource = 'manual' | 'ai' | 'rules';

export interface ClarificationView {
  id: string;
  title: string;
  description: string;
  status: ClarificationStatus;
  critical: boolean;
  source: ClarificationSource;
  evidence: string;
  annotationId: string | null;
  messageId: string | null;
  createdByRole: Role;
  ownerRole: Role | null;
  resolution: string | null;
  resolvedByRole: Role | null;
  resolvedAt: number | null;
  createdAt: number;
  updatedAt: number;
  comments: CommentView[];
}

export const SUGGESTION_CATEGORIES = [
  'vague_quantity',
  'unspecified_colour',
  'missing_size',
  'missing_delivery_time',
  'conflict',
  'incomplete_spec',
  'ambiguous_annotation',
] as const;
export type SuggestionCategory = (typeof SUGGESTION_CATEGORIES)[number];

export interface SuggestionEvidence {
  kind: 'message' | 'annotation' | 'spec' | 'clarification';
  /** message id, annotation id, spec field key or clarification id */
  ref: string;
  quote: string;
}

export interface SuggestionView {
  id: string;
  question: string;
  category: SuggestionCategory;
  evidence: SuggestionEvidence[];
  source: 'ai' | 'rules';
  status: 'suggested' | 'asked' | 'dismissed';
  clarificationId: string | null;
  createdAt: number;
}

/* ------------------------------------------------------------------ versions & approvals */

export type VersionStatus = 'proposed' | 'changes_requested' | 'superseded' | 'agreed';

export interface ApprovalView {
  id: string;
  role: Role;
  decision: 'approved' | 'changes_requested';
  snapshotHash: string;
  reason: string;
  createdAt: number;
}

export interface VersionView {
  id: string;
  number: number;
  snapshot: BriefSnapshot;
  snapshotHash: string;
  hashAlgorithm: string;
  proposedByRole: Role;
  note: string;
  status: VersionStatus;
  createdAt: number;
  approvals: ApprovalView[];
  /** Difference from the previous version (null for version 1). Derived from the two stored snapshots. */
  diff: SnapshotDiff | null;
}

/* ------------------------------------------------------------------ order view */

export type BlockerKind = 'required_field' | 'critical_clarification' | 'open_question';
export interface Blocker {
  kind: BlockerKind;
  id: string;
  label: string;
}

export interface ParticipantView {
  role: Role;
  name: string;
  nexconnUserId: string;
}

export interface ActivityView {
  id: string;
  seq: number;
  type: DomainEventType;
  actorRole: Role | 'system' | null;
  entityType: string;
  entityId: string;
  summary: string;
  createdAt: number;
  nexconnStatus: 'pending' | 'sending' | 'sent' | 'skipped' | 'failed';
  nexconnMessageId: string | null;
}

export interface OrderView {
  id: string;
  shopId: string;
  shopName: string;
  template: string;
  title: string;
  status: OrderStatus;
  revision: number;
  createdAt: number;
  updatedAt: number;
  agreedAt: number | null;
  completedAt: number | null;
  role: Role;
  participants: ParticipantView[];
  channel: { channelId: string; status: 'pending' | 'ready' | 'failed' | 'disabled'; lastError: string | null };
  references: ReferenceView[];
  annotations: AnnotationView[];
  clarifications: ClarificationView[];
  suggestions: SuggestionView[];
  spec: Spec;
  specMeta: Record<string, { updatedByRole: Role; updatedAt: number }>;
  versions: VersionView[];
  latestVersionId: string | null;
  agreedVersionId: string | null;
  /** Hash of the current (unproposed) draft, comparable with version hashes. */
  draftHash: string;
  draftDirty: boolean;
  blockers: Blocker[];
  activity: ActivityView[];
  /** Only for the seller: the private customer link key. */
  inviteKey?: string;
}

export interface OrderSummary {
  id: string;
  title: string;
  template: string;
  customerName: string;
  status: OrderStatus;
  latestVersionNumber: number;
  price: number | null;
  deliveryDate: string | null;
  thumbnailUrl: string | null;
  annotationCount: number;
  openClarifications: number;
  lastActivity: { summary: string; at: number } | null;
  updatedAt: number;
  createdAt: number;
}

export interface ShopPublic {
  id: string;
  name: string;
  ownerName: string;
  category: string;
  city: string;
  createdAt: number;
}

/* ------------------------------------------------------------------ domain events */

export const DOMAIN_EVENT_TYPES = [
  'ORDER_CREATED',
  'REFERENCE_ADDED',
  'REFERENCE_REMOVED',
  'ANNOTATION_CREATED',
  'ANNOTATION_UPDATED',
  'ANNOTATION_COMMENTED',
  'ANNOTATION_RESOLUTION_REQUESTED',
  'ANNOTATION_RESOLVED',
  'ANNOTATION_REOPENED',
  'ANNOTATION_DELETED',
  'CLARIFICATION_RAISED',
  'CLARIFICATION_COMMENTED',
  'CLARIFICATION_RESOLVED',
  'CLARIFICATION_REOPENED',
  'SPECIFICATION_UPDATED',
  'VERSION_PROPOSED',
  'VERSION_APPROVED',
  'VERSION_REJECTED',
  'ORDER_AGREED',
  'ORDER_REOPENED',
  'ORDER_COMPLETED',
] as const;
export type DomainEventType = (typeof DOMAIN_EVENT_TYPES)[number];

/* ------------------------------------------------------------------ config */

/** OpenAI-compatible providers for the ambiguity check (deterministic rules always run as well). */
export type AiProviderId = 'openai' | 'xai';
export const AI_PROVIDER_LABEL: Record<AiProviderId | 'rules', string> = { openai: 'OpenAI', xai: 'Grok (xAI)', rules: 'rules' };
/** Result of one ambiguity check: `provider` is the AI provider that produced suggestions, or 'rules'. */
export interface AnalysisOutcome {
  provider: AiProviderId | 'rules';
  /** Failures of AI providers that were tried (also set when a fallback provider succeeded). */
  aiError: string | null;
}

export interface PublicConfig {
  nexconn: { enabled: boolean; appKey: string; areaCode: number; environment: 'development' | 'production'; region: string | null };
  ai: { provider: AiProviderId | 'rules' };
  storage: 'local' | 's3';
  publicUrl: string;
}
