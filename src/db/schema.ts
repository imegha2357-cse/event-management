import { pgTable, text, integer, jsonb, timestamp, date, boolean } from 'drizzle-orm/pg-core';

export type LineItem = { desc: string; qty: number; rate: number };

export const tenants = pgTable('tenants', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  phone: text('phone').notNull().default(''),
  address: text('address').notNull().default(''),
  city: text('city').notNull().default(''),
  gstin: text('gstin').notNull().default(''),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  passwordHash: text('password_hash'),
  googleSub: text('google_sub'),
  role: text('role').notNull().default('owner'),
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
