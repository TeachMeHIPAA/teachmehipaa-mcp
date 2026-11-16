/** A diagnostic sink. Callers pass identifiers only, never secrets or bodies. */
export type Log = (
  event: string,
  fields: Readonly<Record<string, unknown>>,
) => void;

/**
 * JSON lines on stderr. stdout belongs to the MCP protocol, so nothing else
 * may write there.
 */
export const stderrLog =
  (now: () => Date = () => new Date()): Log =>
  (event, fields) => {
    process.stderr.write(
      `${JSON.stringify({ at: now().toISOString(), event, ...fields })}\n`,
    );
  };
