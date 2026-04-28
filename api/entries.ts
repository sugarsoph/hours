// api/entries.ts
import { assertAuth } from "./_utils/auth.js";
import { supa } from "./_utils/db.js";

export default async function handler(req: any, res: any){
  // try{ assertAuth(req, res); }catch{ return; }
  const client = supa();

 if (req.method === "GET"){
  const { from, to } = req.query as any;

  let q = client
    .from("entries")
    .select("*")
    .order("day", { ascending: true });

  if (from) q = q.gte("day", from);
  if (to)   q = q.lte("day", to);

  const { data, error } = await q;

  if (error) return res.status(500).json({ error: error.message });

  return res.status(200).json(data || []);
}

  if (req.method === "POST"){
    const { day, label, minutes, note } = req.body || {};
    if (!day || !label || minutes == null) return res.status(400).json({ error:"Missing fields" });

    // ensure label exists
    await client.from("labels").upsert({ name: label }, { onConflict:"name" });

    // insert entry and RETURN the row
    const { data, error } = await client.from("entries")
      .insert({ day, label, minutes, note })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ id: data.id, day: data.day, label: data.label, minutes: data.minutes });
  }

  return res.status(405).end();
}
