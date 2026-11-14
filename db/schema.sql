-- EventDesk database schema (PostgreSQL). Safe to run more than once.

CREATE TABLE IF NOT EXISTS tenants (
  id text PRIMARY KEY,
  name text NOT NULL,
  phone text NOT NULL DEFAULT '',
  address text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  gstin text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  password_hash text,
  google_sub text UNIQUE,
  role text NOT NULL DEFAULT 'owner',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS password_resets (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS customers (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS customers_tenant_idx ON customers(tenant_id);

CREATE TABLE IF NOT EXISTS quotations (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  number integer NOT NULL,
  customer_id text NOT NULL REFERENCES customers(id),
  event_type text NOT NULL,
  event_title text NOT NULL,
  event_date date NOT NULL,
  start_time text NOT NULL DEFAULT '',
  end_time text NOT NULL DEFAULT '',
  venue text NOT NULL DEFAULT '',
  guests integer NOT NULL DEFAULT 0,
  notes text NOT NULL DEFAULT '',
  items jsonb NOT NULL DEFAULT '[]',
  discount integer NOT NULL DEFAULT 0,
  subtotal integer NOT NULL DEFAULT 0,
  total integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'Draft',
  public_token text NOT NULL UNIQUE,
  valid_until date NOT NULL,
  decided_at timestamptz,
  decided_by text,
  decline_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, number)
);
CREATE INDEX IF NOT EXISTS quotations_tenant_idx ON quotations(tenant_id, status);

CREATE TABLE IF NOT EXISTS quotation_events (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  quotation_id text NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
  action text NOT NULL,
  actor text NOT NULL,
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS quotation_events_q_idx ON quotation_events(quotation_id);

CREATE TABLE IF NOT EXISTS bookings (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  number integer NOT NULL,
  quotation_id text UNIQUE REFERENCES quotations(id),
  customer_id text NOT NULL REFERENCES customers(id),
  title text NOT NULL,
  event_type text NOT NULL,
  event_date date NOT NULL,
  start_time text NOT NULL DEFAULT '',
  end_time text NOT NULL DEFAULT '',
  venue text NOT NULL DEFAULT '',
  guests integer NOT NULL DEFAULT 0,
  items jsonb NOT NULL DEFAULT '[]',
  total integer NOT NULL DEFAULT 0,
  notes text NOT NULL DEFAULT '',
  crew_needed integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'Confirmed',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, number)
);
CREATE INDEX IF NOT EXISTS bookings_tenant_idx ON bookings(tenant_id, event_date);

CREATE TABLE IF NOT EXISTS staff (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text NOT NULL DEFAULT '',
  kind text NOT NULL,
  leader_id text REFERENCES staff(id) ON DELETE SET NULL,
  daily_wage integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS staff_tenant_idx ON staff(tenant_id);

CREATE TABLE IF NOT EXISTS booking_crew (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  booking_id text NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  staff_id text NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  present boolean NOT NULL DEFAULT false,
  wage integer NOT NULL DEFAULT 0,
  UNIQUE (booking_id, staff_id)
);
CREATE INDEX IF NOT EXISTS booking_crew_staff_idx ON booking_crew(staff_id);

CREATE TABLE IF NOT EXISTS staff_payments (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  staff_id text NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  amount integer NOT NULL CHECK (amount > 0),
  paid_on date NOT NULL,
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS staff_payments_staff_idx ON staff_payments(staff_id);

CREATE TABLE IF NOT EXISTS notifications (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  booking_id text REFERENCES bookings(id) ON DELETE SET NULL,
  channel text NOT NULL DEFAULT 'whatsapp',
  kind text NOT NULL,
  to_phone text NOT NULL,
  body text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'queued',
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  provider_message_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);
CREATE INDEX IF NOT EXISTS notifications_status_idx ON notifications(status, attempts);
CREATE INDEX IF NOT EXISTS notifications_tenant_idx ON notifications(tenant_id, created_at);
