// api/login.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { setSessionCookie } from "./_utils/auth.js";

export default async function handler(req: VercelRequest, res: VercelResponse){
  if (req.method !== "POST") return res.status(405).end();
  const { passcode } = req.body || {};
  if (!process.env.APP_PASSCODE) return res.status(500).json({ error: "APP_PASSCODE not set" });

  if (passcode === process.env.APP_PASSCODE){
    setSessionCookie(req, res); // ← pass req so we can set Secure correctly
    return res.status(200).json({ ok: true });
  }
  return res.status(401).json({ error: "Invalid passcode" });
}
