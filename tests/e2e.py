import os
import json, re, sys, time, urllib.request
from datetime import date, timedelta
from playwright.sync_api import sync_playwright, expect

BASE = os.environ.get("BASE", "http://localhost:3100"); MOCK = "http://127.0.0.1:3999"
def mock(path, data=None):
    req = urllib.request.Request(MOCK + path, data=(data.encode() if data is not None else None), method="POST" if data is not None else "GET")
    return json.loads(urllib.request.urlopen(req).read() or b"null")
results = []
def wait_url(pg, pat, timeout=20000):
    import fnmatch
    end = time.time() + timeout / 1000
    while time.time() < end:
        u = pg.url
        if (isinstance(pat, str) and fnmatch.fnmatch(u, pat)) or (not isinstance(pat, str) and pat.search(u)):
            pg.wait_for_load_state("networkidle"); pg.wait_for_timeout(400); return
        pg.wait_for_timeout(150)
    print("\n".join(NET[-12:])); print(console_errors[-5:])
    try: print(pg.inner_text(".content")[:300])
    except Exception: pass
    raise AssertionError(f"URL {pg.url} did not match {pat}")
def go(pg, url):
    pg.goto(url); pg.wait_for_selector("html[data-hydrated]", state="attached", timeout=20000); pg.wait_for_load_state("networkidle")
def check(name, cond):
    results.append((name, bool(cond))); print(("PASS " if cond else "FAIL ") + name)

future = (date.today() + timedelta(days=20)).isoformat()
email = f"owner{int(time.time())}@example.com"
console_errors = []
with sync_playwright() as p:
    br = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
    ctx = br.new_context(viewport={"width": 1366, "height": 900})
    page = ctx.new_page()
    page.on("console", lambda m: console_errors.append(page.url + " :: " + m.text[:120]) if m.type == "error" else None)
    page.on("pageerror", lambda e: console_errors.append(str(e)))
    NET = []
    def _body(r):
        try: return r.body()[-400:].decode('utf-8','replace').replace("\n"," | ")
        except Exception as e: return f"<no body: {e}>"
    def _any(pg_):
        pg_.on("requestfinished", lambda rq: NET.append(f"DONE {rq.method} {rq.url[:60]} hdr={ {k:v for k,v in (rq.response().headers if rq.response() else {}).items() if k.startswith('x-action')} } BODY={_body(rq.response())}") if rq.method == "POST" else None)
        pg_.on("response", lambda r: NET.append(f"[{id(pg_)%1000}] {r.status} {r.request.method} {r.url[:90]} {time.strftime('%X')}") if "_next/static" not in r.url else None)
        pg_.on("request", lambda r: NET.append(f"[{id(pg_)%1000}] REQ {r.method} {r.url[:90]} {time.strftime('%X')}") if "_next/static" not in r.url else None)
    _any(page)
    def newp():
        x = br.new_context().new_page(); _any(x); return x
    import atexit; atexit.register(lambda: print('\n'.join(NET[-30:])))
    page.on("requestfailed", lambda r: NET.append(f"FAILED {r.method} {r.url[:100]} {r.failure}"))

    # --- Auth: validation, signup, onboarding ---
    go(page, BASE + "/login")
    check("no Google button without keys", page.locator("text=Continue with Google").count() == 0)
    page.click("button:has-text('Sign in')")
    page.wait_for_selector("text=Enter your email address.")
    check("login empty validation", True)
    page.fill("#email", "nobody@example.com"); page.fill("#password", "wrongpass1"); page.click("button:has-text('Sign in')")
    page.wait_for_selector("text=Incorrect email or password.")
    check("wrong login error", True)
    check("email kept after error", page.input_value("#email") == "nobody@example.com")
    go(page, BASE + "/signup")
    page.fill("#name", "Meena Raj"); page.fill("#company", "x"); page.fill("#email", email); page.fill("#password", "short")
    page.click("button:has-text('Create account')")
    page.wait_for_selector("text=Use at least 8 characters.")
    check("signup validation", page.locator("text=Enter your company name.").count() == 1)
    page.fill("#company", "Sri Lakshmi Events"); page.fill("#password", "Secret123"); page.click("button:has-text('Create account')")
    wait_url(page, "**/onboarding", timeout=20000)
    check("onboarding prefilled company", page.input_value("#name") == "Sri Lakshmi Events")
    go(page, BASE + "/dashboard"); check("dashboard reachable (company named)", "/dashboard" in page.url)
    go(page, BASE + "/onboarding"); page.click("button:has-text('Save and continue')"); page.wait_for_selector("text=Enter a valid phone number.")
    page.fill("#phone", "9876500000"); page.fill("#city", "Chennai"); page.click("button:has-text('Save and continue')")
    wait_url(page, "**/dashboard", timeout=20000)
    check("signup lands on dashboard (company set)", "Sri Lakshmi Events" in page.inner_text(".topbar"))
    go(page, BASE + "/settings")
    page.fill("#phone", "9876500000"); page.fill("#city", "Chennai"); page.click("button:has-text('Save')")
    page.wait_for_selector("text=Company details saved.")
    check("settings save", True)
    import subprocess
    subprocess.run(["psql", "-h", "localhost", "-p", "5433", "-U", "postgres", "-d", "eventdesk", "-c", f"update tenants set plan='pro' where id=(select tenant_id from users where email='{email}')"], capture_output=True)
    # password toggle
    # --- Customer ---
    go(page, BASE + "/customers/new")
    page.fill("#name", "Priya Kumar"); page.fill("#phone", "12345"); page.click("button:has-text('Save customer')")
    page.wait_for_selector("text=Enter a 10-digit Indian mobile number.")
    check("customer phone validation", True)
    page.fill("#phone", "98765 43210"); page.fill("#city", "Salem"); page.click("button:has-text('Save customer')")
    try: wait_url(page, re.compile(r"/customers/[0-9a-f-]{36}$"))
    except AssertionError:
        print("\n".join(NET[-15:])); print(console_errors); raise
    check("customer created", page.locator("h1:has-text('Priya Kumar')").is_visible())

    def make_quote(title, customer_label="Priya Kumar"):
        go(page, BASE + "/quotations/new")
        page.select_option("#customerId", label=re.compile(customer_label) if False else None) if False else None
        opts = page.locator("#customerId option").all_inner_texts()
        page.select_option("#customerId", label=[o for o in opts if o.startswith(customer_label)][0])
        page.select_option("#eventType", "Wedding"); page.fill("#eventTitle", title); page.fill("#eventDate", future)
        page.fill("#startTime", "10:00"); page.fill("#endTime", "16:00"); page.fill("#guests", "200"); page.fill("#venue", "Sree Mahal, Salem")
        page.fill("input[aria-label='Item 1 description']", "Stage decoration"); page.fill("input[aria-label='Item 1 rate']", "45000")
        page.select_option("select[aria-label='Add one of your services']", "catering")  # 450 per plate -> qty = guests
        page.fill("#discount", "5000")
        page.click("button:has-text('Save quotation')")
        wait_url(page, re.compile(r"/quotations/[0-9a-f-]{36}\?created=1"), timeout=20000)
        return page.url.split("/quotations/")[1].split("?")[0]

    # quote validation
    go(page, BASE + "/quotations/new"); page.click("button:has-text('Save quotation')")
    page.wait_for_selector("text=Please correct the highlighted fields.")
    check("quote validation", page.locator("text=Choose a customer.").is_visible())
    qid = make_quote("Priya & Arun wedding")
    body = page.inner_text("main, body")
    check("quote totals (45000 + 200*450 - 5000 = 130000)", "₹1,30,000" in body)
    check("quote is Draft", page.locator(".pagehead .badge").inner_text().strip().upper() == "DRAFT")
    link = page.input_value("input[aria-label='Customer review link']")
    wa = page.get_attribute("a:has-text('Share on WhatsApp')", "href")
    check("wa.me share link to 919876543210", wa.startswith("https://wa.me/919876543210?text="))
    page.click("button:has-text('Mark as sent')")
    page.wait_for_selector(".pagehead .badge:has-text('Sent')")
    page.reload(); check("quote is Sent", page.locator(".pagehead .badge").inner_text().strip().upper() == "SENT")

    # --- Public accept -> booking -> WhatsApp ---
    mock("/__reset", ""); mock("/__mode", "ok")
    pub = newp()
    go(pub, link)
    check("public page shows quotation", pub.locator("text=Please review your quotation").is_visible())
    pub.click("button:has-text('Accept quotation')")
    pub.wait_for_selector("text=Booking confirmed", timeout=20000)
    check("public accept confirms + WhatsApp sent msg", "sent to your WhatsApp" in pub.inner_text("body"))
    log = mock("/")
    check("WhatsApp API called once", len(log) == 1)
    if log:
        b = log[0]["body"]
        check("WhatsApp template payload", b["to"] == "919876543210" and b["type"] == "template" and b["template"]["name"] == "booking_confirmation" and log[0]["auth"] == "Bearer test-token")
        params = [x["text"] for x in b["template"]["components"][0]["parameters"]]
        check("template params: name, event, venue, company", params[0] == "Priya Kumar" and params[1] == "Priya & Arun wedding" and "Sree Mahal" in params[4] and params[5] == "Sri Lakshmi Events" and "10:00 AM to 4:00 PM" == params[3])
    # duplicate accept: reload & re-submit via second tab still open with button? reload shows confirmed state
    pub.reload(); check("public page shows booking confirmed", pub.locator("text=Booking confirmed").is_visible())
    check("no accept button after decision", pub.locator("button:has-text('Accept quotation')").count() == 0)

    # race: open two tabs on a new quote and accept both
    qid2 = make_quote("Ravi birthday")
    link2 = page.input_value("input[aria-label='Customer review link']")
    t1 = newp(); t2 = newp()
    go(t1, link2); go(t2, link2)
    t1.click("button:has-text('Accept quotation')"); t1.wait_for_selector("text=Booking confirmed", timeout=20000)
    t2.click("button:has-text('Accept quotation')"); t2.wait_for_selector("text=Booking confirmed", timeout=20000)
    check("second tab accept shows confirmed state", True)
    go(page, BASE + "/bookings")
    titles = page.locator("tbody tr").all_inner_texts()
    check("exactly one booking per accepted quote", sum("Ravi birthday" in t for t in titles) == 1 and sum("Priya & Arun wedding" in t for t in titles) == 1)
    check("WhatsApp sent once per booking", len(mock("/")) == 2)

    # quote detail after accept
    go(page, BASE + f"/quotations/{qid}")
    tl = page.inner_text(".timeline")
    check("history shows accepted, booking_created, whatsapp_sent", all(s in tl for s in ["Accepted", "Booking created", "WhatsApp confirmation sent"]))
    check("no edit after accept", page.locator("a:has-text('Edit')").count() == 0)

    # --- Decline: no booking ---
    qid3 = make_quote("Corporate meet")
    link3 = page.input_value("input[aria-label='Customer review link']")
    d = newp(); go(d, link3)
    d.click("button:has-text('Decline')"); d.fill("#reason", "Budget too high"); d.click("button:has-text('Confirm decline')")
    d.wait_for_selector("text=Quotation declined", timeout=20000)
    go(page, BASE + f"/quotations/{qid3}")
    check("declined status + reason", page.locator(".pagehead .badge").inner_text().strip().upper() == "DECLINED" and "Budget too high" in page.inner_text("body"))
    go(page, BASE + "/bookings")
    check("declined quote created no booking", "Corporate meet" not in page.inner_text("body"))
    go(d, link3); check("declined quote cannot be accepted later", d.locator("button:has-text('Accept quotation')").count() == 0)

    # --- WhatsApp failure -> logged -> retry ---
    mock("/__mode", "fail")
    qid4 = make_quote("Lakshmi reception")
    page.click("button:has-text('Mark accepted')")
    wait_url(page, re.compile(r"/bookings/[0-9a-f-]{36}\?new=1"), timeout=20000)
    bid = page.url.split("/bookings/")[1].split("?")[0]
    txt = page.inner_text("#whatsapp")
    check("failure recorded with error", "FAILED" in txt.upper() and "Message undeliverable" in txt)
    go(page, BASE + "/dashboard"); check("dashboard warns about failed message", page.locator("text=WhatsApp message has failed").is_visible())
    mock("/__mode", "ok")
    go(page, BASE + f"/bookings/{bid}")
    page.click("#whatsapp button:has-text('Retry now')")
    page.wait_for_selector("#whatsapp >> text=Delivered to WhatsApp", timeout=20000)
    page.reload(); check("retry succeeded -> sent", "Delivered to WhatsApp" in page.inner_text("#whatsapp"))
    go(page, BASE + f"/quotations/{qid4}")
    tl = page.inner_text(".timeline"); check("history shows failure then success", "WhatsApp confirmation failed" in tl and "WhatsApp confirmation sent" in tl)
    # cron retry path
    mock("/__mode", "fail"); qid5 = make_quote("Cron test"); page.click("button:has-text('Mark accepted')"); wait_url(page, re.compile(r"/bookings/"), timeout=20000)
    mock("/__mode", "ok")
    r = urllib.request.urlopen(urllib.request.Request(BASE + "/api/cron/notifications", headers={"Authorization": "Bearer test-cron"}))
    out = json.loads(r.read()); check("cron retries failed message", out["sent"] == 1)

    # --- Staff ---
    go(page, BASE + "/staff")
    page.click("button:has-text('+ Add employee')")
    page.click("dialog button:has-text('Add employee') >> nth=-1")
    page.wait_for_selector("text=Enter the full name.")
    check("employee validation", True)
    page.fill("#emp-name", "Murugan"); page.fill("#emp-phone", "9000000001"); page.fill("#emp-wage", "900")
    page.click("dialog button[type=submit]"); page.wait_for_selector("text=was added as a permanent employee")
    page.wait_for_timeout(1300)
    page.click("button:has-text('+ Add employee')"); page.click("dialog button:has-text('Helper boy')")
    page.fill("#emp-name", "Selvam"); page.fill("#emp-phone", "9000000002"); page.fill("#emp-wage", "600")
    page.click("dialog button[type=submit]"); page.wait_for_selector("text=Choose the permanent employee who brought this helper.")
    check("helper needs 'brought by'", True)
    page.select_option("#emp-leader", label="Murugan"); page.click("dialog button[type=submit]"); page.wait_for_selector("text=was added as a helper boy")
    page.wait_for_timeout(1300); page.reload()
    page.click("details.team summary")
    check("team expands with helper", page.locator("details.team[open] td:has-text('Selvam')").first.is_visible())
    # assign to booking with team
    go(page, BASE + f"/bookings/{bid}")
    opts = page.locator("#staffId option").all_inner_texts()
    page.select_option("#staffId", label=[o for o in opts if o.startswith("Murugan")][0]); page.click("button:has-text('Assign')")
    page.wait_for_selector("text=Assigned 2 people.")
    page.reload()
    page.get_by_role("row", name=re.compile("^Murugan")).get_by_role("button", name="Mark present").click()
    page.wait_for_selector("tr:has-text('Murugan') >> button.good:has-text('Present')")
    page.get_by_role("row", name=re.compile("^Selvam")).get_by_role("button", name="Mark present").click()
    page.wait_for_selector("tr:has-text('Selvam') >> button.good:has-text('Present')")
    page.reload(); check("wages due = 1500", "wages due ₹1,500" in page.inner_text("body"))
    go(page, BASE + "/staff"); page.click("details.team summary")
    row = page.locator("details.team[open] tr:has-text('Selvam')")
    check("helper due 600 unpaid", "₹600" in row.inner_text() and "UNPAID" in row.inner_text().upper())
    row.get_by_role("button", name="Pay", exact=True).click()
    page.fill("dialog[open] input[name=amount]", "400"); page.click("dialog[open] button:has-text('Record payment')")
    page.wait_for_selector("text=Payment of ₹400 to Selvam recorded."); page.wait_for_timeout(1300); page.reload(); page.click("details.team summary")
    row = page.locator("details.team[open] tr:has-text('Selvam')")
    check("part paid balance 200", "₹200" in row.inner_text() and "PART PAID" in row.inner_text().upper())

    # --- Calendar, customers search, quotation filter ---
    go(page, BASE + f"/calendar?m={future[:7]}"); check("calendar shows booking", page.locator("a.ev:has-text('Priya & Arun wedding')").count() == 1)
    go(page, BASE + "/quotations?status=Declined"); check("status filter", "Corporate meet" in page.inner_text("tbody") and "Ravi" not in page.inner_text("tbody"))
    go(page, BASE + "/customers?q=salem"); check("customer search", "Priya Kumar" in page.inner_text("tbody"))
    go(page, BASE + "/customers/new?returnTo=quote"); page.fill("#name", "Anand"); page.fill("#phone", "9123456789"); page.click("button:has-text('Save customer')")
    wait_url(page, "**/quotations/new?customer=*"); check("new customer returns to quote form preselected", "Anand" in page.locator("#customerId option:checked").inner_text())

    # --- Tenant isolation ---
    other = newp()
    go(other, BASE + "/signup"); other.fill("#name", "Other Owner"); other.fill("#company", "Other Co"); other.fill("#email", "x" + email); other.fill("#password", "Secret123")
    other.click("button:has-text('Create account')"); wait_url(other, "**/onboarding", timeout=20000)
    go(other, BASE + f"/quotations/{qid}"); check("other company cannot open quotation", "Page not found" in other.inner_text("body"))
    go(other, BASE + f"/bookings/{bid}"); check("other company cannot open booking", "Page not found" in other.inner_text("body"))
    go(other, BASE + "/customers"); check("other company sees no customers", "No customers yet" in other.inner_text("body"))

    # --- Password reset + logout/login ---
    page.click("button:has-text('Sign out')"); wait_url(page, "**/login")
    go(page, BASE + "/dashboard"); check("logged out is redirected", "/login" in page.url)
    go(page, BASE + "/forgot-password"); page.fill("#email", email); page.click("button:has-text('Send reset link')")
    page.wait_for_selector("text=If an account exists"); check("forgot shows generic message", True)
    nl = open(os.environ.get("APPLOG", "/tmp/next.log"), errors="ignore").read(); m = re.findall(r"reset-password\?token=([\w-]+)", nl)
    go(page, BASE + "/reset-password?token=" + m[-1]); page.fill("#password", "NewSecret456"); page.fill("#confirm", "NewSecret45"); page.click("button:has-text('Set new password')")
    page.wait_for_selector("text=The passwords do not match."); page.fill("#confirm", "NewSecret456"); page.click("button:has-text('Set new password')")
    wait_url(page, "**/login?reset=1"); check("reset done", True)
    go(page, BASE + "/reset-password?token=" + m[-1]); page.fill("#password", "Another789"); page.fill("#confirm", "Another789"); page.click("button:has-text('Set new password')")
    page.wait_for_selector("text=expired or was already used"); check("reset token single-use", True)
    go(page, BASE + "/login"); page.fill("#email", email); page.fill("#password", "Secret123"); page.click("button:has-text('Sign in')")
    page.wait_for_selector("text=Incorrect email or password."); check("old password rejected", True)
    page.fill("#password", "NewSecret456"); page.click("button:has-text('Sign in')"); wait_url(page, "**/dashboard", timeout=20000)
    check("login with new password", True)
    page.screenshot(path="/home/claude/tests/shot-dashboard.png", full_page=True)
    go(page, BASE + f"/quotations/{qid}"); page.screenshot(path="/home/claude/tests/shot-quote.png", full_page=True)
    go(page, BASE + f"/bookings/{bid}"); page.screenshot(path="/home/claude/tests/shot-booking.png", full_page=True)
    go(page, BASE + "/staff"); page.click("details.team summary"); page.screenshot(path="/home/claude/tests/shot-staff.png", full_page=True)
    page.click("button:has-text('+ Add employee')"); page.click("dialog button:has-text('Helper boy')"); page.screenshot(path="/home/claude/tests/shot-addemp.png")
    go(pub, link); pub.screenshot(path="/home/claude/tests/shot-public.png", full_page=True)
    p2 = newp(); go(p2, BASE + "/login"); p2.screenshot(path="/home/claude/tests/shot-login.png")
    br.close()

errs = [e for e in console_errors if "favicon" not in e]
check("no browser console errors", not errs)
if errs: print("\n".join(errs[:10]))
fails = [n for n, ok in results if not ok]
print(f"\n{len(results) - len(fails)}/{len(results)} passed"); sys.exit(1 if fails else 0)
