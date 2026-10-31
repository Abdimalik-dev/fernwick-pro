import { useEffect, useMemo, useState } from "react";

export const money = c => "$" + (c / 100).toFixed(2).replace(/\.00$/, "");
export const Pic = ({ p }) => (p.image_url ? <img src={p.image_url} alt="" /> : p.emoji);
export const tint = p => ({ background: `var(--tile${p.tint || 1})` });

function Modal({ onClose, children }) {
  return <dialog ref={el => { if (el && !el.open) el.showModal(); }} onClose={onClose} onClick={e => e.target === e.currentTarget && onClose()}>{children}</dialog>;
}

export default function Store() {
  const [data, setData] = useState(null), [err, setErr] = useState("");
  const [cat, setCat] = useState("All"), [q, setQ] = useState(""), [sort, setSort] = useState("feat");
  const [cart, setCart] = useState(() => { try { return JSON.parse(localStorage.getItem("fw-cart")) || {}; } catch { return {}; } });
  const [cartOpen, setCartOpen] = useState(false), [detail, setDetail] = useState(null), [checkout, setCheckout] = useState(false);
  const [toast, setToast] = useState(""), [formErr, setFormErr] = useState(""), [busy, setBusy] = useState(false);
  const flash = m => { setToast(m); setTimeout(() => setToast(""), 1800); };

  useEffect(() => {
    fetch("/api/store").then(r => r.json()).then(setData).catch(() => setErr("Can’t load the catalog. Refresh to try again."));
    if (location.search.includes("paid=1")) { setCart({}); flash("Payment received. A receipt is on its way to your inbox."); history.replaceState(null, "", "/"); }
  }, []);
  useEffect(() => { try { localStorage.setItem("fw-cart", JSON.stringify(cart)); } catch {} }, [cart]);

  const S = data?.settings || {}, P = data?.products || [];
  useEffect(() => {
    document.title = S.brand || "Fernwick";
    const r = document.documentElement.style;
    if (S.color) { r.setProperty("--moss", S.color); r.setProperty("--moss-ink", "#fff"); } else { r.removeProperty("--moss"); r.removeProperty("--moss-ink"); }
  }, [S.brand, S.color]);

  const lines = Object.keys(cart).map(id => ({ p: P.find(x => x.id == id), n: cart[id] })).filter(l => l.p);
  const sub = lines.reduce((s, l) => s + l.p.price_cents * l.n, 0), count = lines.reduce((n, l) => n + l.n, 0);
  const free = S.free_cents ?? 6000, ship = sub >= free ? 0 : (S.fee_cents ?? 650);
  const add = (p, d = 1) => {
    const n = (cart[p.id] || 0) + d;
    if (d > 0 && n > p.stock) return flash(p.stock ? `Only ${p.stock} in stock` : "Sold out");
    setCart(c => { const m = { ...c, [p.id]: n }; if (n <= 0) delete m[p.id]; return m; });
    if (d > 0) flash(`${p.name} added to cart`);
  };

  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    const l = P.filter(p => (cat === "All" || p.category === cat) && (p.name + " " + p.description).toLowerCase().includes(t));
    if (sort === "lo") l.sort((a, b) => a.price_cents - b.price_cents);
    if (sort === "hi") l.sort((a, b) => b.price_cents - a.price_cents);
    if (sort === "az") l.sort((a, b) => a.name.localeCompare(b.name));
    return l;
  }, [data, cat, q, sort]);

  async function pay(e) {
    e.preventDefault();
    const f = new FormData(e.target);
    setBusy(true); setFormErr("");
    try {
      const r = await fetch("/api/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: f.get("n"), email: f.get("e"), address: f.get("a"), items: lines.map(l => ({ id: l.p.id, q: l.n })) }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      location.href = j.url;
    } catch (x) { setFormErr(x.message || "Checkout failed"); setBusy(false); }
  }

  return (<>
    <header><div className="wrap bar"><span className="brand">{S.brand || "Fernwick"}</span><button className="btn ghost" onClick={() => setCartOpen(true)}>Cart ({count})</button></div></header>
    <main className="wrap">
      <section className="hero"><h1>{S.title || "Plants that survive your living room."}</h1><p>{S.intro || "Easy-care houseplants, sturdy pots, and the few supplies you actually need."}</p></section>
      <div className="tools">
        <div className="chips">{["All", ...new Set(P.map(p => p.category))].map(c => <button key={c} className="chip" aria-pressed={c === cat} onClick={() => setCat(c)}>{c}</button>)}</div>
        <input type="search" placeholder="Search plants, pots, care" aria-label="Search products" value={q} onChange={e => setQ(e.target.value)} />
        <select aria-label="Sort products" value={sort} onChange={e => setSort(e.target.value)}><option value="feat">Featured</option><option value="lo">Price: low to high</option><option value="hi">Price: high to low</option><option value="az">Name A–Z</option></select>
      </div>
      <div className="grid">
        {list.map(p => (
          <article className="card" key={p.id}>
            <button className="tile" style={tint(p)} onClick={() => setDetail(p)} aria-label={"View " + p.name}><Pic p={p} /></button>
            <div className="info"><h3>{p.name}</h3><span className="meta">{p.category}{p.stock > 0 && p.stock <= 5 ? ` · Only ${p.stock} left` : ""}</span>
              <div className="row"><span className="price">{money(p.price_cents)}</span>{p.stock <= 0 ? <button className="btn" disabled>Sold out</button> : <button className="btn" onClick={() => add(p)}>Add to cart</button>}</div>
            </div>
          </article>
        ))}
        {!list.length && <p className="empty">{err || (data ? "No products match. Clear the search or pick another category." : "Loading products…")}</p>}
      </div>
    </main>

    {detail && <Modal onClose={() => setDetail(null)}><div className="sheet">
      <div className="big" style={tint(detail)}><Pic p={detail} /></div><h2>{detail.name}</h2>
      <p className="meta" style={{ margin: 0 }}>{detail.description}</p>
      <div className="facts">{detail.care && <span>{detail.care}</span>}{detail.note && <span>{detail.note}</span>}</div>
      <div className="row"><span className="price">{money(detail.price_cents)}</span><span><button className="btn ghost" onClick={() => setDetail(null)}>Close</button> {detail.stock > 0 && <button className="btn" onClick={() => add(detail)}>Add to cart</button>}</span></div>
    </div></Modal>}

    {checkout && <Modal onClose={() => setCheckout(false)}><form className="sheet" onSubmit={pay}>
      <h2>Checkout</h2>
      <label>Full name<input required name="n" autoComplete="name" /></label>
      <label>Email<input required type="email" name="e" autoComplete="email" /></label>
      <label>Shipping address<input required name="a" autoComplete="street-address" /></label>
      <div className="meta">Subtotal {money(sub)} · Shipping {ship ? money(ship) : "free"}</div>
      <div className="tot"><span>Total</span><span>{money(sub + ship)}</span></div>
      <p className="meta" style={{ margin: 0 }}>You’ll pay securely with Stripe on the next page.</p>
      {formErr && <p className="meta" role="alert" style={{ margin: 0, color: "var(--ink)" }}>{formErr}</p>}
      <div className="row"><button type="button" className="btn ghost" onClick={() => setCheckout(false)}>Back</button><button className="btn" disabled={busy}>Pay now</button></div>
    </form></Modal>}

    <div className={"scrim" + (cartOpen ? " on" : "")} onClick={() => setCartOpen(false)} />
    <aside className={cartOpen ? "open" : ""} aria-label="Shopping cart">
      <div className="ph"><h2>Your cart</h2><button className="btn ghost" onClick={() => setCartOpen(false)}>Close</button></div>
      <div className="lines">{lines.length ? lines.map(({ p, n }) => (
        <div className="line" key={p.id}><div className="e" style={tint(p)}><Pic p={p} /></div>
          <div className="n"><div>{p.name}</div><div className="meta">{money(p.price_cents)}</div></div>
          <div className="qty"><button onClick={() => add(p, -1)} aria-label={"Remove one " + p.name}>−</button><span>{n}</span><button onClick={() => add(p)} aria-label={"Add one " + p.name}>+</button></div></div>
      )) : <p className="empty">Your cart is empty. Add a plant to get started.</p>}</div>
      {lines.length > 0 && <div className="foot">
        <div className="meta">{sub < free ? `Add ${money(free - sub)} more for free shipping` : "You’ve unlocked free shipping"}</div>
        <div className="ship"><i style={{ width: Math.min(100, sub / free * 100) + "%" }} /></div>
        <div className="tot"><span>Subtotal</span><span>{money(sub)}</span></div>
        <button className="btn" onClick={() => { setCartOpen(false); setCheckout(true); }}>Check out</button>
      </div>}
    </aside>
    <div className={"toast" + (toast ? " on" : "")} role="status">{toast}</div>
  </>);
}
