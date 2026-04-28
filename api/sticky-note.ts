import { assertAuth } from "./_utils/auth.js";
import { supa } from "./_utils/db.js";

export default async function handler(req: any, res: any){
  try{ assertAuth(req, res); }catch{ return; }
  const client = supa();
  if (req.method === "GET"){
    const { data, error } = await client.from("sticky_note").select("content").eq("id","main").single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ content: data?.content || "" });
  }
  if (req.method === "PUT"){
    const { content } = req.body || {};
    const { error } = await client.from("sticky_note").upsert({ id:"main", content }, { onConflict:"id" });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok:true });
  }
  return res.status(405).end();
}
