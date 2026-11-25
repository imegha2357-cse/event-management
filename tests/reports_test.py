"""Reports: hub, plan locks, each report's figures, period filters, Print button and the printed (A4) layout."""
import os, re, time, subprocess
from datetime import date, timedelta
from playwright.sync_api import sync_playwright
B = os.environ.get("BASE", "http://localhost:3100"); res = []; errs = []
def go(pg, u): pg.goto(B + u); pg.wait_for_selector("html[data-hydrated]", state="attached", timeout=30000); pg.wait_for_load_state("networkidle")
def check(n, c, show=None): res.append(c); print(("PASS " if c else "FAIL ") + n + ("" if c or show is None else "  >> " + str(show)[:500].replace("\n", " | ")))
def wait_url(pg, pat):
    for _ in range(150):
        if re.search(pat, pg.url): pg.wait_for_load_state("networkidle"); return
        pg.wait_for_timeout(150)
    raise AssertionError(pg.url)
def sql(q): return subprocess.run(["psql", "-h", "/tmp", "-p", "5433", "-U", "postgres", "eventdesk", "-Atc", q], capture_output=True, text=True).stdout.strip()
from datetime import datetime, timezone
today = (datetime.now(timezone.utc) + timedelta(hours=5, minutes=30)).date(); ev = (today + timedelta(days=20)).isoformat()
email = f"rep{int(time.time())}@ex.com"
with sync_playwright() as p:
    br = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"]); pg = br.new_page(viewport={"width": 1440, "height": 900})
    pg.on("dialog", lambda d: d.accept()); pg.on("pageerror", lambda e: errs.append(str(e)[:150]))
    go(pg, "/signup"); pg.fill("#name", "Kavya Raman"); pg.fill("#company", "Sri Durga Events"); pg.fill("#email", email); pg.fill("#password", "Secret123"); pg.click("button:has-text('Create account')")
    pg.wait_for_selector("#phone"); pg.wait_for_selector("html[data-hydrated]", state="attached"); pg.fill("#phone", "9876500011"); pg.fill("#city", "Madurai"); pg.click("button:has-text('Save and continue')"); pg.wait_for_selector("h1:has-text('Dashboard')")

    # ---- Sidebar and Basic plan ----
    side = pg.inner_text("aside.side")
    check("sidebar has Reports", "Reports" in side, side)
    check("sidebar still has at most 10 main items", pg.locator("aside.side nav > div").count() <= 10 if pg.locator("aside.side nav > div").count() else True)
    go(pg, "/reports"); cards = pg.locator(".reportcard")
    check("reports hub lists 7 reports", cards.count() == 7, cards.all_inner_texts())
    check("Basic: payments, expenses and profit reports marked Pro", pg.locator(".reportcard:has(.chip:has-text('Pro plan'))").count() == 3)
    go(pg, "/reports/profit"); check("Basic: profit report is locked", "Pro" in pg.inner_text(".body") and pg.locator(".report-paper").count() == 0)
    go(pg, "/reports/bookings"); check("Basic: bookings report opens", pg.locator(".report-paper").count() == 1)
    check("empty period says so", "No bookings in this period" in pg.inner_text(".report-paper"))
    go(pg, "/bookings"); check("Calendar is a tab inside Bookings", pg.locator(".subtabs a:has-text('Calendar')").count() == 1)

    # ---- Upgrade to Pro (as the platform owner would) and create real data ----
    sql(f"update tenants set plan='pro' where id=(select tenant_id from users where email='{email}')")
    go(pg, "/quotations/new"); pg.select_option("#customerId", "__new"); pg.fill("#newName", "Lakshmi Narayanan"); pg.fill("#newPhone", "9123400001")
    pg.select_option("#eventType", "Wedding"); pg.fill("#eventTitle", "Lakshmi wedding"); pg.fill("#eventDate", ev); pg.fill("#venue", "Meenakshi Mahal, Madurai")
    pg.fill("input[aria-label='Item 1 description']", "Stage and flower decoration"); pg.fill("input[aria-label='Item 1 rate']", "100000")
    pg.click("button:has-text('Save quotation')"); wait_url(pg, r"/quotations/[0-9a-f-]{36}\?created=1")
    go(pg, "/quotations/new"); pg.select_option("#customerId", "__new"); pg.fill("#newName", "Arjun Mehta"); pg.fill("#newPhone", "9123400002")
    pg.select_option("#eventType", "Birthday"); pg.fill("#eventTitle", "Arjun birthday"); pg.fill("#eventDate", ev); pg.fill("#venue", "Hotel Tamil Nadu")
    pg.fill("input[aria-label='Item 1 description']", "Balloon decoration"); pg.fill("input[aria-label='Item 1 rate']", "20000")
    pg.click("button:has-text('Save quotation')"); wait_url(pg, r"/quotations/[0-9a-f-]{36}\?created=1")
    go(pg, "/quotations")
    pg.locator("tr", has_text="Lakshmi wedding").locator("button:has-text('Accept')").click(); pg.wait_for_selector("tr:has-text('Lakshmi wedding') >> .decided.ok", timeout=20000)
    pg.locator("tr", has_text="Arjun birthday").locator("button:has-text('Decline')").click(); pg.wait_for_selector("tr:has-text('Arjun birthday') >> .decided.no", timeout=20000)
    go(pg, "/invoices"); pg.locator("tr:has-text('Lakshmi Narayanan') a:has-text('View')").click(); wait_url(pg, r"/invoices/[0-9a-f-]{36}$")
    inv_total = pg.inner_text("article")
    pg.fill("#amount", "40000"); pg.click("button:has-text('Save payment')"); pg.wait_for_selector("text=₹40,000 recorded")
    bid = sql(f"select b.id from bookings b join users u on u.tenant_id=b.tenant_id where u.email='{email}' and b.title='Lakshmi wedding'")
    go(pg, f"/finance/expense?booking={bid}"); pg.fill("#item", "Roses and jasmine"); pg.fill("#amount", "15000"); pg.click("button.choice:has-text('Decor')")
    pg.click("button:has-text('Save expense')"); pg.wait_for_selector("text=Expense of ₹15,000 saved")
    # The expense form always links an event; a general cost (e.g. from staff wages) has none
    sql(f"insert into expenses (id, tenant_id, category, item, amount, spent_on) select gen_random_uuid()::text, tenant_id, 'Rent', 'Godown rent', 5000, '{today.isoformat()}' from users where email='{email}'")
    inv = sql(f"select i.total, i.tax, i.doc_no from invoices i join users u on u.tenant_id=i.tenant_id where u.email='{email}'").split("|")
    total, tax, docno = int(inv[0]), int(inv[1]), inv[2]
    def inr(n):
        s = str(abs(n))
        if len(s) > 3: s = re.sub(r"(\d)(?=(\d\d)+$)", r"\1,", s[:-3]) + "," + s[-3:]
        return ("−" if n < 0 else "") + "₹" + s

    # ---- Each report ----
    go(pg, "/reports"); check("Pro: no locks on the hub", pg.locator(".reportcard .chip").count() == 0)
    go(pg, "/reports/bookings"); t = pg.inner_text(".report-paper")
    check("bookings: accepted event listed", "Lakshmi wedding" in t and "Meenakshi Mahal" in t, t)
    check("bookings: declined quotation not listed", "Arjun birthday" not in t)
    check("bookings: header shows company and period", "Sri Durga Events" in t and "Period:" in t)
    go(pg, "/reports/quotations"); t = pg.inner_text(".report-paper")
    check("quotations: both listed with acceptance rate 50%", "Lakshmi wedding" in t and "Arjun birthday" in t and "50%" in t, t)
    go(pg, "/reports/sales"); t = pg.inner_text(".report-paper")
    check("sales: invoice listed with total", docno in t and inr(total) in t, (docno, inr(total), t))
    check("sales: taxable + CGST + SGST adds up", inr(total - tax) in t, t)
    go(pg, "/reports/dues"); t = pg.inner_text(".report-paper")
    check("dues: balance still to collect", inr(total - 40000) in t and "Lakshmi Narayanan" in t, (inr(total - 40000), t))
    go(pg, "/reports/collections"); t = pg.inner_text(".report-paper")
    check("payments received: ₹40,000 with mode", "₹40,000" in t and "By payment mode" in t, t)
    go(pg, "/reports/expenses"); t = pg.inner_text(".report-paper")
    check("expenses: both entries and total ₹20,000", "Roses and jasmine" in t and "Godown rent" in t and "₹20,000" in t, t)
    check("expenses: grouped by category", "By category" in t and "Decor" in t)
    go(pg, "/reports/profit"); t = pg.inner_text(".report-paper")
    check("profit: event profit = income before GST − ₹15,000", inr(total - tax - 15000) in t, (inr(total - tax - 15000), t))
    check("profit: general expenses shown separately", "General expenses" in t and "₹5,000" in t)

    # ---- Periods ----
    go(pg, "/reports/expenses?preset=lastmonth"); check("last month: nothing", "No expenses in this period" in pg.inner_text(".report-paper"))
    go(pg, "/reports/expenses?preset=month"); check("preset chip highlighted", pg.locator(".reportbar a.on").inner_text() == "This month")
    last = (today - timedelta(days=1)).isoformat()
    pg.fill("input[name=from]", today.isoformat()); pg.fill("input[name=to]", today.isoformat()); pg.click(".reportdates button:has-text('Show')")
    wait_url(pg, r"from=" + today.isoformat()); check("custom dates: today's expenses", "Godown rent" in pg.inner_text(".report-paper"))
    go(pg, f"/reports/expenses?from=2000-01-01&to={(today - timedelta(days=400)).isoformat()}"); check("custom dates: old period empty", "No expenses in this period" in pg.inner_text(".report-paper"))
    go(pg, "/reports/nonsense"); check("unknown report is not found", "Page not found" in pg.inner_text("body") or "404" in pg.inner_text("body"))

    # ---- Printing ----
    pg.add_init_script("window.__printed = 0; window.print = () => { window.__printed++; };")
    go(pg, "/reports/sales"); pg.click("button:has-text('Print')"); pg.wait_for_timeout(300)
    check("Print button opens the print dialog", pg.evaluate("window.__printed") == 1)
    go(pg, "/reports/sales?print=1"); pg.wait_for_timeout(1200); check("?print=1 opens print dialog", pg.evaluate("window.__printed") == 1)
    pg.emulate_media(media="print")
    vis = lambda s: pg.locator(s).first.is_visible()
    check("print: sidebar, tabs, filters and buttons hidden", not vis("aside.side") and not vis(".subtabs") and not vis(".reportbar") and not vis(".report-page .pagehead"))
    check("print: report page visible", vis(".report-paper") and vis(".report-head"))
    for k in ["sales", "profit"]:
        go(pg, f"/reports/{k}"); pg.pdf(path=f"/home/claude/tests/report-{k}.pdf", format="A4", print_background=True)
    pg.emulate_media(media="screen"); go(pg, "/reports/profit"); pg.screenshot(path="/home/claude/tests/report-profit-screen.png", full_page=True)
    go(pg, "/reports"); pg.screenshot(path="/home/claude/tests/report-hub.png")
print("errors:", errs); print(f"{sum(res)}/{len(res)} passed")
