// Authentification d'un déclencheur planifié (cron / scheduled task) — PUR.
//
// Un endpoint de veille planifiée ne doit pas être déclenchable par n'importe qui (sinon spam/coût).
// Convention : header `Authorization: Bearer <CRON_SECRET>`. Trois verdicts distincts pour répondre
// proprement : `disabled` (aucun secret configuré → la veille planifiée est désactivée, 503), `unauthorized`
// (secret attendu mais header absent/incorrect, 401), `ok`. Le secret ne vit qu'en variable d'environnement.

export type CronAuthVerdict = "ok" | "disabled" | "unauthorized";

export function checkCronAuth(authHeader: string | null, secret: string | undefined): CronAuthVerdict {
  if (secret === undefined || secret === "") return "disabled";
  if (authHeader !== `Bearer ${secret}`) return "unauthorized";
  return "ok";
}
