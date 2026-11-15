import re, subprocess, time
from playwright.sync_api import sync_playwright
B = "http://localhost:3100"; errs = []; res = []
def go(pg, u): pg.goto(B + u); pg.wait_for_selector("html[data-hydrated]", state="attached", timeout=30000); pg.wait_for_load_state("networkidle")
def check(n, c, show=None): res.append(c); print(("PASS " if c else "FAIL ") + n + ("" if c or show is None else "  >> " + str(show)[:300]))
def sql(q): return subprocess.run(["psql","-h","localhost","-p","5433","-U","postgres","-d","eventdesk","-tAc",q],capture_output=True,text=True).stdout.strip()
email = f"demo{int(time.time())}@ex.com"
with sync_playwright() as p:
    br = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"]); pg = br.new_page(viewport={"width": 1366, "height": 900})
    pg.on("dialog", lambda d: d.accept()); pg.on("pageerror", lambda e: errs.append(pg.url + " " + str(e)[:150]))
    go(pg, "/signup"); pg.fill("#name", "Meena Raj"); pg.fill("#company", "Demo Events"); pg.fill("#email", email); pg.fill("#password", "Secret123"); pg.click("button:has-text('Create account')")
    pg.wait_for_selector("#phone"); pg.wait_for_selector("html[data-hydrated]", state="attached"); pg.fill("#phone", "9876500000"); pg.fill("#city", "Salem"); pg.click("button:has-text('Save and continue')"); pg.wait_for_selector("h1:has-text('Dashboard')")
    tid = sql(f"select tenant_id from users where email='{email}'")
    go(pg, "/settings"); t0 = time.time()
    pg.click("button:has-text('Add 15 demo entries')"); pg.wait_for_selector("button:has-text('Remove demo data')", timeout=90000)
    print(f"load took {time.time() - t0:.1f}s")
    counts = {tb: int(sql(f"select count(*) from {tb} where tenant_id='{tid}'")) for tb in ["customers", "bookings", "quotations", "invoices", "invoice_payments", "vendors", "expenses", "staff", "tool_rows"]}
    print(counts)
    check("15 customers, bookings, quotations, vendors, expenses, staff", all(counts[k] == 15 for k in ["customers", "bookings", "quotations", "vendors", "expenses", "staff"]), counts)
    check("13 invoices with payments", counts["invoices"] == 13 and counts["invoice_payments"] > 13, counts)
    check("Basic limit still leaves room (7 active)", sql(f"select count(*) from bookings where tenant_id='{tid}' and status not in ('Completed','Cancelled')") == "7")
    sql(f"update tenants set plan='enterprise' where id='{tid}'")
    for u in ["/dashboard", "/calendar", "/bookings?view=all", "/quotations", "/invoices", "/finance", "/finance/profit", "/finance/compare", "/customers", "/services/tools/catering", "/services/tools/catering?tab=gen", "/services/tools/decor", "/services/tools/photo", "/services/tools/planning", "/services/tools/makeup", "/staff", "/staff/vendors", "/settings/activity"]:
        go(pg, u); bad = "Something went wrong" in pg.inner_text("body"); check(f"page {u} renders with demo data", not bad)
    go(pg, "/finance"); check("finance shows money", "₹0" not in pg.inner_text(".hero"), pg.inner_text(".hero"))
    go(pg, "/finance/compare"); check("compare has events", "earned the best margin" in pg.inner_text("body"))
    go(pg, "/dashboard"); pg.screenshot(path="/home/claude/tests/demo-dash.png", full_page=True)
    go(pg, "/customers"); pg.fill("input[name=q]", "x"); go(pg, "/customers/new"); pg.fill("#name", "Real Customer"); pg.fill("#phone", "9988776655"); pg.click("button:has-text('Save customer')"); pg.wait_for_url(re.compile(r"/customers/[0-9a-f-]{36}$"))
    go(pg, "/settings"); pg.click("button:has-text('Remove demo data')"); pg.wait_for_selector("button:has-text('Add 15 demo entries')", timeout=60000)
    left = {tb: int(sql(f"select count(*) from {tb} where tenant_id='{tid}' and id like 'demo-%'")) for tb in ["customers", "bookings", "quotations", "invoices", "tool_rows", "staff", "expenses", "vendors"]}
    check("demo rows removed", sum(left.values()) == 0, left)
    check("own customer kept", sql(f"select count(*) from customers where tenant_id='{tid}'") == "1")
print("errors:", errs[:5]); print(f"{sum(res)}/{len(res)} passed")
