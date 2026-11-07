"""
Airtel UdyamOne (Project Udyam Digital) — Enterprise Backend Server.
Powered by FastAPI (native Vercel, Docker & ASGI production support) with Uvicorn.
Serves the Dual-Mode Mobile/Desktop Web App, 47 KYC Document Images, Deliverables, and REST APIs.
"""
from __future__ import annotations

import os
import sys
from typing import Any, Dict, Optional

from fastapi import FastAPI, Request, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from engine.cpq_advisor import CPQAdvisorEngine, LANGUAGE_PACKS
from engine.smart_kyc import SmartKYCEngine
from engine.order_tracker import OrderTrackerEngine
from engine.propensity_cockpit import PropensityCockpitEngine

DATA_DIR = os.path.join(BASE_DIR, "data")
if not os.path.exists(os.path.join(DATA_DIR, "product_catalogue.csv")):
    for cand in [
        os.path.join(os.getcwd(), "data"),
        os.path.join(os.path.dirname(os.path.abspath(__file__)), "data"),
        "/var/task/data",
        os.path.join(os.path.dirname(BASE_DIR), "YTL_TrackA_Udyam_Digital_Data"),
    ]:
        if os.path.exists(os.path.join(cand, "product_catalogue.csv")):
            DATA_DIR = cand
            break

STATIC_DIR = os.path.join(BASE_DIR, "static")
if not os.path.exists(STATIC_DIR):
    for cand in [
        os.path.join(os.getcwd(), "static"),
        os.path.join(os.path.dirname(os.path.abspath(__file__)), "static"),
        "/var/task/static",
    ]:
        if os.path.exists(cand):
            STATIC_DIR = cand
            break

DELIVERABLES_DIR = os.path.join(BASE_DIR, "deliverables")
if not os.path.exists(DELIVERABLES_DIR):
    for cand in [
        os.path.join(os.getcwd(), "deliverables"),
        os.path.join(os.path.dirname(os.path.abspath(__file__)), "deliverables"),
        "/var/task/deliverables",
    ]:
        if os.path.exists(cand):
            DELIVERABLES_DIR = cand
            break

KYC_IMAGES_DIR = os.path.join(DATA_DIR, "kyc_documents")

print(f"[UdyamOne] Loading datasets from: {DATA_DIR} ...")
ADVISOR_ENGINE = CPQAdvisorEngine(DATA_DIR)
KYC_ENGINE = SmartKYCEngine(DATA_DIR)
TRACKER_ENGINE = OrderTrackerEngine()
COCKPIT_ENGINE = PropensityCockpitEngine(DATA_DIR)

# Top-level FastAPI instance exported for Vercel & ASGI runners
app = FastAPI(
    title="Airtel UdyamOne",
    description="Enterprise Track A · MSME Digital Needs Advisor & Deterministic CPQ",
    version="1.0.0",
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================================
# REST API ENDPOINTS
# ============================================================================

@app.get("/api/bootstrap")
async def api_bootstrap():
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
    return {
        "catalogue": ADVISOR_ENGINE.product_list,
        "languages": list(LANGUAGE_PACKS.keys()),
        "language_packs": LANGUAGE_PACKS,
        "default_bundle": default_bundle,
        "default_tracker": default_tracker,
        "kyc_applicants": KYC_ENGINE.evaluate_all_applicants(),
        "analytics": COCKPIT_ENGINE.analytics_cache,
        "unclosed_queue": COCKPIT_ENGINE.query_unclosed_leads(limit=40),
    }


@app.get("/api/kyc/applicants")
async def api_kyc_applicants():
    return {"applicants": KYC_ENGINE.evaluate_all_applicants()}


@app.get("/api/cockpit/analytics")
async def api_cockpit_analytics():
    return COCKPIT_ENGINE.analytics_cache


@app.get("/api/cockpit/leads")
async def api_cockpit_leads(
    segment: str = Query("ALL"),
    stage: str = Query("ALL"),
    owner: str = Query("ALL"),
    search: str = Query(""),
    limit: int = Query(50),
):
    return COCKPIT_ENGINE.query_unclosed_leads(segment, stage, owner, search, limit)


@app.post("/api/advisor/recommend")
async def api_advisor_recommend(request: Request):
    try:
        payload = await request.json()
    except Exception:
        payload = {}
    return ADVISOR_ENGINE.recommend_bundle(payload)


@app.post("/api/kyc/verify")
async def api_kyc_verify(request: Request):
    try:
        payload = await request.json()
    except Exception:
        payload = {}
    app_id = payload.get("applicant_id", "K03")
    req_gst = bool(payload.get("bundle_requires_gstin", True))
    auto_rem = bool(payload.get("auto_remediate", False))
    return KYC_ENGINE.evaluate_applicant(app_id, bundle_requires_gstin=req_gst, auto_remediate=auto_rem)


@app.post("/api/kyc/lookup")
async def api_kyc_lookup(request: Request):
    try:
        payload = await request.json()
    except Exception:
        payload = {}
    gstin = payload.get("gstin", "")
    udyam = payload.get("udyam_number", "")
    return {
        "gstin_lookup": KYC_ENGINE.lookup_gstin(gstin) if gstin else None,
        "udyam_lookup": KYC_ENGINE.lookup_udyam(udyam) if udyam else None,
    }


@app.post("/api/tracker/generate")
async def api_tracker_generate(request: Request):
    try:
        payload = await request.json()
    except Exception:
        payload = {}
    return TRACKER_ENGINE.generate_order_plan(payload)


# ============================================================================
# ROOT & STATIC FILE SERVING
# ============================================================================

@app.get("/")
@app.get("/index.html")
async def serve_index():
    for p in [
        os.path.join(BASE_DIR, "index.html"),
        os.path.join(STATIC_DIR, "index.html"),
        os.path.join(os.getcwd(), "index.html"),
        "/var/task/index.html",
        "/var/task/static/index.html",
    ]:
        if os.path.isfile(p):
            return FileResponse(p, media_type="text/html")
    return JSONResponse({"error": "index.html not found"}, status_code=404)


@app.get("/favicon.ico")
async def serve_favicon_ico():
    for p in [
        os.path.join(BASE_DIR, "favicon.ico"),
        os.path.join(STATIC_DIR, "favicon.ico"),
        os.path.join(os.getcwd(), "favicon.ico"),
        "/var/task/favicon.ico",
        "/var/task/static/favicon.ico",
    ]:
        if os.path.isfile(p):
            return FileResponse(p, media_type="image/x-icon")
    return JSONResponse({"error": "favicon.ico not found"}, status_code=404)


@app.get("/favicon.svg")
async def serve_favicon_svg():
    for p in [
        os.path.join(BASE_DIR, "favicon.svg"),
        os.path.join(STATIC_DIR, "favicon.svg"),
        os.path.join(os.getcwd(), "favicon.svg"),
        "/var/task/favicon.svg",
        "/var/task/static/favicon.svg",
    ]:
        if os.path.isfile(p):
            return FileResponse(p, media_type="image/svg+xml")
    return JSONResponse({"error": "favicon.svg not found"}, status_code=404)


# Mount static assets directory
if os.path.exists(STATIC_DIR):
    app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

# Mount deliverables directory
if os.path.exists(DELIVERABLES_DIR):
    app.mount("/deliverables", StaticFiles(directory=DELIVERABLES_DIR), name="deliverables")

# Mount KYC benchmark documents directory
if os.path.exists(KYC_IMAGES_DIR):
    app.mount("/kyc_documents", StaticFiles(directory=KYC_IMAGES_DIR), name="kyc_documents")


# ============================================================================
# LOCAL DEVELOPMENT ENTRYPOINT
# ============================================================================

def run_server(port: int = 8000) -> None:
    import uvicorn

    print(f"\n======================================================================")
    print(f" 🚀 Airtel UdyamOne FastAPI Server Running on Uvicorn!")
    print(f" 🌐 Local Web & Mobile Studio UI : http://localhost:{port}")
    print(f" 📊 Architecture Diagram         : http://localhost:{port}/deliverables/Architecture_Diagram.html")
    print(f" 🔒 1-Page DPDP Privacy Note     : http://localhost:{port}/deliverables/Privacy_and_Security_Note.html")
    print(f" 📑 10-Slide Business Case Deck  : http://localhost:{port}/deliverables/Business_Case_Deck.html")
    print(f" 📖 Interactive OpenAPI Docs     : http://localhost:{port}/docs")
    print(f"======================================================================\n")
    uvicorn.run(app, host="0.0.0.0", port=port, log_level="info")


if __name__ == "__main__":
    port_num = int(os.environ.get("PORT", "8000"))
    run_server(port_num)
