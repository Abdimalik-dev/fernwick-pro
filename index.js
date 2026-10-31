import express from "express";
import pg from "pg";
import Stripe from "stripe";
import nodemailer from "nodemailer";
import multer from "multer";
import crypto from "node:crypto";
import path from "node:path";
import fs from "node:fs";

const { DATABASE_URL, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, ADMIN_PASSWORD, BASE_URL = "http://localhost:5173", SMTP_URL, MAIL_FROM, PORT = 3000 } = process.env;
if (!DATABASE_URL || !STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET || !ADMIN_PASSWORD) { console.error("Fill in server/.env (see .env.example)"); process.exit(1); }
const here = import.meta.dirname, uploads = path.join(here, "uploads"), dist = path.join(here, "../client/dist");
fs.mkdirSync(uploads, { recursive: true });
const pool = new pg.Pool({ connectionString: DATABASE_URL });
const q = (sql, p) => pool.query(sql, p).then(r => r.rows);
const stripe = new Stripe(STRIPE_SECRET_KEY);
const mail = SMTP_URL ? nodemailer.createTransport(SMTP_URL) : null;
const send = (to, subject, text) => mail?.sendMail({ from: MAIL_FROM, to, subject, text }).catch(e => console.error("mail:", e.message));
const usd = c => "$" + (c / 100).toFixed(2);
const settings = async () => Object.fromEntries((await q("SELECT key, value FROM settings")).map(r => [r.key, r.value]));

const app = express();

// Stripe webhook (raw body, so it comes before express.json)
app.post("/api/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  let ev;
  try { ev = stripe.webhooks.constructEvent(req.body, req.headers["stripe-signature"], STRIPE_WEBHOOK_SECRET); } catch { return res.sendStatus(400); }
  if (ev.type === "checkout.session.completed") {
    const c = await pool.connect();
    try {
      await c.query("BEGIN");
      const { rows: [o] } = await c.query("UPDATE orders SET status='paid' WHERE stripe_session=$1 AND status='pending' RETURNING *", [ev.data.object.id]);
      if (o) for (const i of o.items) await c.query("UPDATE products SET stock=GREATEST(0, stock-$1) WHERE id=$2", [i.q, i.id]);
      await c.query("COMMIT");
      if (o) send(o.email, `Your order ${o.no}`, `Hi ${o.name.split(" ")[0]},\n\nThanks for your order ${o.no}. We received your payment of ${usd(o.total_cents)} and will ship within 2 business days.\n\n${o.items.map(i => `${i.q} x ${i.n}`).join("\n")}\n\nShipping to: ${o.address}`);
    } catch (e) { await c.query("ROLLBACK"); console.error(e); return res.sendStatus(500); } finally { c.release(); }
  }
  res.sendStatus(200);
});

app.use(express.json());
app.use("/uploads", express.static(uploads));
app.get("/api/store", async (req, res) => res.json({ settings: await settings(), products: await q("SELECT * FROM products ORDER BY sort, id") }));

app.post("/api/checkout", async (req, res) => {
  try {
    const { name, email, address, items } = req.body || {};
    if (!name || !/^\S+@\S+\.\S+$/.test(email || "") || !address || !Array.isArray(items) || !items.length) throw new Error("Fill in every field and add at least one item.");
    const rows = await q("SELECT * FROM products WHERE id = ANY($1)", [items.map(i => +i.id || 0)]);
    const lines = items.map(i => {
      const p = rows.find(r => r.id == i.id), n = Math.floor(i.q);
      if (!p || !(n > 0)) throw new Error("An item in your cart is no longer available.");
      if (n > p.stock) throw new Error(`${p.name}: only ${p.stock} in stock.`);
      return { p, n };
    });
    const s = await settings(), sub = lines.reduce((t, l) => t + l.p.price_cents * l.n, 0), ship = sub >= (s.free_cents ?? 6000) ? 0 : (s.fee_cents ?? 650);
    const no = "FW-" + crypto.randomInt(10000, 99999);
    const session = await stripe.checkout.sessions.create({
      mode: "payment", customer_email: email, metadata: { no },
      line_items: lines.map(l => ({ quantity: l.n, price_data: { currency: "usd", unit_amount: l.p.price_cents, product_data: { name: l.p.name } } })),
      shipping_options: [{ shipping_rate_data: { type: "fixed_amount", fixed_amount: { amount: ship, currency: "usd" }, display_name: ship ? "Standard shipping" : "Free shipping" } }],
      success_url: BASE_URL + "/?paid=1", cancel_url: BASE_URL + "/"
    });
    await q("INSERT INTO orders (no, name, email, address, items, total_cents, stripe_session) VALUES ($1,$2,$3,$4,$5,$6,$7)",
      [no, name, email, address, JSON.stringify(lines.map(l => ({ id: l.p.id, n: l.p.name, q: l.n, p: l.p.price_cents }))), sub + ship, session.id]);
    res.json({ url: session.url });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// Admin API (HTTP Basic, password = ADMIN_PASSWORD)
const auth = (req, res, next) => {
  const pw = Buffer.from((req.headers.authorization || "").split(" ")[1] || "", "base64").toString().split(":").slice(1).join(":");
  const a = Buffer.from(pw), b = Buffer.from(ADMIN_PASSWORD);
  a.length === b.length && crypto.timingSafeEqual(a, b) ? next() : res.status(401).json({ error: "Wrong password" });
};
const EXT = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/gif": ".gif" };
const upload = multer({ storage: multer.diskStorage({ destination: uploads, filename: (r, f, cb) => cb(null, crypto.randomUUID() + EXT[f.mimetype]) }), limits: { fileSize: 5e6 }, fileFilter: (r, f, cb) => cb(null, f.mimetype in EXT) });
const COLS = ["name", "category", "price_cents", "stock", "emoji", "description", "care", "note", "image_url"];
const A = express.Router();
A.use(auth);
A.get("/orders", async (req, res) => res.json(await q("SELECT * FROM orders ORDER BY created_at DESC LIMIT 200")));
A.post("/orders/:id/ship", async (req, res) => {
  const [o] = await q("UPDATE orders SET status='shipped' WHERE id=$1 AND status='paid' RETURNING *", [req.params.id]);
  if (!o) return res.sendStatus(400);
  send(o.email, `Your order ${o.no} has shipped`, `Hi ${o.name.split(" ")[0]},\n\nOrder ${o.no} is on its way to ${o.address}.`);
  res.json(o);
});
A.put("/settings", async (req, res) => {
  for (const k of ["brand", "title", "intro", "color", "free_cents", "fee_cents"])
    if (k in req.body) await q("INSERT INTO settings (key, value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value=$2", [k, JSON.stringify(req.body[k])]);
  res.json(await settings());
});
A.post("/products", async (req, res) => {
  const b = req.body, [p] = await q("INSERT INTO products (name, category, price_cents, stock, emoji, description, tint, sort) VALUES ($1,$2,$3,$4,$5,$6,$7, (SELECT COALESCE(MAX(sort),0)+1 FROM products)) RETURNING *",
    [b.name, b.category || "Plants", b.price_cents || 0, b.stock || 0, b.emoji || "🌿", b.description || "", Math.floor(Math.random() * 4) + 1]);
  res.json(p);
});
A.put("/products/:id", async (req, res) => {
  const ks = COLS.filter(k => k in req.body);
  if (!ks.length) return res.sendStatus(400);
  const [p] = await q(`UPDATE products SET ${ks.map((k, i) => `${k}=$${i + 1}`).join(", ")} WHERE id=$${ks.length + 1} RETURNING *`, [...ks.map(k => req.body[k]), req.params.id]);
  p ? res.json(p) : res.sendStatus(404);
});
A.delete("/products/:id", async (req, res) => { await q("DELETE FROM products WHERE id=$1", [req.params.id]); res.json({ ok: 1 }); });
A.post("/upload", upload.single("file"), (req, res) => req.file ? res.json({ url: "/uploads/" + req.file.filename }) : res.status(400).json({ error: "Upload a JPG, PNG, WebP, or GIF under 5 MB." }));
app.use("/api/admin", A);

// Serve the built React app (run `npm run build` in client/) and its routes
app.use(express.static(dist));
app.use((req, res, next) => req.method === "GET" && !req.path.startsWith("/api") ? res.sendFile(path.join(dist, "index.html")) : next());
app.use((e, req, res, next) => { console.error(e); res.status(500).json({ error: "Something went wrong. Check the input and try again." }); });
app.listen(PORT, () => console.log(`API on :${PORT}`));
