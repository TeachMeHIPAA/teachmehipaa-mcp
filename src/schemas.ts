import * as z from "zod";

// Tool inputs. Values the API would refuse are refused here first, so a bad
// id never reaches a request path and the model gets a precise message.

export const MAX_PAGE_LIMIT = 100;

const LEARNER_STATUSES = [
  "not_started",
  "invite_bounced",
  "in_progress",
  "compliant",
  "expiring_soon",
  "expired",
  "removed",
] as const;

const EVENT_TYPES = [
  "enrollment.certified",
  "seat.consumed",
  "seat.freed",
  "learner.invited",
  "learner.started",
  "learner.certified",
  "learner.expiring",
  "learner.expired",
  "learner.removed",
  "invite.bounced",
  "certificate.revoked",
  "seats.low",
] as const;

const AUDIT_EVENT_TYPES = [
  "enrollment.transition",
  "organization.updated",
  "organization.closed",
  "organization.reopened",
  "member.role_changed",
  "member.transferred",
  "member.removed",
  "certificate.issued",
  "certificate.revoked",
  "seat.granted",
  "api_client.created",
  "api_client.secret_rotated",
  "api_client.revoked",
  "learner.updated",
  "learner.launch_link_created",
  "api_client.updated",
  "oauth_grant.created",
  "oauth_grant.revoked",
] as const;

const AUDIT_TRANSITIONS = [
  "bounce",
  "start",
  "beginAssessment",
  "submitAssessment",
  "certify",
  "revokeCert",
  "archive",
  "unarchive",
  "reinvite",
  "cancelInvite",
] as const;

// The canonical subject id; anything else can never name a learner.
export const LearnerIdSchema = z
  .string()
  .regex(/^sub_[0-9A-HJKMNP-TV-Z]{26}$/)
  .meta({
    description: "The learner's id (sub_…), as returned by list_learners.",
  });

const ExternalIdSchema = z.string().min(1).max(128);

const EventIdSchema = z.string().regex(/^evt_[0-9A-HJKMNP-TV-Z]{26}$/);

const courseId = () =>
  z.string().trim().min(1).max(64).optional().meta({
    description: "Course id. Defaults to the organization's default course.",
  });

const limit = () =>
  z
    .int()
    .min(1)
    .max(MAX_PAGE_LIMIT)
    .optional()
    .meta({
      description: `Page size, 1-${String(MAX_PAGE_LIMIT)}. Defaults to 20.`,
    });

const cursor = () =>
  z.string().min(1).optional().meta({
    description: "The nextCursor of the previous page, to read the next one.",
  });

export const EmptyInputSchema = z.object({}).strict();

export const PageInputSchema = z
  .object({ limit: limit(), cursor: cursor() })
  .strict();

export const CourseInputSchema = z.object({ courseId: courseId() }).strict();

export const ListLearnersInputSchema = z
  .object({
    status: z.enum(LEARNER_STATUSES).optional().meta({
      description: "Only learners in this status.",
    }),
    email: z
      .email()
      .optional()
      .meta({ description: "Find the one learner with this email." }),
    externalId: ExternalIdSchema.optional().meta({
      description: "Find the one learner with this external (HRIS) id.",
    }),
    courseId: courseId(),
    limit: limit(),
    cursor: cursor(),
  })
  .strict();

export const LearnerInputSchema = z
  .object({ learnerId: LearnerIdSchema, courseId: courseId() })
  .strict();

export const CreateLearnerInputSchema = z
  .object({
    email: z.email().meta({ description: "The learner's email address." }),
    name: z
      .string()
      .trim()
      .min(1)
      .max(200)
      .optional()
      .meta({ description: "Full name, as printed on the certificate." }),
    externalId: ExternalIdSchema.optional().meta({
      description:
        "Your system's id for this person (unique per organization).",
    }),
    courseId: courseId(),
    delivery: z
      .enum(["email", "none"])
      .optional()
      .meta({
        description:
          "email (default): we send the invite. none: no email; the result " +
          "carries a single-use joinUrl you must hand to the learner.",
      }),
  })
  .strict();

export const UpdateLearnerInputSchema = z
  .object({
    learnerId: LearnerIdSchema,
    courseId: courseId(),
    name: z
      .string()
      .trim()
      .min(1)
      .max(200)
      .optional()
      .meta({ description: "New full name." }),
    externalId: z
      .union([ExternalIdSchema, z.null()])
      .optional()
      .meta({ description: "New external id, or null to clear it." }),
  })
  .strict()
  .refine(
    (input) => input.name !== undefined || input.externalId !== undefined,
    { error: "set at least one of: name, externalId" },
  );

export const ListCertificatesInputSchema = z
  .object({
    learnerId: LearnerIdSchema.optional().meta({
      description: "Only this learner's certificates (all of them, unpaged).",
    }),
    limit: limit(),
    cursor: cursor(),
  })
  .strict();

export const CertificateInputSchema = z
  .object({
    certificateId: z
      .string()
      .min(1)
      .max(128)
      .regex(/^[A-Za-z0-9_-]+$/)
      .meta({ description: "The certificate id, from list_certificates." }),
  })
  .strict();

export const VerifyCertificateInputSchema = z
  .object({
    tinyId: z
      .string()
      .regex(/^[A-Za-z0-9_-]{1,64}$/)
      .meta({
        description:
          "The id at the end of a tme.so verification link, e.g. " +
          "cAbC123xYz789 for https://tme.so/cAbC123xYz789.",
      }),
  })
  .strict();

export const ListOrgEventsInputSchema = z
  .object({
    after: EventIdSchema.optional().meta({
      description: "The last eventId already seen (a page's nextCursor).",
    }),
    type: z.enum(EVENT_TYPES).optional().meta({
      description: "Only events of this type.",
    }),
    limit: limit(),
  })
  .strict();

export const ListAuditEventsInputSchema = z
  .object({
    type: z.enum(AUDIT_EVENT_TYPES).optional().meta({
      description: "Only audit events of this family.",
    }),
    transition: z.enum(AUDIT_TRANSITIONS).optional().meta({
      description: "Within enrollment.transition, only this transition.",
    }),
    learnerId: LearnerIdSchema.optional().meta({
      description: "Only events about this learner.",
    }),
    since: z.iso
      .datetime()
      .optional()
      .meta({ description: "Inclusive lower bound, ISO 8601." }),
    until: z.iso
      .datetime()
      .optional()
      .meta({ description: "Inclusive upper bound, ISO 8601." }),
    limit: limit(),
    cursor: cursor(),
  })
  .strict();
