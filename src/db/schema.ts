import { pgTable, text, integer, jsonb, timestamp, date, boolean } from 'drizzle-orm/pg-core';

export type LineItem = { desc: string; qty: number; rate: number };
export type CustomField = { id: string; label: string; type: 'text' | 'number' | 'date' | 'select'; options?: string[] };
export type ToolField = { id: string; label: string; type: 'text' | 'number' | 'date' | 'event' | 'select'; options?: string[] };
export type Role = { name: string; perms: string[] };
export type TenantCustom = {
  appName?: string; colour?: string; labels?: Record<string, string>; hidden?: string[];
  eventFields?: CustomField[]; customerFields?: CustomField[]; statuses?: string[];
  tools?: { id: string; name: string; icon: string; fields: ToolField[] }[];
  branches?: { id: string; name: string; city: string; manager: string }[];
  roles?: Role[];
  doc?: { quoteTitle?: string; invTitleGst?: string; invTitle?: string; prefix?: string; gstRate?: number; validDays?: number; words?: boolean; sign?: boolean };
};

export const tenants = pgTable('tenants', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  phone: text('phone').notNull().default(''),
  address: text('address').notNull().default(''),
  city: text('city').notNull().default(''),
  gstin: text('gstin').notNull().default(''),
  plan: text('plan').notNull().default('basic'),
  status: text('status').notNull().default('Active'),
  colour: text('colour').notNull().default('#111111'),
  logo: text('logo').notNull().default(''),
  docStyle: text('doc_style').notNull().default('classic'),
  terms: text('terms').notNull().default(''),
  services: jsonb('services').$type<Record<string, { on: boolean; price: number }>>().notNull().default({}),
  custom: jsonb('custom').$type<TenantCustom>().notNull().default({}),
  planChangedAt: timestamp('plan_changed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  passwordHash: text('password_hash'),
  googleSub: text('google_sub'),
  role: text('role').notNull().default('Owner'),
  phone: text('phone').notNull().default(''),
  active: boolean('active').notNull().default(true),
  platformAdmin: boolean('platform_admin').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const passwordResets = pgTable('password_resets', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  tokenHash: text('token_hash').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const customers = pgTable('customers', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  name: text('name').notNull(),
  phone: text('phone').notNull().default(''),
  email: text('email').notNull().default(''),
  city: text('city').notNull().default(''),
  custom: jsonb('custom').$type<Record<string, string>>().notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const quotations = pgTable('quotations', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  number: integer('number').notNull(),
  customerId: text('customer_id').notNull(),
  eventType: text('event_type').notNull(),
  eventTitle: text('event_title').notNull(),
  eventDate: date('event_date').notNull(),
  startTime: text('start_time').notNull().default(''),
  endTime: text('end_time').notNull().default(''),
  venue: text('venue').notNull().default(''),
  guests: integer('guests').notNull().default(0),
  notes: text('notes').notNull().default(''),
  items: jsonb('items').$type<LineItem[]>().notNull().default([]),
  discount: integer('discount').notNull().default(0),
  subtotal: integer('subtotal').notNull().default(0),
  total: integer('total').notNull().default(0),
  status: text('status').notNull().default('Draft'),
  publicToken: text('public_token').notNull(),
  validUntil: date('valid_until').notNull(),
  decidedAt: timestamp('decided_at', { withTimezone: true }),
  decidedBy: text('decided_by'),
  declineReason: text('decline_reason'),
  bookingId: text('booking_id'),
  gst: boolean('gst').notNull().default(false),
  gstRate: integer('gst_rate').notNull().default(18),
  tax: integer('tax').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const quotationEvents = pgTable('quotation_events', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  quotationId: text('quotation_id').notNull(),
  action: text('action').notNull(),
  actor: text('actor').notNull(),
  note: text('note').notNull().default(''),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const bookings = pgTable('bookings', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  number: integer('number').notNull(),
  quotationId: text('quotation_id'),
  customerId: text('customer_id').notNull(),
  title: text('title').notNull(),
  eventType: text('event_type').notNull(),
  eventDate: date('event_date').notNull(),
  startTime: text('start_time').notNull().default(''),
  endTime: text('end_time').notNull().default(''),
  venue: text('venue').notNull().default(''),
  guests: integer('guests').notNull().default(0),
  items: jsonb('items').$type<LineItem[]>().notNull().default([]),
  total: integer('total').notNull().default(0),
  notes: text('notes').notNull().default(''),
  crewNeeded: integer('crew_needed').notNull().default(0),
  status: text('status').notNull().default('Confirmed'),
  setupTime: text('setup_time').notNull().default(''),
  services: jsonb('services').$type<string[]>().notNull().default([]),
  branchId: text('branch_id'),
  custom: jsonb('custom').$type<Record<string, string>>().notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const staff = pgTable('staff', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  name: text('name').notNull(),
  phone: text('phone').notNull().default(''),
  kind: text('kind').notNull(),
  leaderId: text('leader_id'),
  dailyWage: integer('daily_wage').notNull().default(0),
  role: text('role').notNull().default(''),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const bookingCrew = pgTable('booking_crew', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  bookingId: text('booking_id').notNull(),
  staffId: text('staff_id').notNull(),
  present: boolean('present').notNull().default(false),
  wage: integer('wage').notNull().default(0),
});

export const staffPayments = pgTable('staff_payments', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  staffId: text('staff_id').notNull(),
  amount: integer('amount').notNull(),
  paidOn: date('paid_on').notNull(),
  note: text('note').notNull().default(''),
  bookingId: text('booking_id'),
  expenseId: text('expense_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const notifications = pgTable('notifications', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  bookingId: text('booking_id'),
  channel: text('channel').notNull().default('whatsapp'),
  kind: text('kind').notNull(),
  toPhone: text('to_phone').notNull(),
  body: text('body').notNull(),
  payload: jsonb('payload').$type<Record<string, unknown>>().notNull().default({}),
  status: text('status').notNull().default('queued'),
  attempts: integer('attempts').notNull().default(0),
  lastError: text('last_error'),
  providerMessageId: text('provider_message_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  sentAt: timestamp('sent_at', { withTimezone: true }),
});

export const upgradeRequests = pgTable('upgrade_requests', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  plan: text('plan').notNull(),
  note: text('note').notNull().default(''),
  status: text('status').notNull().default('Pending'),
  requestedBy: text('requested_by').notNull().default(''),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  decidedAt: timestamp('decided_at', { withTimezone: true }),
});

export const invoices = pgTable('invoices', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  fy: text('fy').notNull(),
  number: integer('number').notNull(),
  docNo: text('doc_no').notNull(),
  bookingId: text('booking_id'),
  quotationId: text('quotation_id'),
  customerId: text('customer_id').notNull(),
  issuedOn: date('issued_on').notNull(),
  items: jsonb('items').$type<LineItem[]>().notNull().default([]),
  discount: integer('discount').notNull().default(0),
  gst: boolean('gst').notNull().default(false),
  gstRate: integer('gst_rate').notNull().default(18),
  subtotal: integer('subtotal').notNull().default(0),
  tax: integer('tax').notNull().default(0),
  total: integer('total').notNull().default(0),
  notes: text('notes').notNull().default(''),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const invoicePayments = pgTable('invoice_payments', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  invoiceId: text('invoice_id').notNull(),
  amount: integer('amount').notNull(),
  kind: text('kind').notNull().default('Payment'),
  mode: text('mode').notNull().default('UPI'),
  paidOn: date('paid_on').notNull(),
  reference: text('reference').notNull().default(''),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const vendors = pgTable('vendors', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  name: text('name').notNull(),
  category: text('category').notNull().default(''),
  phone: text('phone').notNull().default(''),
  notes: text('notes').notNull().default(''),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const expenses = pgTable('expenses', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  bookingId: text('booking_id'),
  category: text('category').notNull().default('Other'),
  item: text('item').notNull(),
  amount: integer('amount').notNull(),
  spentOn: date('spent_on').notNull(),
  paidTo: text('paid_to').notNull().default(''),
  vendorId: text('vendor_id'),
  mode: text('mode').notNull().default('UPI'),
  bill: text('bill').notNull().default(''),
  source: text('source').notNull().default('manual'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const activityLog = pgTable('activity_log', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  who: text('who').notNull(),
  what: text('what').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const toolRows = pgTable('tool_rows', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  tool: text('tool').notNull(),
  coll: text('coll').notNull(),
  bookingId: text('booking_id'),
  data: jsonb('data').$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const toolSeeded = pgTable('tool_seeded', {
  tenantId: text('tenant_id').notNull(),
  tool: text('tool').notNull(),
});
