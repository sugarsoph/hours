import { createClient } from "@supabase/supabase-js";

export function supa(){
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE!;
  const client = createClient(url, key, { auth: { persistSession: false } });
  return client;
}
