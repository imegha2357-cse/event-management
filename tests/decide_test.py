import re, time
from datetime import date, timedelta
from playwright.sync_api import sync_playwright
B = "http://localhost:3100"; res = []; errs = []
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
    def enquiry_with_quote(name, phone, title):
        go(pg, "/bookings/new?type=enquiry"); pg.select_option("#customerId", "__new"); pg.fill("#newName", name); pg.fill("#newPhone", phone); pg.fill("#eventDate", future); pg.fill("#title", title)
        pg.click("label.choice:has-text('Catering')"); pg.click("button:has-text('Save enquiry')"); wait_url(pg, r"/bookings/[0-9a-f-]{36}\?saved=1")
        bid = pg.url.split("/bookings/")[1].split("?")[0]
        pg.click("a:has-text('Make quotation')"); wait_url(pg, r"/quotations/new\?booking="); pg.fill("#venue", "Sree Mahal, Salem")
        pg.click("button:has-text('Save quotation')"); wait_url(pg, r"/quotations/[0-9a-f-]{36}\?created=1")
        return bid
    b1 = enquiry_with_quote("Ravi Kumar", "9123456780", "Ravi wedding")
    b2 = enquiry_with_quote("Divya Ramesh", "9123456781", "Divya reception")
    go(pg, "/bookings?view=all")
    r1 = pg.locator("tr", has=pg.locator("a:text-is('Ravi wedding')"))
    check("enquiry row shows ✓ Accept and ✗ Decline side by side", r1.locator(".decide button:has-text('✓ Accept')").count() == 1 and r1.locator(".decide button:has-text('✗ Decline')").count() == 1)
    pg.screenshot(path="/home/claude/tests/decide-bookings.png")
    r1.locator("button:has-text('✗ Decline')").click(); pg.wait_for_selector("tr:has(a:text-is('Ravi wedding')) >> .decided.no", timeout=20000)
    check("declined enquiry shows ✗ Declined", "Declined" in pg.locator("tr", has=pg.locator("a:text-is('Ravi wedding')")).inner_text())
    go(pg, f"/bookings/{b1}"); check("event status is Declined", pg.locator("select[aria-label='Booking status']").input_value() == "Declined")
    go(pg, "/quotations")
    r2 = pg.locator("tr", has_text="Divya reception")
    r2.locator("button:has-text('✓ Accept')").click(); pg.wait_for_selector("tr:has-text('Divya reception') >> .decided.ok", timeout=20000)
    check("accepted quotation shows ✓ Accepted with booking link", pg.locator("tr:has-text('Divya reception') .decided.ok a:has-text('booking')").count() == 1)
    check("declined quotation shows ✗ Declined in list", pg.locator("tr:has-text('Ravi wedding') .decided.no").count() == 1)
    pg.screenshot(path="/home/claude/tests/decide-quotes.png")
    go(pg, f"/bookings/{b2}"); check("accepted enquiry pushed to bookings as Confirmed (same event)", pg.locator("select[aria-label='Booking status']").input_value() == "Confirmed")
    check("invoice generated automatically on accept", pg.locator('.pagehead a', has_text=re.compile(r'^Invoice [A-Z]+\/')).count() == 1, pg.inner_text('.pagehead'))
    go(pg, "/invoices"); check("invoice listed with View and Print", pg.locator("tr:has-text('Divya Ramesh') a:has-text('Print')").count() == 1)
    go(pg, "/bookings"); t = pg.inner_text("tbody")
    check("bookings list: Divya ✓ Booked, Ravi ✗ Declined", "✓ Booked" in t and "✗ Declined" in t, t)
    go(pg, "/dashboard"); check("declined event not in upcoming", "Ravi wedding" not in pg.inner_text(".split"))
print("errors:", errs); print(f"{sum(res)}/{len(res)} passed")
