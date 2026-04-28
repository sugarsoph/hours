import { supa } from "./_utils/db.js";

export default async function handler(req: any, res: any){
  const client = supa();

  if (req.method === "GET"){

    const { data: labelsData } = await client
      .from("labels")
      .select("id,name,color_hex");

    const { data: entriesData } = await client
      .from("entries")
      .select("label");

    const entryNames = Array.from(
      new Set((entriesData || []).map((e:any)=> e.label).filter(Boolean))
    );

    const existingNames = new Set((labelsData || []).map((l:any)=> l.name));

    for (const name of entryNames) {
      if (!existingNames.has(name)) {
        await client.from("labels").insert({
          name,
          color_hex: "#E8AEB7"
        });
      }
    }

    const { data, error } = await client
      .from("labels")
      .select("id,name,color_hex")
      .order("name");

    if (error) return res.status(500).json({ error: error.message });

    return res.status(200).json(data || []);
  }

  if (req.method === "POST"){
    const { name, color_hex } = req.body || {};
    if (!name) return res.status(400).json({ error:"Missing name" });

    const { data, error } = await client
      .from("labels")
      .insert({ name, color_hex })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });

    return res.status(200).json(data);
  }

  return res.status(405).end();
}
