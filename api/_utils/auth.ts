// api/_utils/auth.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import cookie from "cookie";

export function assertAuth(req: VercelRequest, res: VercelResponse){
  const cookies = cookie.parse(req.headers.cookie || "");
  if (cookies.session === "ok") return;
  res.status(401).json({ error: "Unauthorized" });
  throw new Error("halt");
}

export function setSessionCookie(req: VercelRequest, res: VercelResponse){
  const isLocal = (req.headers.host || "").includes("localhost") || process.env.NODE_ENV === "development";
  const serialized = cookie.serialize("session", "ok", {
    httpOnly: true,
    secure: !isLocal,      // local dev: false; Vercel prod: true
    sameSite: "lax",
    path: "/",
    maxAge: 31536000       // 1 year
  });
  res.setHeader("Set-Cookie", serialized);
}
