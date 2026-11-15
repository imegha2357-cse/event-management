/**
 * Service tools (catering, decoration, photo, entertainment, planning, makeup, invitations)
 * defined as data. Each tool has tabs; most tabs are a table of rows ("collection") with a form.
 * Rows live in the tool_rows table as JSON. Pure data: safe on server and client.
 */
import type { ToolField } from '@/db/schema';
import type { PlanKey } from './plans';

export type FieldType = 'text' | 'number' | 'date' | 'time' | 'select' | 'event' | 'multi' | 'rows';
export type FieldDef = {
  f: string; label: string; type?: FieldType; req?: boolean; ph?: string;
  opts?: string[];            // fixed choices for select
  ref?: { coll: string; label: string[] }; // choices from another collection: value = row id, label = these data fields joined
  def?: string | number;      // default value (or 'today', 'today+N')
};
export type ColKind =
  | { k: 'text'; f: string; sub?: string; bold?: boolean }
  | { k: 'num'; f: string; unit?: string }
  | { k: 'money'; f: string; bold?: boolean }
  | { k: 'date'; f: string; late?: { doneField: string; doneValue: string } }
  | { k: 'event' }
  | { k: 'ref'; f: string; coll: string; show: string }
  | { k: 'chip'; f: string }
  | { k: 'status'; f: string; opts: string[] }
  | { k: 'calc'; fn: string; money?: boolean; bold?: boolean };
export type Col = { h: string; c: ColKind; num?: boolean };
export type Tab = {
  key: string; label: string; plan?: PlanKey; needs?: string; special?: 'purchaseGen';
  coll?: string; noun?: string; add?: string; noAdd?: boolean; intro: string;
  sort?: 'event' | 'event-time' | 'due' | 'created-desc'; fields?: FieldDef[]; cols?: Col[];
  init?: Record<string, string | number>; // values set when a row is created
  toolbar?: 'checklist';
  rowAction?: 'purchase';
};
export type ToolDef = { key: string; label: string; icon: string; services: string[]; title: string; blurb: string; intro: string; tabs: Tab[]; custom?: boolean };

const o = (xs: string[]) => xs;
export const DELIV_STAGES = ['Planned', 'Shot', 'Backup done', 'Editing', 'Client review', 'Printing', 'Delivered'];
export const INVITE_STAGES = ['Design', 'Proof sent', 'Approved', 'Printing', 'Delivered'];
export const CHECKLIST: [string, number][] = [['Confirm venue booking and advance', -60], ['Fix muhurtham and event timings with the family', -45], ['Finalise menu and plate count', -30], ['Send invitations', -30], ['Makeup trial', -10], ['Confirm flowers, tent and sound vendors', -7], ['Share day-of timeline with the team', -3], ['Collect balance payment', -2], ['Arrange return gifts', -2], ['Hand over photos and settle vendors', 7]];

export const TOOLS: ToolDef[] = [
  { key: 'catering', label: 'Catering', icon: 'catering', services: ['catering'], title: 'Catering management', blurb: 'Recipes, ingredients, event menus and purchase lists',
    intro: 'Plan each event’s menu, then let the platform work out exactly how much rice, dal, oil and vegetables to buy from your recipes.',
    tabs: [
      { key: 'menus', label: 'Event menus', coll: 'menus', noun: 'Menu', add: '+ Plan a menu', sort: 'event', rowAction: 'purchase',
        intro: 'Choose the dishes and plate count for each event. Plate count 0 uses the event’s guest count.',
        cols: [{ h: 'Event', c: { k: 'event' } }, { h: 'Plates', c: { k: 'calc', fn: 'plates' }, num: true }, { h: 'Dishes', c: { k: 'calc', fn: 'dishNames' } },
          { h: 'Price / plate', c: { k: 'calc', fn: 'menuPrice', money: true }, num: true }, { h: 'Food cost / plate', c: { k: 'calc', fn: 'menuCost', money: true }, num: true },
          { h: 'Menu value', c: { k: 'calc', fn: 'menuValue', money: true, bold: true }, num: true }],
        fields: [{ f: 'eventId', label: 'Event', type: 'event', req: true }, { f: 'plates', label: 'Number of plates (0 = use guest count)', type: 'number', def: 0 },
          { f: 'dishes', label: 'Dishes', type: 'multi', req: true, ref: { coll: 'dishes', label: ['name'] } }] },
      { key: 'gen', label: 'Purchase generator', plan: 'pro', special: 'purchaseGen', intro: 'Pick an event menu to see exactly what to buy, worked out from your recipes. Save it as a purchase list for the kitchen.' },
      { key: 'plists', label: 'Purchase lists', plan: 'pro', coll: 'plists', noun: 'Purchase list', noAdd: true, sort: 'created-desc',
        intro: 'Saved shopping lists for the kitchen. Mark them as ordered or purchased as you go.',
        cols: [{ h: 'Event', c: { k: 'event' } }, { h: 'Created', c: { k: 'date', f: 'created' } }, { h: 'Items', c: { k: 'calc', fn: 'plistItems' }, num: true },
          { h: 'Estimated cost', c: { k: 'money', f: 'cost' }, num: true }, { h: 'Status', c: { k: 'status', f: 'status', opts: ['Pending', 'Ordered', 'Purchased'] } }] },
      { key: 'dishes', label: 'Recipe master', coll: 'dishes', noun: 'Dish', add: '+ Add dish',
        intro: 'Each dish with its ingredients for 100 plates. Food cost per plate is worked out from your ingredient rates.',
        cols: [{ h: 'Dish', c: { k: 'text', f: 'name', sub: 'cat', bold: true } }, { h: 'Type', c: { k: 'chip', f: 'type' } }, { h: 'Ingredients per 100 plates', c: { k: 'calc', fn: 'recipeText' } },
          { h: 'Food cost / plate', c: { k: 'calc', fn: 'dishCost', money: true }, num: true }, { h: 'Selling price / plate', c: { k: 'money', f: 'price', bold: true }, num: true }],
        fields: [{ f: 'name', label: 'Dish name', req: true, ph: 'e.g. Vegetable kurma' }, { f: 'cat', label: 'Category', type: 'select', opts: o(['Starter', 'Rice', 'Curry', 'Side', 'Dessert', 'Serving', 'Breakfast', 'Snacks']) },
          { f: 'type', label: 'Veg or non-veg', type: 'select', opts: o(['Veg', 'Non-veg']) }, { f: 'price', label: 'Selling price per plate (₹)', type: 'number', req: true },
          { f: 'recipe', label: 'Ingredients for 100 plates', type: 'rows', ref: { coll: 'ingredients', label: ['name', 'unit'] } }] },
      { key: 'ingredients', label: 'Ingredient master', coll: 'ingredients', noun: 'Ingredient', add: '+ Add ingredient',
        intro: 'Everything your kitchen buys, with today’s rate. Update rates here and every food cost updates with them.',
        cols: [{ h: 'Ingredient', c: { k: 'text', f: 'name', bold: true } }, { h: 'Category', c: { k: 'text', f: 'cat' } }, { h: 'Unit', c: { k: 'text', f: 'unit' } },
          { h: 'Rate', c: { k: 'calc', fn: 'rateUnit' }, num: true }, { h: 'Used in', c: { k: 'calc', fn: 'usedIn' }, num: true }],
        fields: [{ f: 'name', label: 'Ingredient', req: true, ph: 'e.g. Green peas' }, { f: 'cat', label: 'Category', type: 'select', opts: o(['Grocery', 'Vegetables', 'Dairy', 'Meat', 'Spices', 'Disposables']) },
          { f: 'unit', label: 'Unit', type: 'select', opts: o(['kg', 'litre', 'nos', 'packet', 'bundle']) }, { f: 'rate', label: 'Rate per unit (₹)', type: 'number', req: true }] },
    ] },
  { key: 'decor', label: 'Decoration', icon: 'decor', services: ['stage', 'floral', 'venue'], title: 'Decoration studio', blurb: 'Design catalogue, stock, event setups and flower orders',
    intro: 'Keep your stage designs and decoration stock in one place, plan each event’s setup, and get warned before the same items are promised to two events on one day.',
    tabs: [
      { key: 'plans', label: 'Event setups', coll: 'plans', noun: 'Setup', add: '+ Plan a setup', sort: 'event', init: { status: 'Planned' },
        intro: 'Which design goes to which event, who leads the setup, and which stock items are taken.',
        cols: [{ h: 'Event', c: { k: 'event' } }, { h: 'Design', c: { k: 'ref', f: 'design', coll: 'designs', show: 'name' } }, { h: 'Setup', c: { k: 'calc', fn: 'setupWhen' } },
          { h: 'Team lead', c: { k: 'text', f: 'lead' } }, { h: 'Items taken', c: { k: 'calc', fn: 'itemsTaken' } }, { h: 'Status', c: { k: 'status', f: 'status', opts: ['Planned', 'Setting up', 'Done', 'Dismantled'] } }],
        fields: [{ f: 'eventId', label: 'Event', type: 'event', req: true }, { f: 'design', label: 'Design', type: 'select', ref: { coll: 'designs', label: ['name'] } },
          { f: 'setupDate', label: 'Setup date', type: 'date', def: 'today' }, { f: 'setupTime', label: 'Setup time', type: 'time', def: '18:00' }, { f: 'lead', label: 'Team lead', ph: 'e.g. Benny' },
          { f: 'items', label: 'Stock items to take', type: 'rows', ref: { coll: 'items', label: ['name', 'unit'] } }] },
      { key: 'designs', label: 'Design catalogue', coll: 'designs', noun: 'Design', add: '+ Add design',
        intro: 'Your ready designs with what they include and their price. Show these to customers when they choose a look.',
        cols: [{ h: 'Design', c: { k: 'text', f: 'name', sub: 'includes', bold: true } }, { h: 'Theme', c: { k: 'chip', f: 'theme' } }, { h: 'Used for', c: { k: 'text', f: 'use' } }, { h: 'Price', c: { k: 'money', f: 'price', bold: true }, num: true }],
        fields: [{ f: 'name', label: 'Design name', req: true, ph: 'e.g. Peacock theme mandapam' }, { f: 'theme', label: 'Theme', type: 'select', opts: o(['Traditional', 'Floral', 'Royal', 'Modern', 'Kids']) },
          { f: 'use', label: 'Used for', type: 'select', opts: o(['Stage', 'Entrance', 'Mandapam', 'Hall', 'Car', 'Table']) }, { f: 'price', label: 'Price (₹)', type: 'number', req: true },
          { f: 'includes', label: 'What it includes', ph: 'e.g. Peacock backdrop, brass lamps, jasmine strings' }] },
      { key: 'items', label: 'Stock and items', plan: 'pro', coll: 'items', noun: 'Item', add: '+ Add item',
        intro: 'What you own. “Booked” counts items taken by setups for upcoming events.',
        cols: [{ h: 'Item', c: { k: 'text', f: 'name', bold: true } }, { h: 'Category', c: { k: 'text', f: 'cat' } }, { h: 'In stock', c: { k: 'num', f: 'stock', unit: 'unit' }, num: true }, { h: 'Booked for upcoming', c: { k: 'calc', fn: 'bookedUpcoming' }, num: true }],
        fields: [{ f: 'name', label: 'Item', req: true, ph: 'e.g. Pillar candle stands' }, { f: 'cat', label: 'Category', type: 'select', opts: o(['Backdrop', 'Furniture', 'Props', 'Lights', 'Fabric', 'Flowers (artificial)']) },
          { f: 'stock', label: 'Quantity owned', type: 'number', req: true }, { f: 'unit', label: 'Unit', type: 'select', opts: o(['nos', 'sets', 'metres', 'kg']) }] },
      { key: 'flowers', label: 'Flower orders', needs: 'floral', plan: 'pro', coll: 'flowers', noun: 'Flower order', add: '+ Add flower order', sort: 'event', init: { status: 'To order' },
        intro: 'Fresh flowers to order for each event, from which vendor, and by when.',
        cols: [{ h: 'Event', c: { k: 'event' } }, { h: 'Flower', c: { k: 'text', f: 'flower', bold: true } }, { h: 'Quantity', c: { k: 'num', f: 'qty', unit: 'unit' }, num: true }, { h: 'Vendor', c: { k: 'text', f: 'vendor' } },
          { h: 'Needed by', c: { k: 'date', f: 'needBy' } }, { h: 'Status', c: { k: 'status', f: 'status', opts: ['To order', 'Ordered', 'Received'] } }],
        fields: [{ f: 'eventId', label: 'Event', type: 'event', req: true }, { f: 'flower', label: 'Flower', type: 'select', opts: o(['Jasmine (malli)', 'Rose', 'Marigold', 'Lotus', 'Orchid', 'Tuberose (sampangi)', 'Arali', 'Mixed garlands']) },
          { f: 'qty', label: 'Quantity', type: 'number', req: true }, { f: 'unit', label: 'Unit', type: 'select', opts: o(['kg', 'mozham (strings)', 'bunches', 'garlands', 'nos']) },
          { f: 'vendor', label: 'Vendor', ph: 'e.g. Thovalai market' }, { f: 'needBy', label: 'Needed by', type: 'date', def: 'today' }] },
    ] },
  { key: 'photo', label: 'Photo and video', icon: 'photo', services: ['photography', 'videography', 'editing'], title: 'Photo and video studio', blurb: 'Packages, shoot schedule and delivery tracking',
    intro: 'Sell clear packages, schedule each shoot, and track every album and video until it reaches the customer.',
    tabs: [
      { key: 'shoots', label: 'Shoot schedule', coll: 'shoots', noun: 'Shoot', add: '+ Schedule a shoot', sort: 'event', init: { status: 'Planned' },
        intro: 'Who shoots which event, what time they report, and what coverage was promised.',
        cols: [{ h: 'Event', c: { k: 'event' } }, { h: 'Report at', c: { k: 'text', f: 'call' } }, { h: 'Crew', c: { k: 'text', f: 'crew' } }, { h: 'Coverage', c: { k: 'text', f: 'coverage' } },
          { h: 'Package', c: { k: 'ref', f: 'pkg', coll: 'packages', show: 'name' } }, { h: 'Status', c: { k: 'status', f: 'status', opts: ['Planned', 'Crew confirmed', 'Shot'] } }],
        fields: [{ f: 'eventId', label: 'Event', type: 'event', req: true }, { f: 'pkg', label: 'Package', type: 'select', ref: { coll: 'packages', label: ['name'] } },
          { f: 'call', label: 'Report time', type: 'time', def: '06:00' }, { f: 'crew', label: 'Crew', ph: 'e.g. Ajith + 2 assistants' },
          { f: 'coverage', label: 'Coverage', type: 'select', opts: o(['Traditional', 'Candid', 'Traditional and candid', 'Candid and drone', 'Traditional, candid and drone', 'Video only']) }] },
      { key: 'deliv', label: 'Deliverables', plan: 'pro', coll: 'deliv', noun: 'Deliverable', add: '+ Add deliverable', sort: 'event', init: { stage: 'Planned' },
        intro: 'Track each album and video from shoot to hand-over, so no customer has to chase you.',
        cols: [{ h: 'Event', c: { k: 'event' } }, { h: 'Item', c: { k: 'text', f: 'item', bold: true } }, { h: 'Due', c: { k: 'date', f: 'due', late: { doneField: 'stage', doneValue: 'Delivered' } } },
          { h: 'Progress', c: { k: 'calc', fn: 'delivProgress' } }, { h: 'Stage', c: { k: 'status', f: 'stage', opts: DELIV_STAGES } }],
        fields: [{ f: 'eventId', label: 'Event', type: 'event', req: true }, { f: 'item', label: 'Item', type: 'select', opts: o(['Edited photos', 'Wedding album', 'Highlight video', 'Full-length video', 'Raw footage backup', 'Pre-wedding shoot']) },
          { f: 'due', label: 'Due date', type: 'date', def: 'today+30' }] },
      { key: 'packages', label: 'Packages', coll: 'packages', noun: 'Package', add: '+ Add package', intro: 'Your photo and video packages with what each includes.',
        cols: [{ h: 'Package', c: { k: 'text', f: 'name', bold: true } }, { h: 'Includes', c: { k: 'text', f: 'includes' } }, { h: 'Price', c: { k: 'money', f: 'price', bold: true }, num: true }],
        fields: [{ f: 'name', label: 'Package name', req: true, ph: 'e.g. Diamond' }, { f: 'price', label: 'Price (₹)', type: 'number', req: true }, { f: 'includes', label: 'What it includes', ph: 'e.g. 3 days, drone, 2 albums' }] },
    ] },
  { key: 'ent', label: 'Entertainment and sound', icon: 'ent', services: ['dj', 'entertainment', 'dance', 'lighting'], title: 'Entertainment and sound', blurb: 'Equipment, artists and show run sheets',
    intro: 'Know what equipment you have, which artists you can call, and run every show minute by minute.',
    tabs: [
      { key: 'runsheet', label: 'Show run sheet', plan: 'pro', coll: 'runsheet', noun: 'Run sheet item', add: '+ Add to run sheet', sort: 'event-time',
        intro: 'The order of the show for each event, so the DJ, dancers and anchor all know their cue.',
        cols: [{ h: 'Event', c: { k: 'event' } }, { h: 'Time', c: { k: 'text', f: 'time', bold: true } }, { h: 'Segment', c: { k: 'text', f: 'segment' } }, { h: 'Artist', c: { k: 'ref', f: 'artist', coll: 'artists', show: 'name' } }, { h: 'Notes', c: { k: 'text', f: 'notes' } }],
        fields: [{ f: 'eventId', label: 'Event', type: 'event', req: true }, { f: 'time', label: 'Time', type: 'time', def: '19:00' },
          { f: 'segment', label: 'Segment', type: 'select', opts: o(['Guest arrival music', 'Couple entry', 'Cake cutting', 'Dance performance', 'Awards', 'DJ night', 'Anchor games', 'Live band']) },
          { f: 'artist', label: 'Artist', type: 'select', ref: { coll: 'artists', label: ['name', 'act'] } }, { f: 'notes', label: 'Notes', ph: 'e.g. Play “Vaathi coming” for entry' }] },
      { key: 'equip', label: 'Equipment', coll: 'equip', noun: 'Equipment', add: '+ Add equipment', init: { cond: 'Good' },
        intro: 'Your speakers, consoles and lights, and which ones need attention before the next show.',
        cols: [{ h: 'Equipment', c: { k: 'text', f: 'name', bold: true } }, { h: 'Type', c: { k: 'text', f: 'type' } }, { h: 'Quantity', c: { k: 'num', f: 'qty' }, num: true }, { h: 'Condition', c: { k: 'status', f: 'cond', opts: ['Good', 'Needs repair', 'Out on rent'] } }],
        fields: [{ f: 'name', label: 'Equipment', req: true, ph: 'e.g. Wireless mics' }, { f: 'type', label: 'Type', type: 'select', opts: o(['Speaker', 'Mixer', 'Microphone', 'Lights', 'LED wall', 'Effects', 'Truss', 'Generator']) },
          { f: 'qty', label: 'Quantity', type: 'number', req: true }] },
      { key: 'artists', label: 'Artists and crew', coll: 'artists', noun: 'Artist', add: '+ Add artist', intro: 'DJs, dancers, singers and anchors you work with, with their usual fee.',
        cols: [{ h: 'Name', c: { k: 'text', f: 'name', bold: true } }, { h: 'Act', c: { k: 'text', f: 'act' } }, { h: 'Phone', c: { k: 'text', f: 'phone' } }, { h: 'Usual fee', c: { k: 'money', f: 'fee' }, num: true }],
        fields: [{ f: 'name', label: 'Name', req: true }, { f: 'act', label: 'Act', type: 'select', opts: o(['DJ', 'Dance troupe', 'Singer', 'Live band', 'Anchor / emcee', 'Magician', 'Chenda melam', 'Nadaswaram']) },
          { f: 'fee', label: 'Usual fee (₹)', type: 'number' }, { f: 'phone', label: 'Phone' }] },
    ] },
  { key: 'planning', label: 'Planning', icon: 'planning', services: ['wedding', 'coordination'], title: 'Event planning', blurb: 'Checklists and day-of timelines',
    intro: 'A to-do list for every event and a minute-by-minute plan for the day itself.',
    tabs: [
      { key: 'tasks', label: 'Checklist', coll: 'tasks', noun: 'Task', add: '+ Add task', sort: 'due', init: { status: 'To do' }, toolbar: 'checklist',
        intro: 'Use “Add standard checklist” to load the usual wedding tasks for an event, with due dates counted back from the event day.',
        cols: [{ h: 'Task', c: { k: 'text', f: 'task', bold: true } }, { h: 'Event', c: { k: 'event' } }, { h: 'Owner', c: { k: 'text', f: 'owner' } },
          { h: 'Due', c: { k: 'date', f: 'due', late: { doneField: 'status', doneValue: 'Done' } } }, { h: 'Status', c: { k: 'status', f: 'status', opts: ['To do', 'Doing', 'Done'] } }],
        fields: [{ f: 'eventId', label: 'Event', type: 'event', req: true }, { f: 'task', label: 'Task', req: true, ph: 'e.g. Book nadaswaram troupe' }, { f: 'owner', label: 'Who does it', ph: 'e.g. Sahaya Mary' },
          { f: 'due', label: 'Due date', type: 'date', def: 'today+7' }] },
      { key: 'timeline', label: 'Day-of timeline', plan: 'pro', coll: 'timeline', noun: 'Timeline entry', add: '+ Add entry', sort: 'event-time',
        intro: 'What happens when on the event day, and who is responsible.',
        cols: [{ h: 'Event', c: { k: 'event' } }, { h: 'Time', c: { k: 'text', f: 'time', bold: true } }, { h: 'Activity', c: { k: 'text', f: 'activity' } }, { h: 'Responsible', c: { k: 'text', f: 'who' } }],
        fields: [{ f: 'eventId', label: 'Event', type: 'event', req: true }, { f: 'time', label: 'Time', type: 'time', def: '09:00' }, { f: 'activity', label: 'Activity', req: true, ph: 'e.g. Muhurtham' }, { f: 'who', label: 'Responsible', ph: 'e.g. Priest and family' }] },
    ] },
  { key: 'makeup', label: 'Makeup and styling', icon: 'makeup', services: ['makeup'], title: 'Makeup and styling', blurb: 'Bookings, trials and looks',
    intro: 'Every bride, groom and family booking with its look, artist, trial date and time slot.',
    tabs: [
      { key: 'bookings', label: 'Bookings', coll: 'bookings', noun: 'Booking', add: '+ Add booking', sort: 'event-time', init: { status: 'Confirmed' },
        intro: 'Plan start times backwards from the muhurtham so everyone is ready on time.',
        cols: [{ h: 'Event', c: { k: 'event' } }, { h: 'For', c: { k: 'text', f: 'person', bold: true } }, { h: 'Look', c: { k: 'ref', f: 'look', coll: 'looks', show: 'name' } }, { h: 'Start', c: { k: 'text', f: 'time', bold: true } },
          { h: 'Artist', c: { k: 'text', f: 'artist' } }, { h: 'Trial', c: { k: 'date', f: 'trial' } }, { h: 'Status', c: { k: 'status', f: 'status', opts: ['Enquiry', 'Confirmed', 'Trial done', 'Completed'] } }],
        fields: [{ f: 'eventId', label: 'Event', type: 'event', req: true }, { f: 'person', label: 'For whom', req: true, ph: 'e.g. Bride (Divya)' }, { f: 'look', label: 'Look', type: 'select', ref: { coll: 'looks', label: ['name'] } },
          { f: 'time', label: 'Start time', type: 'time', def: '05:00' }, { f: 'artist', label: 'Artist', ph: 'e.g. Nisha' }, { f: 'trial', label: 'Trial date', type: 'date' }] },
      { key: 'looks', label: 'Looks and prices', coll: 'looks', noun: 'Look', add: '+ Add look', intro: 'The makeup looks you offer, how long they take and their price.',
        cols: [{ h: 'Look', c: { k: 'text', f: 'name', bold: true } }, { h: 'Takes', c: { k: 'text', f: 'mins' } }, { h: 'Price', c: { k: 'money', f: 'price', bold: true }, num: true }],
        fields: [{ f: 'name', label: 'Look', req: true, ph: 'e.g. Mehendi day look' }, { f: 'mins', label: 'Takes', ph: 'e.g. 90 minutes' }, { f: 'price', label: 'Price (₹)', type: 'number', req: true }] },
    ] },
  { key: 'invite', label: 'Invitations', icon: 'invite', services: ['invitation'], title: 'Invitation design', blurb: 'Card catalogue and print orders',
    intro: 'Show customers your card designs and follow each order from first design to delivery.',
    tabs: [
      { key: 'orders', label: 'Orders', coll: 'orders', noun: 'Order', add: '+ Add order', sort: 'event', init: { stage: 'Design' },
        intro: 'Each invitation order with its design, quantity, language and current stage.',
        cols: [{ h: 'Event', c: { k: 'event' } }, { h: 'Design', c: { k: 'ref', f: 'card', coll: 'cards', show: 'name' } }, { h: 'Quantity', c: { k: 'num', f: 'qty' }, num: true }, { h: 'Language', c: { k: 'text', f: 'lang' } },
          { h: 'Value', c: { k: 'calc', fn: 'orderValue', money: true }, num: true }, { h: 'Due', c: { k: 'date', f: 'due' } }, { h: 'Stage', c: { k: 'status', f: 'stage', opts: INVITE_STAGES } }],
        fields: [{ f: 'eventId', label: 'Event', type: 'event', req: true }, { f: 'card', label: 'Design', type: 'select', ref: { coll: 'cards', label: ['name'] } }, { f: 'qty', label: 'Quantity', type: 'number', req: true },
          { f: 'lang', label: 'Language', type: 'select', opts: o(['Tamil', 'English', 'Tamil and English', 'Malayalam']) }, { f: 'due', label: 'Needed by', type: 'date', def: 'today+21' }] },
      { key: 'cards', label: 'Card catalogue', coll: 'cards', noun: 'Design', add: '+ Add design', intro: 'Your invitation designs and price per card. Digital invites are priced per design.',
        cols: [{ h: 'Design', c: { k: 'text', f: 'name', bold: true } }, { h: 'Style', c: { k: 'chip', f: 'style' } }, { h: 'Price', c: { k: 'calc', fn: 'cardPrice' }, num: true }],
        fields: [{ f: 'name', label: 'Design name', req: true }, { f: 'style', label: 'Style', type: 'select', opts: o(['Traditional', 'Laser cut', 'Scroll', 'Box invite', 'Digital']) }, { f: 'price', label: 'Price (₹)', type: 'number', req: true }] },
    ] },
];

/** A tool built by an Enterprise company in Customize. */
export function customToolDef(t: { id: string; name: string; icon: string; fields: ToolField[] }): ToolDef {
  const fields: FieldDef[] = t.fields.map((f, i) => ({ f: f.id, label: f.label, type: f.type === 'text' ? 'text' : f.type, opts: f.options, req: i === 0 && f.type !== 'select' }));
  const cols: Col[] = t.fields.map(f => f.type === 'event' ? { h: f.label, c: { k: 'event' } } : f.type === 'date' ? { h: f.label, c: { k: 'date', f: f.id } }
    : f.type === 'number' ? { h: f.label, c: { k: 'num', f: f.id }, num: true } : f.type === 'select' ? { h: f.label, c: { k: 'chip', f: f.id } } : { h: f.label, c: { k: 'text', f: f.id } });
  return { key: 'ct_' + t.id, custom: true, label: t.name, icon: t.icon || 'wand', services: [], title: t.name, blurb: 'Your own tool', intro: 'A tool you built in Customize.',
    tabs: [{ key: 'rows', label: 'All entries', coll: 'rows', noun: 'Entry', add: '+ Add entry', sort: t.fields.some(f => f.type === 'event') ? 'event' : 'created-desc', intro: '', fields, cols }] };
}

/** Starter rows for a tool, loaded the first time a company opens it. Ids are local; they are re-mapped when saved. */
type Seed = Record<string, Record<string, unknown>[]>;
const ING: [string, string, string, string, number][] = [
  ['g1', 'Ponni rice', 'Grocery', 'kg', 58], ['g2', 'Toor dal', 'Grocery', 'kg', 140], ['g3', 'Sunflower oil', 'Grocery', 'litre', 160], ['g4', 'Ghee', 'Dairy', 'kg', 620],
  ['g5', 'Onion', 'Vegetables', 'kg', 35], ['g6', 'Tomato', 'Vegetables', 'kg', 30], ['g7', 'Mixed vegetables', 'Vegetables', 'kg', 45], ['g8', 'Coconut', 'Vegetables', 'nos', 30],
  ['g9', 'Milk', 'Dairy', 'litre', 56], ['g10', 'Sugar', 'Grocery', 'kg', 44], ['g11', 'Semiya (500 g pack)', 'Grocery', 'packet', 40], ['g12', 'Paneer', 'Dairy', 'kg', 360],
  ['g13', 'Chicken', 'Meat', 'kg', 240], ['g14', 'Mutton', 'Meat', 'kg', 780], ['g15', 'Masala and spices', 'Spices', 'kg', 400], ['g16', 'Banana leaf', 'Disposables', 'nos', 3],
  ['g17', 'Curd', 'Dairy', 'litre', 60], ['g18', 'Cashew nuts', 'Grocery', 'kg', 900], ['g19', 'Basmati rice', 'Grocery', 'kg', 110], ['g20', 'Urad dal', 'Grocery', 'kg', 130],
  ['g21', 'Appalam (pack of 50)', 'Grocery', 'packet', 90], ['g22', 'Rava', 'Grocery', 'kg', 50],
];
const DISHES: [string, string, string, string, number, [string, number][]][] = [
  ['d1', 'Banana leaf service', 'Serving', 'Veg', 5, [['g16', 105]]], ['d2', 'White rice', 'Rice', 'Veg', 30, [['g1', 12]]],
  ['d3', 'Sambar', 'Curry', 'Veg', 40, [['g2', 4], ['g7', 6], ['g6', 2], ['g15', 0.5], ['g3', 1]]], ['d4', 'Rasam', 'Curry', 'Veg', 20, [['g2', 1], ['g6', 3], ['g15', 0.3]]],
  ['d5', 'Poriyal (beans and carrot)', 'Side', 'Veg', 35, [['g7', 8], ['g8', 8], ['g3', 1]]], ['d6', 'Kootu', 'Side', 'Veg', 35, [['g7', 5], ['g2', 1.5], ['g8', 10]]],
  ['d7', 'Veg biryani', 'Rice', 'Veg', 110, [['g19', 10], ['g7', 6], ['g3', 2], ['g4', 1], ['g15', 0.8]]], ['d8', 'Chicken biryani', 'Rice', 'Non-veg', 220, [['g19', 10], ['g13', 15], ['g3', 3], ['g15', 1], ['g17', 3]]],
  ['d9', 'Paneer butter masala', 'Curry', 'Veg', 90, [['g12', 6], ['g6', 4], ['g5', 4], ['g18', 0.5], ['g3', 1.5]]], ['d10', 'Mutton chukka', 'Starter', 'Non-veg', 260, [['g14', 12], ['g5', 4], ['g15', 0.8], ['g3', 2]]],
  ['d11', 'Semiya payasam', 'Dessert', 'Veg', 45, [['g11', 6], ['g9', 15], ['g10', 4], ['g18', 0.3], ['g4', 0.5]]], ['d12', 'Curd', 'Side', 'Veg', 15, [['g17', 8]]],
  ['d13', 'Medhu vadai', 'Starter', 'Veg', 25, [['g20', 5], ['g3', 4], ['g5', 1]]], ['d14', 'Appalam', 'Side', 'Veg', 8, [['g21', 2.2]]], ['d15', 'Rava kesari', 'Dessert', 'Veg', 30, [['g22', 5], ['g10', 5], ['g4', 1.5], ['g18', 0.3]]],
];
export function starterFor(key: string): Seed {
  switch (key) {
    case 'catering': return {
      ingredients: ING.map(([id, name, cat, unit, rate]) => ({ id, name, cat, unit, rate })),
      dishes: DISHES.map(([id, name, cat, type, price, recipe]) => ({ id, name, cat, type, price, recipe: recipe.map(([ref, qty]) => ({ ref, qty })) })) };
    case 'decor': return {
      designs: [
        { id: 'ds1', name: 'Kalyana mandapam traditional stage', theme: 'Traditional', use: 'Stage', price: 85000, includes: 'Banana trees, kolam backdrop, brass lamps, marigold strings' },
        { id: 'ds2', name: 'Pastel floral reception stage', theme: 'Floral', use: 'Stage', price: 120000, includes: 'Pastel roses, orchid arch, fairy lights, white sofa' },
        { id: 'ds3', name: 'Grand entrance arch', theme: 'Royal', use: 'Entrance', price: 35000, includes: 'Floral arch, welcome board, lamp stands' },
        { id: 'ds4', name: 'Wedding car decoration', theme: 'Floral', use: 'Car', price: 6000, includes: 'Roses, ribbons and name board' },
        { id: 'ds5', name: 'Kids birthday balloon theme', theme: 'Kids', use: 'Hall', price: 18000, includes: 'Balloon arch, cut-outs, printed backdrop' }],
      items: [
        { id: 'i1', name: 'Backdrop frames (10 x 8 ft)', cat: 'Backdrop', stock: 6, unit: 'nos' }, { id: 'i2', name: 'Royal sofa set', cat: 'Furniture', stock: 4, unit: 'sets' },
        { id: 'i3', name: 'Brass kuthu vilakku', cat: 'Props', stock: 20, unit: 'nos' }, { id: 'i4', name: 'Fairy light strings', cat: 'Lights', stock: 150, unit: 'nos' },
        { id: 'i5', name: 'White draping cloth', cat: 'Fabric', stock: 400, unit: 'metres' }, { id: 'i6', name: 'Chiavari chairs', cat: 'Furniture', stock: 300, unit: 'nos' }] };
    case 'photo': return { packages: [
      { id: 'pk1', name: 'Silver', includes: '1 photographer, 1 day, 300 edited photos', price: 35000 },
      { id: 'pk2', name: 'Gold', includes: 'Candid + traditional, 2 days, 40-page album', price: 85000 },
      { id: 'pk3', name: 'Platinum', includes: 'Candid, traditional, drone, highlight film, 2 albums', price: 160000 }] };
    case 'ent': return {
      equip: [
        { id: 'q1', name: 'Line array speakers', type: 'Speaker', qty: 8, cond: 'Good' }, { id: 'q2', name: 'Pioneer DJ console', type: 'Mixer', qty: 2, cond: 'Good' },
        { id: 'q3', name: 'Moving head lights', type: 'Lights', qty: 16, cond: 'Good' }, { id: 'q4', name: 'LED wall (10 x 8 ft)', type: 'LED wall', qty: 2, cond: 'Good' },
        { id: 'q5', name: 'Fog machine', type: 'Effects', qty: 2, cond: 'Needs repair' }, { id: 'q6', name: 'Truss set', type: 'Truss', qty: 4, cond: 'Good' }],
      artists: [
        { id: 'a1', name: 'DJ Vicky', act: 'DJ', fee: 40000, phone: '98410 77001' }, { id: 'a2', name: 'Rhythm Crew', act: 'Dance troupe', fee: 30000, phone: '99620 77002' },
        { id: 'a3', name: 'Priya (anchor)', act: 'Anchor / emcee', fee: 15000, phone: '90030 77003' }] };
    case 'makeup': return { looks: [
      { id: 'l1', name: 'Traditional bridal', mins: '3 hours', price: 15000 }, { id: 'l2', name: 'HD reception look', mins: '2 hours', price: 12000 },
      { id: 'l3', name: 'Airbrush bridal', mins: '3 hours', price: 25000 }, { id: 'l4', name: 'Family member makeup', mins: '45 minutes', price: 3000 }] };
    case 'invite': return { cards: [
      { id: 'k1', name: 'Traditional gold foil', style: 'Traditional', price: 45 }, { id: 'k2', name: 'Laser-cut floral', style: 'Laser cut', price: 85 },
      { id: 'k3', name: 'Scroll invitation', style: 'Scroll', price: 120 }, { id: 'k4', name: 'WhatsApp video invite', style: 'Digital', price: 2500 }] };
  }
  return {};
}

/** Tools a company gets: those matching the services it offers, plus its own (Enterprise). */
export function toolsFor(services: { key: string; on: boolean }[], customTools: { id: string; name: string; icon: string; fields: ToolField[] }[] = [], enterprise = false): ToolDef[] {
  const on = new Set(services.filter(s => s.on).map(s => s.key));
  return [...TOOLS.filter(t => t.services.some(k => on.has(k))), ...(enterprise ? customTools.map(customToolDef) : [])];
}
