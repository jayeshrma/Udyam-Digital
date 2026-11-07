"""
Airtel UdyamOne (Project Udyam Digital) — Zero-Friction Backend Server.
Runs out-of-the-box on any Python 3.9+ environment with ZERO external pip dependencies required.
Serves the Dual-Mode Mobile/Desktop Web App, all 47 KYC Document Images, Deliverables, and REST APIs.

Usage:
    python server.py
Then open http://localhost:8000 in your browser.
"""
from __future__ import annotations
import json
import mimetypes
import os
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any, Dict
from urllib.parse import parse_qs, urlparse

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from engine.cpq_advisor import CPQAdvisorEngine, LANGUAGE_PACKS
from engine.smart_kyc import SmartKYCEngine
from engine.order_tracker import OrderTrackerEngine
from engine.propensity_cockpit import PropensityCockpitEngine


DATA_DIR = os.path.join(BASE_DIR, "data")
if not os.path.exists(os.path.join(DATA_DIR, "product_catalogue.csv")):
    # Fallback to parent workspace dataset folder if needed
    parent_data = os.path.join(os.path.dirname(BASE_DIR), "YTL_TrackA_Udyam_Digital_Data")
    if os.path.exists(os.path.join(parent_data, "product_catalogue.csv")):
        DATA_DIR = parent_data

STATIC_DIR = os.path.join(BASE_DIR, "static")
DELIVERABLES_DIR = os.path.join(BASE_DIR, "deliverables")
KYC_IMAGES_DIR = os.path.join(DATA_DIR, "kyc_documents")

print(f"[UdyamOne] Loading datasets from: {DATA_DIR} ...")
ADVISOR_ENGINE = CPQAdvisorEngine(DATA_DIR)
KYC_ENGINE = SmartKYCEngine(DATA_DIR)
TRACKER_ENGINE = OrderTrackerEngine()
COCKPIT_ENGINE = PropensityCockpitEngine(DATA_DIR)
print(
    f"[UdyamOne] Loaded {len(ADVISOR_ENGINE.product_list)} products, "
    f"{len(KYC_ENGINE.gstin_registry)} GSTIN records, "
    f"{len(KYC_ENGINE.udyam_registry)} Udyam records, and "
    f"{len(COCKPIT_ENGINE.leads)} SMB leads."
)


class UdyamRequestHandler(BaseHTTPRequestHandler):
    def log_message(self, format: str, *args: Any) -> None:
        # Clean, concise request logging
        sys.stdout.write(f"[API] {self.address_string()} - {format % args}\n")

    def _send_json(self, data: Any, status: int = 200) -> None:
        raw = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        self.wfile.write(raw)

    def _serve_file(self, file_path: str) -> None:
        if not os.path.isfile(file_path):
            self._send_json({"error": f"File not found: {os.path.basename(file_path)}"}, status=404)
            return
        mime, _ = mimetypes.guess_type(file_path)
        if not mime:
            mime = "application/octet-stream"
        if mime.startswith("text/") or mime in ["application/javascript", "application/json"]:
            mime += "; charset=utf-8"
        with open(file_path, "rb") as f:
            content = f.read()
        self.send_response(200)
        self.send_header("Content-Type", mime)
        self.send_header("Content-Length", str(len(content)))
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        self.wfile.write(content)

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        path = parsed.path
        qs = parse_qs(parsed.query)

        if path == "/api/bootstrap":
            default_bundle = ADVISOR_ENGINE.recommend_bundle({
                "business_name": "Sunrise General Store",
                "business_type": "Kirana & Supermarket",
                "segment": "Micro retail & services",
                "city": "Visakhapatnam",
                "city_tier": 2,
                "employee_count": 4,
                "num_sites": 1,
                "has_gstin": False,
                "fibre_feasible": True,
                "language": "Hindi",
            })
            default_tracker = TRACKER_ENGINE.generate_order_plan({
                "line_items": default_bundle["line_items"],
                "profile": default_bundle["profile"],
                "pricing_summary": default_bundle["pricing_summary"],
            })
            self._send_json({
                "catalogue": ADVISOR_ENGINE.product_list,
                "languages": list(LANGUAGE_PACKS.keys()),
                "language_packs": LANGUAGE_PACKS,
                "default_bundle": default_bundle,
                "default_tracker": default_tracker,
                "kyc_applicants": KYC_ENGINE.evaluate_all_applicants(),
                "analytics": COCKPIT_ENGINE.analytics_cache,
                "unclosed_queue": COCKPIT_ENGINE.query_unclosed_leads(limit=40),
            })
            return

        if path == "/api/kyc/applicants":
            self._send_json({"applicants": KYC_ENGINE.evaluate_all_applicants()})
            return

        if path == "/api/cockpit/analytics":
            self._send_json(COCKPIT_ENGINE.analytics_cache)
            return

        if path == "/api/cockpit/leads":
            segment = qs.get("segment", ["ALL"])[0]
            stage = qs.get("stage", ["ALL"])[0]
            owner = qs.get("owner", ["ALL"])[0]
            search = qs.get("search", [""])[0]
            limit = int(qs.get("limit", ["50"])[0])
            self._send_json(COCKPIT_ENGINE.query_unclosed_leads(segment, stage, owner, search, limit))
            return

        # Static & File Routing
        if path in ["/", "/index.html"]:
            self._serve_file(os.path.join(STATIC_DIR, "index.html"))
            return

        if path.startswith("/static/"):
            rel = path[len("/static/"):].lstrip("/\\")
            self._serve_file(os.path.join(STATIC_DIR, rel))
            return

        if path.startswith("/kyc_documents/"):
            rel = os.path.basename(path)
            self._serve_file(os.path.join(KYC_IMAGES_DIR, rel))
            return

        if path.startswith("/deliverables/"):
            rel = path[len("/deliverables/"):].lstrip("/\\")
            self._serve_file(os.path.join(DELIVERABLES_DIR, rel))
            return

        # Fallback inside static folder
        candidate = os.path.join(STATIC_DIR, path.lstrip("/\\"))
        if os.path.isfile(candidate):
            self._serve_file(candidate)
            return

        self._send_json({"error": f"Unknown route {path}"}, status=404)

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        path = parsed.path
        length = int(self.headers.get("Content-Length", "0"))
        body_bytes = self.rfile.read(length) if length > 0 else b"{}"
        try:
            payload: Dict[str, Any] = json.loads(body_bytes.decode("utf-8"))
        except Exception:
            payload = {}

        if path == "/api/advisor/recommend":
            res = ADVISOR_ENGINE.recommend_bundle(payload)
            self._send_json(res)
            return

        if path == "/api/kyc/verify":
            app_id = payload.get("applicant_id", "K03")
            req_gst = bool(payload.get("bundle_requires_gstin", True))
            auto_rem = bool(payload.get("auto_remediate", False))
            res = KYC_ENGINE.evaluate_applicant(app_id, bundle_requires_gstin=req_gst, auto_remediate=auto_rem)
            self._send_json(res)
            return

        if path == "/api/kyc/lookup":
            gstin = payload.get("gstin", "")
            udyam = payload.get("udyam_number", "")
            self._send_json({
                "gstin_lookup": KYC_ENGINE.lookup_gstin(gstin) if gstin else None,
                "udyam_lookup": KYC_ENGINE.lookup_udyam(udyam) if udyam else None,
            })
            return

        if path == "/api/tracker/generate":
            res = TRACKER_ENGINE.generate_order_plan(payload)
            self._send_json(res)
            return

        self._send_json({"error": f"Unknown POST route {path}"}, status=404)


def run_server(port: int = 8000) -> None:
    server_address = ("0.0.0.0", port)
    httpd = ThreadingHTTPServer(server_address, UdyamRequestHandler)
    print(f"\n======================================================================")
    print(f" 🚀 Airtel UdyamOne (Project Udyam Digital) Server Running!")
    print(f" 🌐 Local Web & Mobile Studio UI : http://localhost:{port}")
    print(f" 📊 Architecture Diagram         : http://localhost:{port}/deliverables/Architecture_Diagram.html")
    print(f" 🔒 1-Page DPDP Privacy Note     : http://localhost:{port}/deliverables/Privacy_and_Security_Note.html")
    print(f" 📑 10-Slide Business Case Deck  : http://localhost:{port}/deliverables/Business_Case_Deck.html")
    print(f"======================================================================\n")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n[UdyamOne] Shutting down server.")
        httpd.server_close()


if __name__ == "__main__":
    port_num = int(os.environ.get("PORT", "8000"))
    run_server(port_num)
