import { useEffect, useState } from "react";
import { money, Pic, tint } from "./Store.jsx";

const CATS = ["Plants", "Pots", "Care"];
const Field = ({ label, value, onSave, type = "text", w = 130 }) => (
  <label>{label}<input key={String(value)} type={type} defaultValue={value ?? ""} style={{ width: w }}
    onBlur={e => e.target.value !== String(value ?? "") && onSave(e.target.value)} /></label>
);

export default function Admin() {
  const [pw, setPw] = useState(sessionStorage.getItem("fw-pw") || ""), [ok, setOk] = useState(false);
  const [data, setData] = useState(null), [orders, setOrders] = useState([]), [msg, setMsg] = useState("");

  const api = async (url, method = "GET", body) => {
    const h = { Authorization: "Basic " + btoa("admin:" + pw) };
    if (body && !(body instanceof FormData)) { h["Content-Type"] = "application/json"; body = JSON.stringify(body); }
    const r = await fetch("/api/admin/" + url, { method, headers: h, body });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || r.status);
    return r.json();
  };
  const load = async () => {
    try {
      const [s, o] = await Promise.all([fetch("/api/store").then(r => r.json()), api("orders")]);
      setData(s); setOrders(o); setOk(true); sessionStorage.setItem("fw-pw", pw);
    } catch { setOk(false); setMsg("Wrong password or the server isn’t reachable."); }
  };
  const run = async fn => { try { await fn(); await load(); setMsg("Saved"); } catch (e) { setMsg("Couldn’t save: " + e.message); } };
  useEffect(() => { if (pw) load(); }, []);

  if (!ok) return (
    <div className="wrap" style={{ padding: "40px 16px" }}><h1 className="brand">Admin</h1>
      <form className="pe" style={{ flexDirection: "row" }} onSubmit={e => { e.preventDefault(); load(); }}>
        <label>Password<input type="password" value={pw} onChange={e => setPw(e.target.value)} /></label><button className="btn">Sign in</button></form>
      <p className="meta">{msg}</p></div>
  );

  const S = data.settings, site = (k, cents) => v => run(() => api("settings", "PUT", { [k]: cents ? Math.round(+v * 100) : v }));
  const patch = (id, body) => run(() => api("products/" + id, "PUT", body));
  const upload = (id, file) => run(async () => { const f = new FormData(); f.append("file", file); const { url } = await api("upload", "POST", f); await api("products/" + id, "PUT", { image_url: url }); });

  return (
    <div className="wrap" style={{ padding: "16px" }}>
      <div className="bar"><span className="brand">Admin</span><a className="btn ghost" href="/">View store</a></div>
      <p className="meta" role="status">{msg}</p>

      <h2>Site</h2>
      <div className="pe">
        <Field label="Store name" value={S.brand ?? "Fernwick"} onSave={site("brand")} />
        <Field label="Headline" value={S.title ?? "Plants that survive your living room."} onSave={site("title")} w={300} />
        <Field label="Intro text" value={S.intro ?? "Easy-care houseplants, sturdy pots, and the few supplies you actually need."} onSave={site("intro")} w={300} />
        <Field label="Brand color" type="color" value={S.color ?? "#2f5d45"} onSave={site("color")} w={60} />
        <Field label="Free shipping from ($)" type="number" value={(S.free_cents ?? 6000) / 100} onSave={site("free_cents", true)} w={90} />
        <Field label="Shipping fee ($)" type="number" value={(S.fee_cents ?? 650) / 100} onSave={site("fee_cents", true)} w={90} />
      </div>

      <h2>Orders</h2>
      {orders.length ? orders.map(o => (
        <div className="line" style={{ display: "block" }} key={o.id}><b>{o.no}</b> ({o.status}) · {o.name} · {money(o.total_cents)}
          <div className="meta">{o.email}<br />{o.address}<br />{o.items.map(i => `${i.q}× ${i.n}`).join(", ")}</div>
          {o.status === "paid" && <button className="btn" onClick={() => run(() => api(`orders/${o.id}/ship`, "POST"))}>Mark shipped</button>}</div>
      )) : <p className="meta">No orders yet.</p>}

      <h2>Products</h2>
      {data.products.map(p => (
        <div className="line" style={{ display: "block" }} key={p.id}><div className="pe">
          <span className="pv" style={tint(p)}><Pic p={p} /></span>
          <Field label="Name" value={p.name} onSave={v => patch(p.id, { name: v })} w={170} />
          <Field label="Emoji" value={p.emoji} onSave={v => patch(p.id, { emoji: v })} w={56} />
          <label>Category<select value={p.category} onChange={e => patch(p.id, { category: e.target.value })}>{CATS.map(c => <option key={c}>{c}</option>)}</select></label>
          <Field label="Price ($)" type="number" value={p.price_cents / 100} onSave={v => patch(p.id, { price_cents: Math.max(0, Math.round(+v * 100) || 0) })} w={80} />
          <Field label="Stock" type="number" value={p.stock} onSave={v => patch(p.id, { stock: Math.max(0, Math.floor(+v) || 0) })} w={70} />
          <Field label="Description" value={p.description} onSave={v => patch(p.id, { description: v })} w={300} />
          <Field label="Care or size" value={p.care} onSave={v => patch(p.id, { care: v })} />
          <Field label="Note" value={p.note} onSave={v => patch(p.id, { note: v })} />
          <label>Image<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={e => e.target.files[0] && upload(p.id, e.target.files[0])} /></label>
          {p.image_url && <button className="btn ghost" onClick={() => patch(p.id, { image_url: "" })}>Remove image</button>}
          <button className="btn ghost" onClick={() => window.confirm("Delete " + p.name + "?") && run(() => api("products/" + p.id, "DELETE"))}>Delete</button>
        </div></div>
      ))}

      <h2>Add a product</h2>
      <form className="pe" style={{ flexDirection: "row" }} onSubmit={e => {
        e.preventDefault(); const f = new FormData(e.target);
        run(() => api("products", "POST", { name: f.get("n"), category: f.get("c"), emoji: f.get("e"), description: f.get("d"), price_cents: Math.round(+f.get("p") * 100), stock: Math.floor(+f.get("s")) || 0 })).then(() => e.target.reset());
      }}>
        <label>Name<input name="n" required /></label>
        <label>Category<select name="c">{CATS.map(c => <option key={c}>{c}</option>)}</select></label>
        <label>Emoji<input name="e" defaultValue="🌿" maxLength={4} style={{ width: 56 }} /></label>
        <label>Price ($)<input name="p" type="number" min="0" step="0.5" required style={{ width: 80 }} /></label>
        <label>Stock<input name="s" type="number" min="0" defaultValue="10" style={{ width: 70 }} /></label>
        <label>Description<input name="d" /></label>
        <button className="btn">Add product</button>
      </form>
    </div>
  );
}
