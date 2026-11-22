/**
 * BriefRoom ⇄ Nexconn custom message contract.
 *
 * The backend owns the authoritative order state. After a state change commits, the
 * server publishes the matching BR:* custom message into the order's Nexconn group
 * (Platform Chat API `/v4/group-channel/message/send`, isEchoToSender = 1). Clients
 * register these types before `NCEngine.connect`, render them as activity cards, and
 * treat them as a signal to re-fetch the authoritative order — never as the source of truth.
 *
 * Type names: ≤ 32 chars, no `RC:`/`NC:` prefix (reserved), identical on every platform.
 */
import type { DomainEventType, Role } from './types.ts';

export const BR = {
  OrderCreated: 'BR:OrderCreated',
  ReferenceAdded: 'BR:ReferenceAdded',
  AnnotationCreated: 'BR:AnnotationCreated',
  AnnotationComment: 'BR:AnnotationComment',
  AnnotationUpdated: 'BR:AnnotationUpdated',
  ClarificationRaised: 'BR:ClarificationRaised',
  ClarificationResolved: 'BR:ClarificationResolved',
  SpecUpdated: 'BR:SpecUpdated',
  VersionProposed: 'BR:VersionProposed',
  VersionDecision: 'BR:VersionDecision',
  OrderAgreed: 'BR:OrderAgreed',
  OrderUpdated: 'BR:OrderUpdated',
} as const;
export type BrMessageType = (typeof BR)[keyof typeof BR];

/** Registration flags (Chat SDK `CustomMessageRegistration`). Conversation-like events count as unread. */
export const BR_REGISTRATIONS: { messageType: BrMessageType; isPersisted: boolean; isCounted: boolean }[] = [
  { messageType: BR.OrderCreated, isPersisted: true, isCounted: false },
  { messageType: BR.ReferenceAdded, isPersisted: true, isCounted: true },
  { messageType: BR.AnnotationCreated, isPersisted: true, isCounted: true },
  { messageType: BR.AnnotationComment, isPersisted: true, isCounted: true },
  { messageType: BR.AnnotationUpdated, isPersisted: true, isCounted: false },
  { messageType: BR.ClarificationRaised, isPersisted: true, isCounted: true },
  { messageType: BR.ClarificationResolved, isPersisted: true, isCounted: false },
  { messageType: BR.SpecUpdated, isPersisted: true, isCounted: false },
  { messageType: BR.VersionProposed, isPersisted: true, isCounted: true },
  { messageType: BR.VersionDecision, isPersisted: true, isCounted: true },
  { messageType: BR.OrderAgreed, isPersisted: true, isCounted: true },
  { messageType: BR.OrderUpdated, isPersisted: true, isCounted: false },
];

export const EVENT_TO_MESSAGE: Record<DomainEventType, BrMessageType> = {
  ORDER_CREATED: BR.OrderCreated,
  REFERENCE_ADDED: BR.ReferenceAdded,
  REFERENCE_REMOVED: BR.OrderUpdated,
  ANNOTATION_CREATED: BR.AnnotationCreated,
  ANNOTATION_UPDATED: BR.AnnotationUpdated,
  ANNOTATION_COMMENTED: BR.AnnotationComment,
  ANNOTATION_RESOLUTION_REQUESTED: BR.AnnotationUpdated,
  ANNOTATION_RESOLVED: BR.AnnotationUpdated,
  ANNOTATION_REOPENED: BR.AnnotationUpdated,
  ANNOTATION_DELETED: BR.AnnotationUpdated,
  CLARIFICATION_RAISED: BR.ClarificationRaised,
  CLARIFICATION_COMMENTED: BR.OrderUpdated,
  CLARIFICATION_RESOLVED: BR.ClarificationResolved,
  CLARIFICATION_REOPENED: BR.OrderUpdated,
  SPECIFICATION_UPDATED: BR.SpecUpdated,
  VERSION_PROPOSED: BR.VersionProposed,
  VERSION_APPROVED: BR.VersionDecision,
  VERSION_REJECTED: BR.VersionDecision,
  ORDER_AGREED: BR.OrderAgreed,
  ORDER_REOPENED: BR.OrderUpdated,
  ORDER_COMPLETED: BR.OrderUpdated,
};

export const BR_PREFIX = 'BR:';
export const isBrMessage = (messageType: string) => messageType.startsWith(BR_PREFIX);

/** Display-only crop of an image region (normalised coordinates) for activity cards. */
export interface BrCrop {
  imageUrl: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Payload carried by every BR:* message. Small (<10 KB), display-oriented, versioned.
 * `summary` is always present so unknown/older clients can still render something useful.
 */
export interface BrPayload {
  v: 1;
  eventId: string;
  eventType: DomainEventType;
  orderId: string;
  actor: { role: Role | 'system'; name: string };
  at: number;
  summary: string;
  /** Entity the card links to inside the workspace. */
  focus?: { kind: 'annotation' | 'reference' | 'clarification' | 'version' | 'spec' | 'order'; id: string; number?: number };
  crop?: BrCrop;
  /** Optional extra lines (spec changes, version diff summary). */
  lines?: string[];
  /** Version fingerprint for proposal/decision/agreement cards, re-checked against the API before showing "verified". */
  snapshotHash?: string;
  versionNumber?: number;
  decision?: 'approved' | 'changes_requested';
  annotation?: { kind: string; note: string; color: string | null; status: string };
}
