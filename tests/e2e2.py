"""End-to-end test for EventDesk v2 (plans, admin, invoices, finance, tools, team, customize).
Needs: app on :3100 (production build, EVENTDESK_TEST=1), mock WhatsApp on :3999, local Postgres on :5433."""
import base64, json, re, subprocess, sys, time, urllib.request
from datetime import date, timedelta
from playwright.sync_api import sync_playwright

BASE = "http://localhost:3100"; MOCK = "http://127.0.0.1:3999"
results, console_errors = [], []

def mock(path, data=None):
    req = urllib.request.Request(MOCK + path, data=(data.encode() if data is not None else None), method="POST" if data is not None else "GET")
    return json.loads(urllib.request.urlopen(req).read() or b"null")
def sql(q):
    r = subprocess.run(["psql", "-h", "localhost", "-p", "5433", "-U", "postgres", "-d", "eventdesk", "-tAc", q], capture_output=True, text=True)
    if r.returncode: raise RuntimeError(r.stderr)
    return r.stdout.strip()
def check(name, cond, show=None):
    results.append((name, bool(cond))); print(("PASS " if cond else "FAIL ") + name)
    if not cond and show is not None: print("   >>", str(show)[:600].replace("\n", " | "))
def wait_url(pg, pat, timeout=20000):
    end = time.time() + timeout / 1000
    while time.time() < end:
        if pat.search(pg.url): pg.wait_for_load_state("networkidle"); pg.wait_for_timeout(300); return
        pg.wait_for_timeout(150)
    raise AssertionError(f"URL {pg.url} did not match {pat.pattern}\n{pg.inner_text('body')[:500]}")
def go(pg, url):
    pg.goto(BASE + url); pg.wait_for_selector("html[data-hydrated]", state="attached", timeout=20000); pg.wait_for_load_state("networkidle")
def settle(pg): pg.wait_for_load_state("networkidle"); pg.wait_for_timeout(500)
def signup(pg, name, company, email, city="Salem"):
    go(pg, "/signup"); pg.fill("#name", name); pg.fill("#company", company); pg.fill("#email", email); pg.fill("#password", "Secret123")
    pg.click("button:has-text('Create account')"); wait_url(pg, re.compile(r"/onboarding"))
    pg.fill("#phone", "9876500000"); pg.fill("#city", city); pg.click("button:has-text('Save and continue')"); wait_url(pg, re.compile(r"/dashboard"))
def pick(pg, sel, startswith):
    opts = pg.locator(f"{sel} option").all_inner_texts()
    pg.select_option(sel, label=[o for o in opts if o.startswith(startswith)][0])

future = (date.today() + timedelta(days=20)).isoformat()
stamp = int(time.time())
CO = f"Sri Lakshmi Events {stamp % 100000}"; BCO = f"Babu Caterers {stamp % 100000}"
A = f"owner{stamp}@example.com"; Bm = f"basic{stamp}@example.com"; ACC = f"accounts{stamp}@example.com"
png = "/tmp/bill.png"
open(png, "wb").write(base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAAEklEQVR4nGP8z4AATAxkcQAAWQABA8Iw2wAAAABJRU5ErkJggg=="))

with sync_playwright() as p:
    br = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
    def newp():
        x = br.new_context(viewport={"width": 1366, "height": 900}).new_page()
        x.on("console", lambda m: console_errors.append(x.url + " :: " + m.text[:160]) if m.type == "error" and "favicon" not in m.text and "404" not in m.text else None)
        x.on("dialog", lambda d: d.accept())
        x.on("pageerror", lambda e: console_errors.append(x.url + " :: " + str(e)[:160]))
        return x
    page = newp()

    # ---------- Basic plan: locked features, upgrade request ----------
    signup(page, "Meena Raj", CO, A)
    check("new company starts on Basic", "Basic plan" in page.inner_text(".side-brand"))
    check("sidebar has exactly 10 main items", page.locator(".side nav a.navlink").count() == 10)
    check("Finance shows Pro lock in sidebar", "Pro" in page.locator(".navlink:has-text('Finance')").inner_text())
    go(page, "/finance")
    check("Finance locked page with pitch", page.locator("text=Finance comes with the").is_visible() and page.locator("text=Record advances").is_visible())
    page.click("button:has-text('Request upgrade to Pro')"); page.wait_for_selector("text=Request sent")
    check("upgrade request sent", True)
    go(page, "/staff"); check("Staff locked on Basic", page.locator("text=Request upgrade to Pro").is_visible())
    go(page, "/admin"); check("admin panel hidden from normal users", "Page not found" in page.inner_text("body"))

    # ---------- Platform admin approves the upgrade ----------
    sql(f"update users set platform_admin = true where email = '{A}'")
    go(page, "/admin")
    check("admin panel visible to platform admin", page.locator("h1:has-text('Admin panel')").is_visible())
    req = page.locator(f"tr:has-text('{CO}'):has(button:has-text('Approve'))")
    check("upgrade request listed", req.count() == 1)
    req.locator("button:has-text('Approve')").click(); req.wait_for(state="detached", timeout=20000)
    go(page, "/dashboard"); check("plan is now Pro", "Pro plan" in page.inner_text(".side-brand"))
    go(page, "/finance"); check("Finance unlocked", page.locator("text=Still pending from clients").is_visible())

    # ---------- Services ----------
    go(page, "/services")
    check("default services on", page.locator("#price_catering").is_visible() and page.locator("input[name=on_catering]").is_checked())
    pg_price = page.locator("#price_catering"); pg_price.fill("400")
    page.click("button:has-text('Save services')"); page.wait_for_selector("text=Services saved")
    check("service price saved", True)

    # ---------- Quotation with services, accept, booking, WhatsApp ----------
    go(page, "/quotations/new")
    page.select_option("#customerId", "__new"); page.fill("#newName", "Priya Kumar"); page.fill("#newPhone", "98765 43210")
    page.select_option("#eventType", "Wedding"); page.fill("#eventTitle", "Priya & Arun wedding"); page.fill("#eventDate", future)
    page.fill("#startTime", "10:00"); page.fill("#endTime", "16:00"); page.fill("#guests", "200"); page.fill("#venue", "Sree Mahal, Salem")
    page.fill("input[aria-label='Item 1 description']", "Stage decoration"); page.fill("input[aria-label='Item 1 rate']", "45000")
    page.select_option("select[aria-label='Add one of your services']", "catering")
    page.fill("#discount", "5000")
    check("live total 45000 + 200×400 − 5000 = 1,20,000", "₹1,20,000" in page.inner_text(".totals"))
    page.click("button:has-text('Save quotation')"); wait_url(page, re.compile(r"/quotations/[0-9a-f-]{36}\?created=1"))
    qid = page.url.split("/quotations/")[1].split("?")[0]
    check("quotation number QT-00001", "QT-00001" in page.inner_text("h1"))
    link = page.input_value("input[aria-label='Customer review link']")
    check("Pro gets Share on WhatsApp", page.locator("a:has-text('Share on WhatsApp')").count() == 1)
    mock("/__reset", ""); mock("/__mode", "ok")
    pub = newp(); pub.goto(link); pub.click("button:has-text('Accept quotation')"); pub.wait_for_selector("text=Booking confirmed", timeout=20000)
    check("public accept + WhatsApp confirmation", "sent to your WhatsApp" in pub.inner_text("body") and len(mock("/")) == 1)
    go(page, f"/quotations/{qid}")
    check("accepting created the invoice automatically", page.locator("a:has-text('Invoice SLE/')").count() == 1 and "Invoice created" in page.inner_text(".timeline"), page.inner_text("body")[:600])
    bid = page.locator("a[href^='/bookings/']").first.get_attribute("href").split("/bookings/")[1]
    go(page, "/quotations"); check("quotations list has View, Print and Invoice buttons", page.locator(f"tr:has-text('Priya & Arun wedding') a:has-text('Print')").count() == 1 and page.locator(f"tr:has-text('Priya & Arun wedding') a:has-text('Invoice')").count() == 1)
    go(page, "/invoices"); check("invoices list has View and Print", page.locator("tr:has-text('Priya Kumar') a:has-text('View')").count() == 1 and page.locator("tr:has-text('Priya Kumar') a:has-text('Print')").count() == 1)
    page.locator("tr:has-text('Priya Kumar') a:has-text('View')").click(); wait_url(page, re.compile(r"/invoices/[0-9a-f-]{36}$"))
    inv_id = page.url.split("/invoices/")[1].split("?")[0]
    page.add_init_script("window.__printed = 0; window.print = () => { window.__printed++; };"); go(page, f"/invoices/{inv_id}?print=1")
    page.wait_for_timeout(1200); check("Print link opens the print dialog", page.evaluate("window.__printed") == 1)
    go(page, f"/invoices/{inv_id}")
    check("invoice numbered SLE/<FY>/0001", re.search(r"SLE/\d{4}-\d{2}/0001", page.inner_text("h1")) is not None)
    check("invoice shows amount in words", "Rupees One Lakh Twenty Thousand Only" in page.inner_text("article"))
    page.fill("#amount", "50000")
    check("live before→after box", "₹0 → ₹50,000" in page.inner_text(".livebox"))
    page.click("button:has-text('Save payment')"); page.wait_for_selector("text=₹50,000 recorded. Balance now ₹70,000.")
    check("payment recorded with WhatsApp receipt link", page.locator("a:has-text('Send receipt on WhatsApp')").count() == 1)
    settle(page); page.reload(); check("invoice part paid", "PARTLY PAID" in page.inner_text(".pagehead").upper())

    # ---------- Expenses, profit, finance, compare ----------
    go(page, f"/finance/expense?booking={bid}")
    page.fill("#item", "300 roses from the flower market"); page.fill("#amount", "12000")
    page.click("button.choice:has-text('Decor')")
    page.set_input_files("input[type=file]", png); page.wait_for_selector("img[alt='Bill photo preview']")
    check("live profit preview", "₹50,000 → ₹38,000" in page.inner_text(".livebox"), page.inner_text(".livebox"))
    page.click("button:has-text('Save expense')"); page.wait_for_selector("text=Expense of ₹12,000 saved")
    go(page, "/finance/profit")
    check("profit page shows bill photo and expense", page.locator("img[alt='Bill for 300 roses from the flower market']").count() == 1)
    go(page, f"/bookings/{bid}")
    money = page.inner_text(".panel:has(h2:text('Money'))")
    check("booking money panel: received 50k, spent 12k, profit 38k", "₹50,000" in money and "₹12,000" in money and "₹38,000" in money, money)
    go(page, "/finance"); check("finance overview lists the event", "Priya & Arun wedding" in page.inner_text("body") and "₹70,000" in page.inner_text(".hero"), page.inner_text(".hero"))
    go(page, "/finance/compare"); check("compare shows best margin insight", "earned the best margin" in page.inner_text("body"), page.inner_text(".body"))
    go(page, "/calendar?m=" + future[:7]); check("calendar (Pro) shows booking", page.locator("a.ev:has-text('Priya & Arun wedding')").count() == 1)

    # ---------- Bookings: enquiry, date clash, quotation for enquiry ----------
    go(page, "/bookings/new?type=enquiry")
    page.select_option("#customerId", "__new"); page.fill("#newName", "Ravi Shankar"); page.fill("#newPhone", "9123456780")
    page.fill("#eventDate", future)
    check("date clash warning", page.locator("text=already has Priya & Arun wedding").is_visible())
    page.click("label.choice:has-text('Photography')")
    page.click("button:has-text('Save enquiry')"); wait_url(page, re.compile(r"/bookings/[0-9a-f-]{36}\?saved=1"))
    enq = page.url.split("/bookings/")[1].split("?")[0]
    check("enquiry saved", "ENQUIRY" in page.inner_text(".pagehead").upper())
    page.click("a:has-text('Make quotation')"); wait_url(page, re.compile(r"/quotations/new\?booking="))
    check("quotation prefilled from enquiry services", page.input_value("input[aria-label='Item 1 description']").startswith("Photography"))
    page.fill("#venue", "Hotel Cenneys, Salem"); page.click("button:has-text('Save quotation')"); wait_url(page, re.compile(r"/quotations/[0-9a-f-]{36}\?created=1"))
    page.click("button:has-text('Mark accepted')"); wait_url(page, re.compile(r"/bookings/[0-9a-f-]{36}\?new=1"))
    check("accepting confirms the same enquiry (no duplicate)", page.url.split("/bookings/")[1].split("?")[0] == enq and "CONFIRMED" in page.inner_text(".pagehead").upper())

    # ---------- Service tools ----------
    go(page, "/services/tools/catering?tab=menus")
    page.click("summary:has-text('+ Plan a menu')")
    pick(page, "#f_eventId", "Priya & Arun wedding")
    for dish in ["White rice", "Sambar", "Semiya payasam"]: page.click(f".multi label:has-text('{dish}')")
    page.click("button:has-text('Add menu')"); page.wait_for_selector("text=Menu added.")
    settle(page); page.reload()
    check("menu row with plates from guest count", "200" in page.inner_text("tbody") and "₹115" in page.inner_text("tbody") and "₹23,000" in page.inner_text("tbody"), page.inner_text("tbody"))
    go(page, "/services/tools/catering?tab=gen")
    check("purchase generator lists ingredients", "Ponni rice" in page.inner_text("tbody") and "24 kg" in page.inner_text("tbody"))
    page.click("button:has-text('Save as purchase list')"); page.wait_for_selector("text=Purchase list saved")
    go(page, "/services/tools/catering?tab=plists"); check("purchase list saved", page.locator(".panel > .tablewrap > table > tbody > tr").count() == 1, page.inner_text(".body"))
    go(page, "/services/tools/planning")
    pick(page, "select[aria-label='Event for the standard checklist']", "Priya & Arun wedding")
    page.click("button:has-text('Add standard checklist')"); page.wait_for_selector("text=10 tasks added")
    settle(page); page.reload(); check("checklist tasks listed", page.locator("tbody tr").count() == 10)
    go(page, "/services/tools/decor?tab=items"); check("decor stock seeded (Pro tab)", "Chiavari chairs" in page.inner_text("tbody"))

    # ---------- Staff (Pro) with wage payment added to event expenses ----------
    go(page, "/staff")
    page.click("button:has-text('+ Add employee')"); page.fill("#emp-name", "Murugan"); page.fill("#emp-phone", "9000000001"); page.fill("#emp-wage", "900")
    page.click("dialog button[type=submit]"); page.wait_for_selector("text=was added as a permanent employee"); page.wait_for_timeout(1300); page.reload()
    page.click("details.team summary"); page.get_by_role("button", name="Pay", exact=True).first.click()
    page.fill("dialog[open] input[name=amount]", "900"); pick(page, "dialog[open] select[name=bookingId]", "Priya & Arun wedding")
    page.click("dialog[open] button:has-text('Record payment')"); page.wait_for_selector("text=added to the event’s expenses")
    go(page, "/finance/profit"); check("staff wages became an event expense", "Wages: Murugan" in page.inner_text("body"))

    # ---------- Enterprise: admin switches plan, customize, team roles ----------
    go(page, "/admin")
    page.locator(f"select[aria-label='Plan for {CO}']").select_option("enterprise"); page.wait_for_selector(f"tr:has-text('{CO}') >> text=Saved")
    go(page, "/settings/customize?tab=statuses"); page.fill("#st", "Advance paid"); page.click("button:has-text('Add status')"); page.wait_for_selector("text=Status “Advance paid” added.")
    go(page, "/settings/customize?tab=fields"); page.fill("#eventFields-label", "Muhurtham time"); page.click(".panel:has-text('Extra fields on events') button:has-text('Add field')"); page.wait_for_selector("text=Field “Muhurtham time” added.")
    go(page, "/settings/customize?tab=menu"); page.fill("input[aria-label='New name for Customers']", "Families"); page.click("button:has-text('Save menu')"); page.wait_for_selector("text=Menu saved.")
    settle(page); page.reload(); check("menu item renamed to Families", page.locator(".navlink:has-text('Families')").count() == 1)
    go(page, "/settings/customize?tab=tools"); page.fill("#ct-name", "Return gifts")
    page.fill("input[aria-label='Field 1 name']", "Event"); page.fill("input[aria-label='Field 2 name']", "Gift item"); page.fill("input[aria-label='Field 3 name']", "Quantity")
    page.click("button:has-text('Create tool')"); page.wait_for_selector("text=“Return gifts” is ready in Services.")
    go(page, "/services"); tool_link = page.locator("a.subtab:has-text('Return gifts')"); check("custom tool in Services tabs", tool_link.count() == 1)
    tool_link.click(); wait_url(page, re.compile(r"/services/tools/ct_"))
    page.click("summary:has-text('+ Add entry')"); pick(page, "#f_" + page.locator("select[id^=f_]").first.get_attribute("id")[2:], "Priya & Arun wedding")
    page.locator("input[id^=f_]").nth(0).fill("Silver kumkum box"); page.locator("input[id^=f_][type=number]").fill("150")
    page.click("button:has-text('Add entry')"); page.wait_for_selector("text=Entry added."); settle(page); page.reload()
    check("custom tool entry saved", "Silver kumkum box" in page.inner_text("tbody"))
    go(page, "/settings/customize?tab=branches"); page.fill("#b-name", "Nagercoil branch"); page.fill("#b-city", "Nagercoil"); page.click("button:has-text('Add branch')"); page.wait_for_selector("text=Branch Nagercoil branch added.")
    go(page, "/bookings/new"); check("custom field and branch on booking form", page.locator("label:has-text('Muhurtham time')").count() == 1 and page.locator("#branchId").count() == 1)
    go(page, f"/bookings/{bid}"); page.locator("select[aria-label='Booking status']").select_option("Advance paid"); settle(page)
    page.reload(); check("custom status applied", "ADVANCE PAID" in page.inner_text(".pagehead").upper())
    go(page, "/settings/customize?tab=branding"); page.fill("#appName", "Lakshmi Desk"); page.click("button:has-text('Save branding')"); page.wait_for_selector("text=Branding saved."); settle(page); page.reload()
    check("own app name in sidebar", "Lakshmi Desk" in page.inner_text(".side-brand"))
    go(page, "/staff/team")
    page.fill("#m-name", "Kavya"); page.fill("#m-email", ACC); page.select_option("#m-role", "Accountant"); page.fill("#m-pw", "Account123")
    page.click("button:has-text('Add team member')"); page.wait_for_selector("text=can now sign in")
    acc = newp(); go(acc, "/login"); acc.fill("#email", ACC); acc.fill("#password", "Account123"); acc.click("button:has-text('Sign in')"); wait_url(acc, re.compile(r"/dashboard"))
    nav = acc.inner_text(".side nav")
    check("accountant sees Finance and Invoices", "Finance" in nav and "Invoices" in nav)
    check("accountant does not see Staff, Bookings or Settings pages", "Staff & team" not in nav and "Bookings" not in nav and "Company settings" not in acc.inner_text("body"))
    go(acc, "/staff"); check("accountant blocked from Staff", "Not available for your role" in acc.inner_text("body"))
    go(page, "/settings/activity"); act = page.inner_text("tbody")
    check("activity log records changes", "Added Kavya as Accountant" in act and "Recorded ₹50,000" in act)

    # ---------- Second company: Basic limit, isolation, suspension ----------
    b = newp(); signup(b, "Babu", BCO, Bm)
    for i in range(10):
        go(b, "/bookings/new?type=enquiry")
        if i == 0: b.select_option("#customerId", "__new"); b.fill("#newName", "Kumar Family"); b.fill("#newPhone", "9345678901")
        else: pick(b, "#customerId", "Kumar Family")
        b.fill("#eventDate", future); b.fill("#title", f"Enquiry {i + 1}")
        b.click("button:has-text('Save enquiry')"); wait_url(b, re.compile(r"/bookings/[0-9a-f-]{36}\?saved=1"))
    go(b, "/bookings/new"); check("Basic limit of 10 active events enforced", "allows 10 active events" in b.inner_text("body"))
    go(b, f"/bookings/{bid}"); check("other company cannot see the booking", "Page not found" in b.inner_text("body"))
    go(b, f"/invoices/{inv_id}"); check("other company cannot see the invoice", "Page not found" in b.inner_text("body"))
    go(page, "/admin"); page.locator(f"tr:has-text('{BCO}') button:has-text('Suspend')").click(); page.wait_for_selector(f"tr:has-text('{BCO}') button:has-text('Activate')")
    go(b, "/dashboard"); check("suspended company sees paused page", "account is paused" in b.inner_text("body"))
    go(page, "/admin"); page.locator(f"tr:has-text('{BCO}') button:has-text('Activate')").click(); page.wait_for_selector(f"tr:has-text('{BCO}') button:has-text('Suspend')")
    go(b, "/dashboard"); check("reactivated company works again", "Dashboard" in b.inner_text("h1"))

    page.screenshot(path="/home/claude/tests/v2-final.png", full_page=True)
    br.close()

errs = [e for e in console_errors if "Failed to load resource" not in e]
check("no browser console errors", not errs)
if errs: print("\n".join(errs[:10]))
fails = [n for n, ok in results if not ok]
print(f"\n{len(results) - len(fails)}/{len(results)} passed"); sys.exit(1 if fails else 0)
