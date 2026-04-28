import { assertAuth } from "../_utils/auth.js";
import { supa } from "../_utils/db.js";

export default async function handler(req: any, res: any){
  try{ assertAuth(req, res); }catch{ return; }
  const client = supa();
  const { id } = req.query as any;
  if (!id) return res.status(400).json({ error:"Missing id" });
  if (req.method === "PATCH"){
    const { day, label, minutes } = req.body || {};
    if (label) await client.from("labels").upsert({ name: label }, { onConflict:"name" });
    const updates:any = {};
    if (day) updates.day = day;
    if (label) updates.label = label;
    if (minutes != null) updates.minutes = minutes;
    const { data, error } = await client.from("entries").update(updates).eq("id", id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }
  if (req.method === "DELETE"){
    const { error } = await client.from("entries").delete().eq("id", id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok:true });
  }
  return res.status(405).end();
}
