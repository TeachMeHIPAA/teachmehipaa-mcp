import type { Page } from "teachmehipaa";

import { compact } from "./compact.js";
import {
  environmentMismatch,
  renderAuditEvents,
  renderCertificate,
  renderCertificates,
  renderCompliance,
  renderCourses,
  renderCreatedLearner,
  renderLaunchLink,
  renderLearner,
  renderLearners,
  renderOffboarded,
  renderOrgEvents,
  renderRemind,
  renderSeats,
  renderVerification,
  renderWhoami,
  type PageView,
} from "./render.js";
import {
  CertificateInputSchema,
  CourseInputSchema,
  CreateLearnerInputSchema,
  EmptyInputSchema,
  LearnerInputSchema,
  ListAuditEventsInputSchema,
  ListCertificatesInputSchema,
  ListLearnersInputSchema,
  ListOrgEventsInputSchema,
  PageInputSchema,
  UpdateLearnerInputSchema,
  VerifyCertificateInputSchema,
} from "./schemas.js";
import { defineTool, READ_ONLY, WRITE, type Tool } from "./tool.js";

// One page per call: the model pages on with `cursor` (or `after`), so a
// large organization never turns one tool call into hundreds of requests.
const pageView = <T>(page: Page<T>): PageView<T> => ({
  items: [...page.items],
  nextCursor: page.nextCursor,
});

const whoami = defineTool({
  name: "whoami",
  title: "Who am I",
  description:
    "Show which TeachMeHIPAA organization and API client this server is " +
    "connected as, the scopes the client was granted, and when the current " +
    "access token expires. Call this first when a tool answers 403.",
  scopes: [],
  annotations: READ_ONLY,
  inputSchema: EmptyInputSchema,
  run: async ({ client, environment, apiUrl }) => {
    const introspection = await client.auth.introspect();
    return {
      structured: {
        ...introspection,
        environment,
        apiUrl,
        environmentMismatch: environmentMismatch(
          introspection.mode,
          environment,
        ),
      },
      text: renderWhoami(introspection, environment, apiUrl),
    };
  },
});

const listCourses = defineTool({
  name: "list_courses",
  title: "List courses",
  description:
    "List the public TeachMeHIPAA course catalog (course ids, titles, " +
    "passing score). Use a courseId from here in learner and compliance tools.",
  scopes: [],
  annotations: READ_ONLY,
  inputSchema: PageInputSchema,
  run: async ({ client }, input) => {
    const page = pageView(await client.courses.list(compact(input)));
    return { structured: { ...page }, text: renderCourses(page) };
  },
});

const getComplianceSummary = defineTool({
  name: "get_compliance_summary",
  title: "Get compliance summary",
  description:
    "Organization-wide training compliance for one course: how many " +
    "learners are compliant, expiring soon, expired, in progress, not " +
    "started or bounced, and the compliant rate. For the people behind a " +
    "number, call list_learners with the matching status.",
  scopes: ["compliance:read"],
  annotations: READ_ONLY,
  inputSchema: CourseInputSchema,
  run: async ({ client }, input) => {
    const summary = await client.compliance.retrieve(compact(input));
    return { structured: { ...summary }, text: renderCompliance(summary) };
  },
});

const listLearners = defineTool({
  name: "list_learners",
  title: "List learners",
  description:
    "List the organization's learners for one course with their training " +
    "status (not_started, invite_bounced, in_progress, compliant, " +
    "expiring_soon, expired, removed) and current certificate. Filter by " +
    "status, or look one person up by email or externalId. Paginated: pass " +
    "nextCursor back as cursor for the next page.",
  scopes: ["learners:read"],
  annotations: READ_ONLY,
  inputSchema: ListLearnersInputSchema,
  run: async ({ client }, input) => {
    const page = pageView(await client.learners.list(compact(input)));
    return { structured: { ...page }, text: renderLearners(page) };
  },
});

const getLearner = defineTool({
  name: "get_learner",
  title: "Get learner",
  description:
    "Get one learner's training state in one course: status, invite/start/" +
    "completion dates and current certificate.",
  scopes: ["learners:read"],
  annotations: READ_ONLY,
  inputSchema: LearnerInputSchema,
  run: async ({ client }, { learnerId, courseId }) => {
    const learner = await client.learners.retrieve(
      learnerId,
      compact({ courseId }),
    );
    return { structured: { ...learner }, text: renderLearner(learner) };
  },
});

const createLearner = defineTool({
  name: "create_learner",
  title: "Create learner",
  description:
    "Enroll one person in a course: takes one seat and sends the invite " +
    "email. If the email or externalId already names an active learner, " +
    "returns that learner and takes no seat, so repeating is safe. Fails " +
    "with seat_unavailable when no seat is free (check get_seat_inventory).",
  scopes: ["learners:write"],
  annotations: { ...WRITE, idempotentHint: true },
  inputSchema: CreateLearnerInputSchema,
  // The SDK sends a fresh Idempotency-Key and reuses it on its retries.
  run: async ({ client }, input) => {
    const learner = await client.learners.create(compact(input));
    return {
      structured: { ...learner, created: learner.created },
      text: renderCreatedLearner(learner),
    };
  },
});

const updateLearner = defineTool({
  name: "update_learner",
  title: "Update learner",
  description:
    "Change a learner's name or externalId (externalId null clears it). " +
    "The name is what the certificate prints. Admins and people in more " +
    "than one organization cannot be renamed through the API.",
  scopes: ["learners:write"],
  annotations: { ...WRITE, destructiveHint: true, idempotentHint: true },
  inputSchema: UpdateLearnerInputSchema,
  // The API requires If-Match; the current ETag is read first so the model
  // never has to carry one.
  run: async ({ client }, { learnerId, courseId, name, externalId }) => {
    const current = await client.learners.retrieve(
      learnerId,
      compact({ courseId }),
    );
    if (current.lastResponse.etag === null) {
      throw new Error("The learner was read without an ETag");
    }
    const learner = await client.learners.update(
      learnerId,
      compact({ courseId, name, externalId }),
      { ifMatch: current.lastResponse.etag },
    );
    return { structured: { ...learner }, text: renderLearner(learner) };
  },
});

const offboardLearner = defineTool({
  name: "offboard_learner",
  title: "Offboard learner",
  description:
    "Remove a person from the organization's training. A learner who never " +
    "started has the invite cancelled and the seat returned; one who " +
    "started loses their membership (history is kept). Admins cannot be " +
    "offboarded. Repeating on a removed learner is a no-op.",
  scopes: ["learners:write"],
  annotations: { ...WRITE, destructiveHint: true, idempotentHint: true },
  inputSchema: LearnerInputSchema,
  run: async ({ client }, { learnerId, courseId }) => {
    const learner = await client.learners.offboard(
      learnerId,
      compact({ courseId }),
    );
    return { structured: { ...learner }, text: renderOffboarded(learner) };
  },
});

const remindLearner = defineTool({
  name: "remind_learner",
  title: "Remind learner",
  description:
    "Email a learner a reminder to finish their training. Each call sends " +
    "another email.",
  scopes: ["learners:write"],
  annotations: WRITE,
  inputSchema: LearnerInputSchema,
  run: async ({ client }, { learnerId, courseId }) => {
    const accepted = await client.learners.remind(
      learnerId,
      compact({ courseId }),
    );
    return { structured: { ...accepted }, text: renderRemind(accepted) };
  },
});

const createLearnerLaunchLink = defineTool({
  name: "create_learner_launch_link",
  title: "Create learner launch link",
  description:
    "Mint a single-use sign-in URL into the training app for one learner, " +
    "valid five minutes. It is a bearer link: give it only to that " +
    "learner. Refused for admins, removed learners and learners who have " +
    "not accepted their invite yet.",
  scopes: ["learners:write"],
  annotations: WRITE,
  inputSchema: LearnerInputSchema,
  run: async ({ client }, { learnerId, courseId }) => {
    const link = await client.learners.createLaunchLink(
      learnerId,
      compact({ courseId }),
    );
    return { structured: { ...link }, text: renderLaunchLink(link) };
  },
});

const listCertificates = defineTool({
  name: "list_certificates",
  title: "List certificates",
  description:
    "List the organization's certificate records (VALID, EXPIRED or " +
    "REVOKED), every course and cycle. Pass learnerId for one person's " +
    "full history. Paginated with cursor.",
  scopes: ["certificates:read"],
  annotations: READ_ONLY,
  inputSchema: ListCertificatesInputSchema,
  run: async ({ client }, { learnerId, limit, cursor }) => {
    const page = pageView(
      await client.certificates.list(
        compact({ subjectId: learnerId, limit, cursor }),
      ),
    );
    return { structured: { ...page }, text: renderCertificates(page) };
  },
});

const getCertificate = defineTool({
  name: "get_certificate",
  title: "Get certificate",
  description: "Get one certificate record of the organization by id.",
  scopes: ["certificates:read"],
  annotations: READ_ONLY,
  inputSchema: CertificateInputSchema,
  run: async ({ client }, { certificateId }) => {
    const certificate = await client.certificates.retrieve(certificateId);
    return {
      structured: { ...certificate },
      text: renderCertificate(certificate),
    };
  },
});

const verifyCertificate = defineTool({
  name: "verify_certificate",
  title: "Verify certificate",
  description:
    "Check a certificate behind a tme.so verification link, as anyone " +
    "holding the link can: valid, expired or revoked, with the name and " +
    "course printed on it. Works for any organization's certificate.",
  scopes: [],
  annotations: READ_ONLY,
  inputSchema: VerifyCertificateInputSchema,
  run: async ({ client }, { tinyId }) => {
    const verification = await client.certificateVerifications.retrieve(tinyId);
    return {
      structured: { ...verification },
      text: renderVerification(verification),
    };
  },
});

const getSeatInventory = defineTool({
  name: "get_seat_inventory",
  title: "Get seat inventory",
  description:
    "How many seats the organization holds and how many are free to " +
    "enroll new learners. Each create_learner takes one seat.",
  scopes: ["enrollments:read"],
  annotations: READ_ONLY,
  inputSchema: EmptyInputSchema,
  run: async ({ client }) => {
    const seats = await client.seats.retrieve();
    return { structured: { ...seats }, text: renderSeats(seats) };
  },
});

const listOrgEvents = defineTool({
  name: "list_org_events",
  title: "List organization events",
  description:
    "Read the organization's event log (the same events webhooks deliver, " +
    "kept 30 days), oldest first: learner invited/started/certified/" +
    "expiring/expired/removed, seats. Resume with after = the " +
    "last eventId seen.",
  scopes: ["webhooks:manage", "audit:read"],
  annotations: READ_ONLY,
  inputSchema: ListOrgEventsInputSchema,
  run: async ({ client }, input) => {
    const page = pageView(await client.events.list(compact(input)));
    return { structured: { ...page }, text: renderOrgEvents(page) };
  },
});

const listAuditEvents = defineTool({
  name: "list_audit_events",
  title: "List audit events",
  description:
    "Read the organization's audit trail, newest first: who changed what " +
    "(enrollment transitions, member and learner changes, certificates, " +
    "seats, API clients). A short page with a cursor means keep paging.",
  scopes: ["audit:read"],
  annotations: READ_ONLY,
  inputSchema: ListAuditEventsInputSchema,
  run: async ({ client }, { learnerId, ...filters }) => {
    const page = pageView(
      await client.auditEvents.list(
        compact({ ...filters, subjectId: learnerId }),
      ),
    );
    return { structured: { ...page }, text: renderAuditEvents(page) };
  },
});

/** The curated catalog, in the order `tools/list` returns it. */
export const TOOLS: readonly Tool[] = [
  whoami,
  listCourses,
  getComplianceSummary,
  listLearners,
  getLearner,
  createLearner,
  updateLearner,
  offboardLearner,
  remindLearner,
  createLearnerLaunchLink,
  listCertificates,
  getCertificate,
  verifyCertificate,
  getSeatInventory,
  listOrgEvents,
  listAuditEvents,
];
