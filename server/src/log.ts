/** One-line JSON logs (Railway shows and filters them). Never log keys, tokens or full transactions. */
const out = (level: string, scope: string, msg: string, extra?: Record<string, unknown>) =>
  console.log(JSON.stringify({ t: new Date().toISOString(), level, scope, msg, ...extra }));

export const log = {
  info: (scope: string, msg: string, extra?: Record<string, unknown>) => out("info", scope, msg, extra),
  warn: (scope: string, msg: string, extra?: Record<string, unknown>) => out("warn", scope, msg, extra),
  error: (scope: string, msg: string, extra?: Record<string, unknown>) => out("error", scope, msg, extra),
};
