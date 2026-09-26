import { timingSafeEqual } from "node:crypto";

/** Vérifie l'en-tête « Authorization: Bearer <CRON_SECRET> » des appels planifiés. */
export function appelAutorise(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  const recu = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!secret || secret.length < 16 || recu.length !== secret.length) return false;
  return timingSafeEqual(Buffer.from(recu), Buffer.from(secret));
}
