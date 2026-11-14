# Mock Meta WhatsApp Cloud API for tests. POST /__mode with body "ok" or "fail" switches behaviour.
import json, sys
from http.server import BaseHTTPRequestHandler, HTTPServer
STATE = {"mode": "ok", "log": []}
class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def _send(self, code, obj):
        b = json.dumps(obj).encode(); self.send_response(code); self.send_header("Content-Type","application/json"); self.send_header("Content-Length",str(len(b))); self.end_headers(); self.wfile.write(b)
    def do_GET(self):
        self._send(200, STATE["log"])
    def do_POST(self):
        body = self.rfile.read(int(self.headers.get("Content-Length") or 0)).decode()
        if self.path == "/__mode": STATE["mode"] = body.strip(); return self._send(200, {"mode": STATE["mode"]})
        if self.path == "/__reset": STATE["log"].clear(); return self._send(200, {})
        STATE["log"].append({"path": self.path, "auth": self.headers.get("Authorization"), "body": json.loads(body or "{}"), "mode": STATE["mode"]})
        if STATE["mode"] == "fail":
            return self._send(400, {"error": {"message": "(#131026) Message undeliverable", "code": 131026}})
        self._send(200, {"messaging_product": "whatsapp", "messages": [{"id": f"wamid.TEST{len(STATE['log'])}"}]})
HTTPServer(("127.0.0.1", int(sys.argv[1]) if len(sys.argv) > 1 else 3999), H).serve_forever()
