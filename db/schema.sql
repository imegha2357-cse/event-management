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

-- ===================== Plans, roles, finance, tools (v2) =====================
-- All statements are additive and safe to run again.
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'basic';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'Active';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS colour text NOT NULL DEFAULT '#111111';
ALTER TABLE tenants ALTER COLUMN colour SET DEFAULT '#111111';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS logo text NOT NULL DEFAULT '';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS doc_style text NOT NULL DEFAULT 'classic';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS terms text NOT NULL DEFAULT '';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS services jsonb NOT NULL DEFAULT '{}';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS custom jsonb NOT NULL DEFAULT '{}';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS plan_changed_at timestamptz;

ALTER TABLE users ADD COLUMN IF NOT EXISTS phone text NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS platform_admin boolean NOT NULL DEFAULT false;
UPDATE users SET role = 'Owner' WHERE role = 'owner';

ALTER TABLE customers ADD COLUMN IF NOT EXISTS custom jsonb NOT NULL DEFAULT '{}';

ALTER TABLE quotations ADD COLUMN IF NOT EXISTS booking_id text;
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS gst boolean NOT NULL DEFAULT false;
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS gst_rate integer NOT NULL DEFAULT 18;
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS tax integer NOT NULL DEFAULT 0;

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS setup_time text NOT NULL DEFAULT '';
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS services jsonb NOT NULL DEFAULT '[]';
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS branch_id text;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS custom jsonb NOT NULL DEFAULT '{}';

ALTER TABLE staff ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT '';
ALTER TABLE staff_payments ADD COLUMN IF NOT EXISTS booking_id text;
ALTER TABLE staff_payments ADD COLUMN IF NOT EXISTS expense_id text;

CREATE TABLE IF NOT EXISTS upgrade_requests (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  plan text NOT NULL,
  note text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'Pending',
  requested_by text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz
);
CREATE INDEX IF NOT EXISTS upgrade_requests_status_idx ON upgrade_requests(status, created_at);

CREATE TABLE IF NOT EXISTS invoices (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  fy text NOT NULL,
  number integer NOT NULL,
  doc_no text NOT NULL,
  booking_id text REFERENCES bookings(id) ON DELETE SET NULL,
  quotation_id text UNIQUE REFERENCES quotations(id) ON DELETE SET NULL,
  customer_id text NOT NULL REFERENCES customers(id),
  issued_on date NOT NULL,
  items jsonb NOT NULL DEFAULT '[]',
  discount integer NOT NULL DEFAULT 0,
  gst boolean NOT NULL DEFAULT false,
  gst_rate integer NOT NULL DEFAULT 18,
  subtotal integer NOT NULL DEFAULT 0,
  tax integer NOT NULL DEFAULT 0,
  total integer NOT NULL DEFAULT 0,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, fy, number)
);
CREATE INDEX IF NOT EXISTS invoices_tenant_idx ON invoices(tenant_id, issued_on);
CREATE INDEX IF NOT EXISTS invoices_booking_idx ON invoices(booking_id);

CREATE TABLE IF NOT EXISTS invoice_payments (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  invoice_id text NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  amount integer NOT NULL CHECK (amount > 0),
  kind text NOT NULL DEFAULT 'Payment',
  mode text NOT NULL DEFAULT 'UPI',
  paid_on date NOT NULL,
  reference text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS invoice_payments_inv_idx ON invoice_payments(invoice_id);
CREATE INDEX IF NOT EXISTS invoice_payments_tenant_idx ON invoice_payments(tenant_id, paid_on);

CREATE TABLE IF NOT EXISTS vendors (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS vendors_tenant_idx ON vendors(tenant_id);

CREATE TABLE IF NOT EXISTS expenses (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  booking_id text REFERENCES bookings(id) ON DELETE SET NULL,
  category text NOT NULL DEFAULT 'Other',
  item text NOT NULL,
  amount integer NOT NULL CHECK (amount > 0),
  spent_on date NOT NULL,
  paid_to text NOT NULL DEFAULT '',
  vendor_id text REFERENCES vendors(id) ON DELETE SET NULL,
  mode text NOT NULL DEFAULT 'UPI',
  bill text NOT NULL DEFAULT '',
  source text NOT NULL DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS expenses_tenant_idx ON expenses(tenant_id, spent_on);
CREATE INDEX IF NOT EXISTS expenses_booking_idx ON expenses(booking_id);

CREATE TABLE IF NOT EXISTS activity_log (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  who text NOT NULL,
  what text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS activity_log_tenant_idx ON activity_log(tenant_id, created_at);

CREATE TABLE IF NOT EXISTS tool_rows (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  tool text NOT NULL,
  coll text NOT NULL,
  booking_id text REFERENCES bookings(id) ON DELETE CASCADE,
  data jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tool_rows_idx ON tool_rows(tenant_id, tool, coll);

CREATE TABLE IF NOT EXISTS tool_seeded (
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  tool text NOT NULL,
  PRIMARY KEY (tenant_id, tool)
)
