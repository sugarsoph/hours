import type { VercelRequest, VercelResponse } from "@vercel/node";
import { assertAuth } from "./_utils/auth.js";
import { supa } from "./_utils/db.js";

export default async function handler(req: VercelRequest, res: VercelResponse){
  try{ assertAuth(req, res); }catch{ return; }
  const client = supa();
  if (req.method === "GET"){
    const { data, error } = await client.from("labels").select("id,name,color_hex").order("name");
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }
  if (req.method === "POST"){
    const { name, color_hex } = req.body || {};
    if (!name) return res.status(400).json({ error:"Missing name" });
    const { data, error } = await client.from("labels").upsert({ name, color_hex }, { onConflict:"name" }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }
  return res.status(405).end();
}
