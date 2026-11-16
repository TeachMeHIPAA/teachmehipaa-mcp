import { LEARNER_ID, learnerBody, ORG_ID } from "./fake-api.js";

// Wire bodies shaped like the Developer API's documented responses.

export const EVENT_ID = "evt_01JDDDDDDDDDDDDDDDDDDDDDDD";

const page = (items: readonly unknown[], nextCursor: string | null = null) => ({
  items,
  nextCursor,
});

export const coursesPage = page([
  {
    courseId: "hipaa",
    title: "HIPAA Training",
    courseVersion: "v1",
    passingThreshold: 0.85,
  },
]);

export const complianceSummary = {
  asOf: "2026-11-04T15:00:00Z",
  courseId: "hipaa",
  totals: {
    learners: 84,
    compliant: 71,
    expiringSoon: 6,
    expired: 3,
    inProgress: 2,
    notStarted: 2,
    inviteBounced: 0,
  },
  compliantRate: 0.845,
};

export const learnersPage = page([learnerBody()], "cursor-2");

export const certificate = {
  certificateId: "cert_1",
  subjectId: LEARNER_ID,
  courseId: "hipaa",
  courseVersion: "v1",
  issuedAt: "2026-01-11T10:41:52Z",
  expiresAt: "2027-01-11T10:41:52Z",
  status: "VALID",
  revokedAt: null,
};

export const certificatesPage = page([certificate]);

export const verification = {
  status: "valid",
  learnerName: "Ana Ruiz",
  courseTitle: "HIPAA Training",
  issuedAt: "2026-01-11T10:41:52Z",
  expiresAt: "2027-01-11T10:41:52Z",
  issuer: "TeachMeHIPAA",
};

export const seats = {
  total: 10,
  used: 4,
  available: 6,
  purchased: 10,
  assigned: 4,
  byState: {
    UNUSED: 6,
    ASSIGNED: 1,
    ACCEPTED: 3,
    REVOKED: 0,
    FREE: 0,
    REFUNDED: 0,
  },
};

export const orgEventsPage = page(
  [
    {
      eventId: EVENT_ID,
      eventType: "learner.invited",
      orgId: ORG_ID,
      occurredAt: "2026-11-01T10:00:00.000Z",
      data: { learnerId: LEARNER_ID },
    },
  ],
  EVENT_ID,
);

export const auditEventsPage = page(
  [
    {
      eventId: "aud_1",
      at: "2026-11-01T10:00:00.000Z",
      type: "learner.updated",
      actor: { type: "client", clientId: "cli_01JAAAAAAAAAAAAAAAAAAAAAAA" },
    },
  ],
  "audit-cursor",
);

export const launchLink = {
  url: "https://training.example.test/launch#token",
  expiresAt: "2026-11-13T12:05:00.000Z",
};

export const remindAccepted = { learnerId: LEARNER_ID, action: "remind" };
