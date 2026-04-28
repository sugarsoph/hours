import React, { useEffect, useMemo, useState } from "react";
import useSWR, { mutate } from "swr";
import { api } from "../lib/api";

type Label = { id: string; name: string; color_hex: string | null };

export default function LabelManager({ open, onClose }:{ open:boolean; onClose:()=>void }){
  const { data: labels } = useSWR<Label[]>("/api/labels", api, { revalidateOnFocus: false, shouldRetryOnError:false, fallbackData: []});
  const [drafts, setDrafts] = useState<Label[]>([]);
  useEffect(()=>{ setDrafts(labels || []); }, [labels]);

  const [hex, setHex] = useState("#FFD7E2");

  const onSave = async () => {
  for (const d of drafts) {
    await api(`/api/labels/${d.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        name: d.name,
        color_hex: d.color_hex || "#FFD7E2"
      })
    });
  }

  await mutate("/api/labels");
  onClose();
};

  const onDelete = async(id:string)=>{
    await api(`/api/labels/${id}`, { method: "DELETE" });
    await mutate("/api/labels");
  };

  if(!open) return null;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <h3 style={{marginTop:0}}>Label Manager</h3>
        <div style={{display:"flex", gap:16, alignItems:"flex-start"}}>
          <div style={{flex:1}}>
            {(drafts||[]).map((l,i)=>(
              <div key={l.id} style={{display:"grid", gridTemplateColumns:"1fr 130px 42px", gap:8, alignItems:"center", marginBottom:8}}>
                <input value={l.name} onChange={e=>{
                  const v=e.target.value; setDrafts(d=>d.map((x,idx)=> idx===i? {...x,name:v}:x));
                }} />
                <div style={{display:"flex", alignItems:"center", gap:8}}>
                  <span className="color-swatch" style={{background:l.color_hex || "#FFD7E2"}}/>
                  <input type="text" placeholder="#HEX" value={l.color_hex||""} onChange={e=>{
                    const v=e.target.value; setDrafts(d=>d.map((x,idx)=> idx===i? {...x,color_hex:v}:x));
                  }} />
                </div>
                <button className="action-btn" onClick={()=>onDelete(l.id)}>🗑</button>
              </div>
            ))}
          </div>
          <div style={{width:200}}>
            <div className="pastel-wheel" onClick={(e) => {
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();

  const x = e.clientX - rect.left - rect.width / 2;
  const y = e.clientY - rect.top - rect.height / 2;

  const angle = Math.atan2(y, x);
  let deg = angle * (180 / Math.PI);
  if (deg < 0) deg += 360;

  const col = `hsl(${Math.round(deg)}, 80%, 70%)`;

  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = col;
  ctx.fillRect(0, 0, 1, 1);

  const data = ctx.getImageData(0, 0, 1, 1).data;
  const toHex = (n: number) => n.toString(16).padStart(2, "0");

  const hex = `#${toHex(data[0])}${toHex(data[1])}${toHex(data[2])}`.toUpperCase();
  setHex(hex);
}} />
            <div style={{textAlign:"center", marginTop:8}}>
              <div style={{display:"inline-flex", alignItems:"center", gap:8}}>
                <span className="color-swatch" style={{background:hex}}/>
                <input value={hex} onChange={e=>setHex(e.target.value)} />
                <button className="button" onClick={()=>{
  setDrafts(ds => {
    if (!ds.length) return ds;
    const idx = ds.length - 1;
    return ds.map((d, i) =>
      i === idx ? { ...d, color_hex: hex } : d
    );
  });
}}>
  Apply to last
</button>
              </div>
            </div>
          </div>
        </div>
        <div style={{display:"flex", justifyContent:"flex-end", gap:8, marginTop:14}}>
          <button className="action-btn" onClick={onClose}>Cancel</button>
          <button className="button" onClick={onSave}>Save</button>
        </div>
      </div>
    </div>
  );
}
