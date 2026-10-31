CREATE TABLE settings (key text PRIMARY KEY, value jsonb NOT NULL);
CREATE TABLE products (
  id serial PRIMARY KEY, name text NOT NULL, category text NOT NULL DEFAULT 'Plants',
  price_cents int NOT NULL CHECK (price_cents >= 0), stock int NOT NULL DEFAULT 0 CHECK (stock >= 0),
  emoji text NOT NULL DEFAULT '🌿', description text NOT NULL DEFAULT '', care text NOT NULL DEFAULT '',
  note text NOT NULL DEFAULT '', image_url text NOT NULL DEFAULT '', tint int NOT NULL DEFAULT 1, sort int NOT NULL DEFAULT 0);
CREATE TABLE orders (
  id serial PRIMARY KEY, no text UNIQUE NOT NULL, name text NOT NULL, email text NOT NULL, address text NOT NULL,
  items jsonb NOT NULL, total_cents int NOT NULL, status text NOT NULL DEFAULT 'pending',
  stripe_session text UNIQUE, created_at timestamptz NOT NULL DEFAULT now());
INSERT INTO products (name,category,price_cents,stock,emoji,description,care,note,tint,sort) VALUES
('Monstera Deliciosa','Plants',3800,14,'🌿','Big split leaves that make any corner look styled. Likes bright, indirect light.','Bright indirect · Weekly','Not pet safe',1,1),
('Snake Plant','Plants',2600,25,'🪴','Nearly indestructible. Tolerates low light and missed waterings.','Low to bright · Every 2–3 weeks','Not pet safe',4,2),
('Golden Pothos','Plants',1800,30,'🍃','Trailing vines that grow fast on a shelf or in a hanging pot.','Low to medium · Every 1–2 weeks','Not pet safe',1,3),
('Prickly Pear Cactus','Plants',2200,0,'🌵','A sun-lover that wants almost no attention. Perfect for a south window.','Full sun · Monthly','Spiny',2,4),
('Calathea Orbifolia','Plants',4400,3,'🌱','Striped round leaves that fold up at night. Prefers steady humidity.','Medium indirect · Weekly','Pet safe',4,5),
('Baby Rubber Plant','Plants',3200,9,'☘️','Glossy dark leaves and a tidy upright shape.','Bright indirect · Every 1–2 weeks','Not pet safe',1,6),
('Speckle Ceramic Pot','Pots',2800,18,'🏺','Hand-glazed 6 in pot with drainage hole and matching saucer.','6 in · Ceramic','Drains',2,7),
('Woven Seagrass Basket','Pots',3400,7,'🧺','Slips over any nursery pot to hide the plastic. Fits 8 in pots.','8 in · Seagrass','Cover only',3,8),
('Hanging Planter','Pots',2400,12,'🪢','Cotton rope macramé hanger with a 5 in terracotta pot.','5 in · Terracotta','Drains',3,9),
('Brass Watering Can','Care',3000,22,'🫗','Long narrow spout reaches under leaves. Holds 1 liter.','1 L · Brass','',2,10),
('Plant Food','Care',1200,40,'🧪','Gentle liquid feed for all houseplants. One capful every month.','250 ml · Monthly','',4,11),
('Chunky Potting Mix','Care',1500,35,'🪱','Airy blend of bark, perlite and coir that stops roots from rotting.','5 L · Bag','',3,12);
