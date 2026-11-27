"""Site-wide check of the house style: no em/en dashes, no emoji, no pill-shaped controls, no gradients,
no decorative animation; favicon present; Privacy and Terms pages reachable and linked."""
import os, re, subprocess, sys
from playwright.sync_api import sync_playwright
B = os.environ.get("BASE", "http://localhost:3100"); res = []
def check(n, c, show=None): res.append(c); print(("PASS " if c else "FAIL ") + n + ("" if c or show is None else "  >> " + str(show)[:600]))
def sql(q): return subprocess.run(["psql", "-h", "/tmp", "-p", "5433", "-U", "postgres", "eventdesk", "-Atc", q], capture_output=True, text=True).stdout.strip()
email = sys.argv[1] if len(sys.argv) > 1 else sql("select u.email from users u join tenants t on t.id=u.tenant_id where u.email like 'rep%' and t.plan='pro' order by u.created_at desc limit 1")
tid = sql(f"select tenant_id from users where email='{email}'")
qid = sql(f"select id from quotations where tenant_id='{tid}' limit 1"); token = sql(f"select public_token from quotations where id='{qid}'")
bid = sql(f"select id from bookings where tenant_id='{tid}' limit 1"); iid = sql(f"select id from invoices where tenant_id='{tid}' limit 1")
cid = sql(f"select id from customers where tenant_id='{tid}' limit 1")
sql(f"update tenants set plan='enterprise' where id='{tid}'")  # every page unlocked
EMOJI = re.compile("[\U0001F300-\U0001FAFF☀-➿⭐✅❌✔✖✓✗]")
AUDIT_JS = r"""() => {
  const bad = { radius: [], gradient: [], anim: [], purple: [] };
  const hue = c => { const m = c.match(/rgba?\((\d+), (\d+), (\d+)/); if (!m) return null; let [r, g, b] = m.slice(1, 4).map(x => x / 255); const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; if (d < 0.15) return null; let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return (h * 60 + 360) % 360; };
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const r = parseFloat(cs.borderTopLeftRadius), h = el.getBoundingClientRect().height, w = el.getBoundingClientRect().width;
    const cls = (el.className && el.className.baseVal === undefined ? el.className : '') + '';
    const round = /avatar|spinner|nd\b|logo/.test(cls) || el.tagName === 'INPUT' && ['radio','checkbox'].includes(el.type);
    if (!round && h > 0 && r >= 8 && r >= h / 2 - 1 && w > h * 1.3) bad.radius.push(el.tagName + '.' + cls + ' r=' + r + ' h=' + Math.round(h));
    if (cs.backgroundImage.includes('gradient')) bad.gradient.push(el.tagName + '.' + cls);
    for (const c of [cs.color, cs.backgroundColor, cs.borderTopColor]) { const h = hue(c); if (h !== null && h >= 245 && h <= 330) { bad.purple.push(el.tagName + '.' + cls + ' ' + c); break; } }
    if (cs.animationName !== 'none' && !/spinner/.test(cls)) bad.anim.push(el.tagName + '.' + cls + ' ' + cs.animationName);
  }
  return bad;
}"""
pages = ["/login", "/signup", "/forgot-password", "/privacy", "/terms", f"/q/{token}",
         "/dashboard", "/bookings", "/bookings/new", f"/bookings/{bid}", "/calendar", "/quotations", "/quotations/new", f"/quotations/{qid}",
         "/invoices", f"/invoices/{iid}", "/finance", "/finance/payment", "/finance/expense", "/finance/profit", "/finance/compare",
         "/reports", "/reports/bookings", "/reports/quotations", "/reports/sales", "/reports/dues", "/reports/collections", "/reports/expenses", "/reports/profit",
         "/customers", f"/customers/{cid}", "/services", "/services/tools/catering", "/services/tools/decor", "/services/tools/photo", "/services/tools/planning",
         "/staff", "/staff/team", "/staff/vendors", "/settings", "/settings/plan", "/settings/customize", "/settings/customize?tab=menu", "/settings/customize?tab=documents", "/settings/activity"]
with sync_playwright() as p:
    br = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
    anon = br.new_page(); pg = br.new_page(viewport={"width": 1440, "height": 900})
    pg.goto(B + "/login"); pg.wait_for_selector("html[data-hydrated]", state="attached"); pg.fill("#email", email); pg.fill("#password", "Secret123"); pg.click("button:has-text('Sign in')"); pg.wait_for_url("**/dashboard")
    for u in pages:
        page = anon if u in ("/login", "/signup", "/forgot-password") else pg
        page.goto(B + u); page.wait_for_load_state("networkidle")
        if page.url.rstrip("/").endswith("/login") and u != "/login": check(f"{u} opens", False, page.url); continue
        txt = page.inner_text("body")
        html_title = page.title()
        dashes = [m.group(0) for m in re.finditer(r".{0,25}[—–].{0,25}", txt + " " + html_title)]
        emo = EMOJI.findall(txt)
        bad = page.evaluate(AUDIT_JS)
        ok = not dashes and not emo and not any(bad.values()) and "404" not in html_title
        check(f"{u}", ok, {"dashes": dashes[:3], "emoji": emo[:5], **{k: v[:4] for k, v in bad.items() if v}, "title": html_title})
    # Favicon and legal links
    anon.goto(B + "/login")
    check("favicon, SVG icon and Apple touch icon linked", anon.locator("link[rel=icon][href^='/favicon.ico']").count() == 1 and anon.locator("link[rel=icon][type='image/svg+xml']").count() == 1 and anon.locator("link[rel=apple-touch-icon]").count() == 1)
    check("sign-in page links Privacy Policy and Terms", anon.locator("a[href='/privacy']").count() >= 1 and anon.locator("a[href='/terms']").count() >= 1)
    anon.goto(B + "/signup"); check("signup states agreement to Terms and Privacy", "By creating an account you agree to the Terms and Conditions and the Privacy Policy" in anon.inner_text("body"))
    anon.goto(B + f"/q/{token}"); check("customer quotation page links Privacy Policy", anon.locator("a[href='/privacy']").count() == 1)
    for u in ["/privacy", "/terms"]:
        anon.goto(B + u); t = anon.inner_text("body")
        check(f"{u} public, with operator, contact and date", "EventOS" in t and "Test Operator Private Limited" in t and "privacy@example.com" in t and "Effective from 1 Dec 2026" in t, t[:200])
print(f"{sum(res)}/{len(res)} passed")
