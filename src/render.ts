import type {
  AuditEvent,
  Certificate,
  CertificateVerification,
  ComplianceSummary,
  Course,
  Event,
  Learner,
  LearnerLaunchLink,
  LearnerRemindAccepted,
  LearnerWriteResult,
  SeatsInventory,
  TokenIntrospection,
} from "teachmehipaa";

import type { Environment } from "./config.js";

// Concise text for the LLM; the full record rides `structuredContent`.

export interface PageView<T> {
  readonly items: readonly T[];
  readonly nextCursor: string | null;
}

const PERCENT = 100;

const day = (instant: string | null): string =>
  instant === null ? "—" : instant.slice(0, "YYYY-MM-DD".length);

const lines = (...parts: readonly string[]): string => parts.join("\n");

const pageFooter = (count: number, nextCursor: string | null): string =>
  nextCursor === null
    ? `${String(count)} item(s); no more pages.`
    : `${String(count)} item(s); more available with cursor ${nextCursor}`;

const renderPage = <T>(page: PageView<T>, line: (item: T) => string): string =>
  lines(
    ...page.items.map(line),
    pageFooter(page.items.length, page.nextCursor),
  );

/**
 * When the token's mode contradicts TMH_ENVIRONMENT, the fix in one
 * sentence; otherwise null. Sandbox tokens report mode "test".
 */
export const environmentMismatch = (
  mode: string | null,
  environment: Environment,
): string | null => {
  if (mode === "test" && environment === "live") {
    return (
      "This is a sandbox (test) token, but TMH_ENVIRONMENT is live. " +
      "Set TMH_ENVIRONMENT=sandbox."
    );
  }
  if (mode === "live" && environment === "sandbox") {
    return (
      "This is a live token, but TMH_ENVIRONMENT is sandbox. " +
      "Set TMH_ENVIRONMENT=live."
    );
  }
  return null;
};

export const renderWhoami = (
  introspection: TokenIntrospection,
  environment: Environment,
  apiUrl: string | null,
): string => {
  const where =
    apiUrl === null
      ? `the ${environment} environment`
      : `${apiUrl} (TMH_API_URL; ${environment} environment)`;
  const mismatch = environmentMismatch(introspection.mode, environment);
  return lines(
    `Connected to ${where} as ${introspection.actorType} ${
      introspection.clientId ?? introspection.subjectId ?? "unknown"
    }.`,
    `Organization: ${introspection.orgId ?? "none (not org-bound)"}`,
    `Mode: ${introspection.mode ?? "—"}`,
    `Scopes: ${introspection.scopes.join(", ") || "none"}`,
    `Token expires: ${introspection.expiresAt ?? "—"}`,
    ...(mismatch === null ? [] : [`Warning: ${mismatch}`]),
  );
};

export const renderCourses = (page: PageView<Course>): string =>
  renderPage(
    page,
    (course) =>
      `${course.courseId}: ${course.title} (${course.courseVersion}, pass ≥ ${String(
        Math.round(course.passingThreshold * PERCENT),
      )}%)`,
  );

export const renderCompliance = (summary: ComplianceSummary): string => {
  const { totals } = summary;
  return lines(
    `Course ${summary.courseId} as of ${summary.asOf}: ${String(
      Math.round(summary.compliantRate * PERCENT),
    )}% compliant (${String(totals.compliant)}/${String(totals.learners)}).`,
    `Expiring soon ${String(totals.expiringSoon)}, expired ${String(
      totals.expired,
    )}, in progress ${String(totals.inProgress)}, not started ${String(
      totals.notStarted,
    )}, invite bounced ${String(totals.inviteBounced)}.`,
  );
};

const learnerLine = (learner: Learner | LearnerWriteResult): string => {
  const name = learner.name ?? "(no name)";
  const external =
    learner.externalId === null ? "" : ` ext:${learner.externalId}`;
  const certificate =
    learner.certificate === null
      ? ""
      : `, certificate expires ${day(learner.certificate.expiresAt)}`;
  return `${learner.learnerId} ${name} <${learner.email}>${external} — ${learner.status} in ${learner.course.courseId}${certificate}`;
};

export const renderLearner = (learner: Learner | LearnerWriteResult): string =>
  lines(
    learnerLine(learner),
    `Invited ${day(learner.invitedAt)}, started ${day(
      learner.startedAt,
    )}, completed ${day(learner.completedAt)}.`,
  );

export const renderLearners = (page: PageView<Learner>): string =>
  renderPage(page, learnerLine);

export const renderCreatedLearner = (learner: LearnerWriteResult): string =>
  lines(
    learner.created
      ? "Created learner (one seat taken)."
      : "Already an active learner; no seat taken.",
    renderLearner(learner),
    learner.joinUrl === undefined
      ? `Invite delivery: ${learner.delivery ?? "email"}.`
      : `Join link (single use, give it only to the learner): ${learner.joinUrl}`,
  );

export const renderOffboarded = (learner: Learner): string =>
  `Offboarded.\n${renderLearner(learner)}`;

export const renderRemind = (accepted: LearnerRemindAccepted): string =>
  `Reminder queued for ${accepted.learnerId}.`;

export const renderLaunchLink = (link: LearnerLaunchLink): string =>
  `Single-use sign-in link (expires ${link.expiresAt}): ${link.url}`;

const certificateLine = (certificate: Certificate): string =>
  `${certificate.certificateId} ${certificate.status} — ${certificate.courseId}, ` +
  `holder ${certificate.subjectId ?? "unknown"}, issued ${day(
    certificate.issuedAt,
  )}, expires ${day(certificate.expiresAt)}`;

export const renderCertificate = (certificate: Certificate): string =>
  certificateLine(certificate);

export const renderCertificates = (page: PageView<Certificate>): string =>
  renderPage(page, certificateLine);

export const renderVerification = (
  verification: CertificateVerification,
): string =>
  `${verification.status.toUpperCase()}: ${verification.learnerName}, ` +
  `${verification.courseTitle}, issued ${day(
    verification.issuedAt,
  )}, expires ${day(verification.expiresAt)} (issuer ${verification.issuer}).`;

export const renderSeats = (seats: SeatsInventory): string =>
  lines(
    `${String(seats.available)} seat(s) available of ${String(
      seats.total,
    )} (used ${String(seats.used)}).`,
    seats.purchased === undefined
      ? ""
      : `Purchased ${String(seats.purchased)}, assigned ${String(
          seats.assigned ?? 0,
        )}.`,
  ).trim();

export const renderOrgEvents = (page: PageView<Event>): string =>
  renderPage(
    page,
    (event) => `${event.occurredAt} ${event.eventType} (${event.eventId})`,
  );

export const renderAuditEvents = (page: PageView<AuditEvent>): string =>
  renderPage(page, (event) => `${event.at} ${event.type} (${event.eventId})`);
