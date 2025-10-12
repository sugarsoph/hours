import type { VercelRequest, VercelResponse } from "@vercel/node";
import { assertAuth } from "./_utils/auth.js";
import { supa } from "./_utils/db.js";

export default async function handler(req: VercelRequest, res: VercelResponse){
  try{ assertAuth(req, res); }catch{ return; }
  const client = supa();
  if (req.method === "GET"){
    const { from, to } = req.query as any;
    const q = client.from("entries").select("*").order("day",{ ascending:true });
    if (from) (q as any).gte("day", from);
    if (to) (q as any).lte("day", to);
    const { data, error } = await q;
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }
  if (req.method === "POST"){
    const { day, label, minutes, note } = req.body || {};
    if (!day || !label || minutes == null) return res.status(400).json({ error:"Missing fields" });
    // upsert label
    await client.from("labels").upsert({ name: label }, { onConflict:"name" });
    const { data, error } = await client.from("entries").insert({ day, label, minutes, note }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }
  return res.status(405).end();
}
