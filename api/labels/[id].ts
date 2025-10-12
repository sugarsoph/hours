import type { VercelRequest, VercelResponse } from "@vercel/node";
import { assertAuth } from "../_utils/auth.js";
import { supa } from "../_utils/db.js";

export default async function handler(req: VercelRequest, res: VercelResponse){
  try{ assertAuth(req, res); }catch{ return; }
  const client = supa();
  const { id } = req.query as any;
  if (!id) return res.status(400).json({ error:"Missing id" });
  if (req.method === "PATCH"){
    const { name, color_hex } = req.body || {};
    const updates:any = {};
    if (name) updates.name = name;
    if (color_hex !== undefined) updates.color_hex = color_hex;
    const { data, error } = await client.from("labels").update(updates).eq("id", id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }
  if (req.method === "DELETE"){
    const { error } = await client.from("labels").delete().eq("id", id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok:true });
  }
  return res.status(405).end();
}
