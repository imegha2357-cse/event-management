"""Quotation workflow: the list has only Accept / Decline; accepted → Bookings (confirmed, invoiced); declined → never in Bookings."""
import os, re, time
from datetime import date, timedelta
from playwright.sync_api import sync_playwright
B = os.environ.get("BASE", "http://localhost:3100"); res = []; errs = []
def go(pg, u): pg.goto(B + u); pg.wait_for_selector("html[data-hydrated]", state="attached", timeout=30000); pg.wait_for_load_state("networkidle")
def check(n, c, show=None): res.append(c); print(("PASS " if c else "FAIL ") + n + ("" if c or show is None else "  >> " + str(show)[:400].replace("\n", " | ")))
def wait_url(pg, pat):
    for _ in range(150):
        if re.search(pat, pg.url): pg.wait_for_load_state("networkidle"); return
        pg.wait_for_timeout(150)
    raise AssertionError(pg.url)
future = (date.today() + timedelta(days=30)).isoformat()
with sync_playwright() as p:
    br = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"]); pg = br.new_page(viewport={"width": 1440, "height": 900})
    pg.on("dialog", lambda d: d.accept()); pg.on("pageerror", lambda e: errs.append(str(e)[:150]))
    go(pg, "/signup"); pg.fill("#name", "Meena Raj"); pg.fill("#company", "Decide Events"); pg.fill("#email", f"dec{int(time.time())}@ex.com"); pg.fill("#password", "Secret123"); pg.click("button:has-text('Create account')")
    pg.wait_for_selector("#phone"); pg.wait_for_selector("html[data-hydrated]", state="attached"); pg.fill("#phone", "9876500000"); pg.fill("#city", "Salem"); pg.click("button:has-text('Save and continue')"); pg.wait_for_selector("h1:has-text('Dashboard')")
    check("dashboard has no temperature/weather card", pg.locator(".wx").count() == 0 and "°" not in pg.inner_text(".body"))
    go(pg, "/settings"); check("settings has no demo data option", "Demo data" not in pg.inner_text("body"))
    def quote(name, phone, title):
        go(pg, "/quotations/new"); pg.select_option("#customerId", "__new"); pg.fill("#newName", name); pg.fill("#newPhone", phone)
        pg.select_option("#eventType", "Wedding"); pg.fill("#eventTitle", title); pg.fill("#eventDate", future); pg.fill("#venue", "Sree Mahal, Salem")
        pg.fill("input[aria-label='Item 1 description']", "Stage decoration"); pg.fill("input[aria-label='Item 1 rate']", "40000")
        pg.click("button:has-text('Save quotation')"); wait_url(pg, r"/quotations/[0-9a-f-]{36}\?created=1")
    quote("Ravi Kumar", "9123456780", "Ravi wedding")
    quote("Divya Ramesh", "9123456781", "Divya reception")
    go(pg, "/bookings?view=all"); t = pg.inner_text(".body")
    check("open quotations are not in Bookings", "Ravi wedding" not in t and "Divya reception" not in t, t[:400])
    go(pg, "/quotations")
    r1 = pg.locator("tr", has_text="Ravi wedding")
    check("quotation row has exactly Accept and Decline (with icons)", [x.strip() for x in r1.locator("button").all_inner_texts()] == ["Accept", "Decline"] and r1.locator("button svg").count() == 2, r1.locator("button").all_inner_texts())
    check("quotation row has no View/Print/Invoice buttons", r1.locator("a.btn").count() == 0)
    pg.screenshot(path="/home/claude/tests/decide-quotes-open.png")
    r1.locator("button:has-text('Decline')").click(); pg.wait_for_selector("tr:has-text('Ravi wedding') >> .decided.no", timeout=20000)
    check("declined quotation shows Declined", pg.locator("tr:has-text('Ravi wedding') .decided.no").count() == 1)
    pg.locator("tr", has_text="Divya reception").locator("button:has-text('Accept')").click(); pg.wait_for_selector("tr:has-text('Divya reception') >> .decided.ok", timeout=20000)
    check("accepted quotation shows Accepted with booking link", pg.locator("tr:has-text('Divya reception') .decided.ok a:has-text('booking')").count() == 1)
    pg.screenshot(path="/home/claude/tests/decide-quotes.png")
    go(pg, "/bookings?view=all"); t = pg.inner_text(".body")
    check("accepted quotation moved to Bookings", "Divya reception" in t, t[:400])
    check("declined quotation not in Bookings", "Ravi wedding" not in t)
    check("booking shows as Confirmed", pg.locator("tr:has-text('Divya reception') select").input_value() == "Confirmed")
    pg.screenshot(path="/home/claude/tests/decide-bookings.png")
    pg.locator("tr:has-text('Divya reception') a:has-text('Divya reception')").click(); wait_url(pg, r"/bookings/[0-9a-f-]{36}$")
    check("invoice generated automatically on accept", pg.locator('.pagehead a', has_text=re.compile(r'^Invoice [A-Z]+\/')).count() == 1, pg.inner_text('.pagehead'))
    go(pg, "/invoices"); check("invoice listed with View and Print", pg.locator("tr:has-text('Divya Ramesh') a:has-text('Print')").count() == 1)
    go(pg, "/dashboard"); check("declined event not on dashboard", "Ravi wedding" not in pg.inner_text(".split"))
    go(pg, "/services/tools/catering?tab=dishes"); check("catering recipes start empty", pg.locator("tbody tr").count() == 0)
print("errors:", errs); print(f"{sum(res)}/{len(res)} passed")
