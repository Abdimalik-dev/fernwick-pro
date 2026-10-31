# Fernwick: React + Node + PostgreSQL store

- **client/**: React (Vite) storefront and `/admin` page
- **server/**: Node + Express API, PostgreSQL, Stripe payments, SMTP email, image uploads
- **docker-compose.yml**: local PostgreSQL (loads `server/schema.sql`, including the starter products)

## Run locally
1. `docker compose up -d` (starts PostgreSQL)
2. `cd server`, copy `.env.example` to `.env` and fill it in (Stripe **test** keys first), then `npm install && npm run dev`
3. In another terminal: `cd client && npm install && npm run dev`, then open http://localhost:5173
4. For payments to complete locally: `stripe listen --forward-to localhost:3000/api/webhook` and paste the `whsec_...` value into `server/.env`. Test card: 4242 4242 4242 4242.
5. Admin: http://localhost:5173/admin (password = `ADMIN_PASSWORD`)

## What the admin controls
Store name, headline, intro text, brand color, free-shipping amount and fee; per product: name, emoji, category, price, stock, description, care/size, note, image upload, delete; add products; orders and shipping emails.

## Deploy
1. Use a managed PostgreSQL (Neon, Supabase, Render, RDS) and run `server/schema.sql` once.
2. `cd client && npm run build`, then run the server (`npm start` in `server/`); it serves the built app.
3. Host the server on Render, Fly.io, Railway, or a VPS over HTTPS. Set the env vars and `BASE_URL` to your public address.
4. In Stripe, add a webhook to `https://YOUR-DOMAIN/api/webhook` for `checkout.session.completed`.
5. Product images go to `server/uploads`, so mount a persistent disk there (or move uploads to S3/Cloudinary).
