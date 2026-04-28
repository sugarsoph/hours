import { supa } from "./_utils/db.js";

export default async function handler(req: any, res: any){
  const client = supa();

  // 🔥 ALWAYS SYNC LABELS FROM ENTRIES
  const { data: existing } = await client.from("labels").select("name");
  const existingNames = new Set((existing || []).map((l:any)=> l.name));

  const { data: entries } = await client.from("entries").select("label");

  for (const e of entries || []) {
    if (e.label && !existingNames.has(e.label)) {
      await client.from("labels").insert({
        name: e.label,
        color_hex: "#E8AEB7"
      });
      existingNames.add(e.label);
    }
  }

  // ✅ NORMAL GET
  if (req.method === "GET"){
    const { data, error } = await client
      .from("labels")
      .select("id,name,color_hex")
      .order("name");

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data || []);
  }

  // ✅ CREATE / UPDATE
  if (req.method === "POST"){
    const { name, color_hex } = req.body || {};
    if (!name) return res.status(400).json({ error:"Missing name" });

    const { data, error } = await client
      .from("labels")
      .upsert({ name, color_hex }, { onConflict:"name" })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  return res.status(405).end();
}
