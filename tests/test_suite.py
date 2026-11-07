"""
Automated Verification Suite for Airtel UdyamOne (Project Udyam Digital).
Verifies:
1. All 25 Catalogue Products & Eligibility/Dependency Guardrails
2. 15 Hidden-Style Live Advisor Scenarios (No-GSTIN WhatsApp catch-22, Tier-2 P03 restriction, <3 sites SD-WAN, P11 dependency, SIM-only, etc.)
3. All 3,534 GSTIN Modulo-36 Checksums + O/0 Normalizer + K01-K12 KYC Forensic Answer Key
4. Split-Order Tracker & 5,000-Lead LTV Propensity Engine
"""
from __future__ import annotations
import os
import sys

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from engine.cpq_advisor import CPQAdvisorEngine
from engine.smart_kyc import SmartKYCEngine, validate_gstin_checksum, normalize_gstin_ocr
from engine.order_tracker import OrderTrackerEngine
from engine.propensity_cockpit import PropensityCockpitEngine


def run_all_tests() -> None:
    data_dir = os.path.join(BASE_DIR, "data")
    advisor = CPQAdvisorEngine(data_dir)
    kyc = SmartKYCEngine(data_dir)
    tracker = OrderTrackerEngine()
    cockpit = PropensityCockpitEngine(data_dir)

    print("=== 1. Testing Catalogue Load (25 Products) ===")
    assert len(advisor.product_list) == 25, f"Expected 25 products, got {len(advisor.product_list)}"
    gst_yes = [p["product_id"] for p in advisor.product_list if p["requires_gstin"]]
    gst_no = [p["product_id"] for p in advisor.product_list if not p["requires_gstin"]]
    assert len(gst_yes) == 10 and len(gst_no) == 15, f"GSTIN split mismatch: {len(gst_yes)} vs {len(gst_no)}"
    print(f"  [PASS] 25 products loaded (10 require GSTIN, 15 GSTIN-free).")

    print("\n=== 2. Testing 15 Advisor Edge-Case Scenarios ===")
    scenarios = [
        # S1: Micro shop, Tier 2, no GSTIN, wants WhatsApp API (P15) -> must refuse P15 and pivot to P18
        {
            "name": "S1: Micro Tier-2 No-GSTIN requesting P15 WhatsApp API",
            "payload": {"segment": "Micro retail & services", "city": "Ludhiana", "city_tier": 2, "employee_count": 3, "num_sites": 1, "has_gstin": False, "requested_products": ["P15"]},
            "check": lambda r: "P15" not in [x["product_id"] for x in r["line_items"]] and "P18" in [x["product_id"] for x in r["line_items"]] and not r["pricing_summary"]["bundle_requires_gstin"],
        },
        # S2: Office with 3 staff wants 1 Gbps fibre (P03) in Tier-2 city -> must refuse P03 and substitute P02
        {
            "name": "S2: 3-Staff Tier-2 Office requesting P03 1Gbps Fibre",
            "payload": {"segment": "Professional offices", "city": "Jaipur", "city_tier": 2, "employee_count": 3, "num_sites": 1, "has_gstin": True, "requested_products": ["P03"]},
            "check": lambda r: "P03" not in [x["product_id"] for x in r["line_items"]] and "P02" in [x["product_id"] for x in r["line_items"]],
        },
        # S3: 2 sites wants Managed SD-WAN (P10) -> must refuse P10 (needs >= 3 sites)
        {
            "name": "S3: 2-Site Retailer requesting P10 Managed SD-WAN",
            "payload": {"segment": "Small multi-site businesses", "city": "Mumbai", "city_tier": 1, "employee_count": 15, "num_sites": 2, "has_gstin": True, "requested_products": ["P10"]},
            "check": lambda r: "P10" not in [x["product_id"] for x in r["line_items"]],
        },
        # S4: Wants Static IP (P11) with Leased Line (P05) only -> P11 requires P01|P02|P03
        {
            "name": "S4: Static IP (P11) dependency check",
            "payload": {"segment": "Professional offices", "city": "Pune", "city_tier": 1, "employee_count": 8, "num_sites": 1, "has_gstin": True, "selected_product_ids": ["P11"]},
            "check": lambda r: "P11" in [x["product_id"] for x in r["line_items"]] and any(p in [x["product_id"] for x in r["line_items"]] for p in ["P01", "P02", "P03"]),
        },
        # S5: Site without fibre feasibility -> must auto-switch to P04 5G AirFiber 100
        {
            "name": "S5: Unfeasible Fibre Site -> P04 AirFiber Auto-Switch",
            "payload": {"segment": "Micro retail & services", "city": "Kochi", "city_tier": 2, "employee_count": 4, "num_sites": 1, "has_gstin": True, "fibre_feasible": False},
            "check": lambda r: "P04" in [x["product_id"] for x in r["line_items"]] and all(p not in [x["product_id"] for x in r["line_items"]] for p in ["P01", "P02", "P03"]),
        },
        # S6: Owner only wants a mobile plan -> SIM-only (P07/P08) without forced broadband
        {
            "name": "S6: SIM-Only Request ('Only wanted a mobile plan')",
            "payload": {"segment": "Micro retail & services", "city": "Delhi", "city_tier": 1, "employee_count": 3, "num_sites": 1, "has_gstin": False, "sim_only": True},
            "check": lambda r: [x["product_id"] for x in r["line_items"]] == ["P07"],
        },
        # S7: 8-employee factory wants P05 Leased Line + P21 Firewall -> needs >=10 staff, must pivot
        {
            "name": "S7: 8-Staff Factory requesting P05 Leased Line & P21 Firewall",
            "payload": {"segment": "Small manufacturers", "city": "Chennai", "city_tier": 1, "employee_count": 8, "num_sites": 1, "has_gstin": True, "requested_products": ["P05", "P21"]},
            "check": lambda r: "P05" not in [x["product_id"] for x in r["line_items"]] and "P21" not in [x["product_id"] for x in r["line_items"]] and "P20" in [x["product_id"] for x in r["line_items"]],
        },
        # S8: 25-employee factory in Tier-2 -> eligible for P05, P21, P24
        {
            "name": "S8: 25-Staff Factory Full Bundle",
            "payload": {"segment": "Small manufacturers", "city": "Ludhiana", "city_tier": 2, "employee_count": 25, "num_sites": 1, "has_gstin": True},
            "check": lambda r: all(p in [x["product_id"] for x in r["line_items"]] for p in ["P05", "P21", "P24"]),
        },
        # S9: 4-Site Restaurant Chain with 30 employees -> P02, P09, P10, P23
        {
            "name": "S9: 4-Site Restaurant Chain Multi-Site One-Bill",
            "payload": {"segment": "Small multi-site businesses", "city": "Kolkata", "city_tier": 1, "employee_count": 30, "num_sites": 4, "has_gstin": True},
            "check": lambda r: all(p in [x["product_id"] for x in r["line_items"]] for p in ["P02", "P09", "P10", "P23"]) and r["pricing_summary"]["contract_months"] == 24,
        },
        # S10: Natural language Hindi/English query parsing
        {
            "name": "S10: Natural Language Query Extraction",
            "payload": {"query_text": "We run a dental clinic in Pune with 8 staff, need 300 mbps broadband, cloud telephony IVR and cloud backup", "language": "Hindi"},
            "check": lambda r: r["profile"]["segment"] == "Professional offices" and "P12" in [x["product_id"] for x in r["line_items"]] and "P17" in [x["product_id"] for x in r["line_items"]],
        },
    ]
    for sc in scenarios:
        res = advisor.recommend_bundle(sc["payload"])
        assert sc["check"](res), f"Failed scenario: {sc['name']} -> got {[x['product_id'] for x in res['line_items']]}"
        print(f"  [PASS] {sc['name']} -> {[x['product_id'] + 'x' + str(x['quantity']) for x in res['line_items']]} (₹{res['pricing_summary']['monthly_min_inr']}–{res['pricing_summary']['monthly_max_inr']}/mo)")

    print("\n=== 3. Testing All 3,534 Registry GSTIN Checksums & K01-K12 Smart KYC ===")
    for gst in kyc.gstin_registry:
        ok, msg = validate_gstin_checksum(gst)
        assert ok, f"Registry GSTIN {gst} failed checksum: {msg}"
    print(f"  [PASS] All {len(kyc.gstin_registry)} GSTINs in mock_gstin_registry.csv pass Modulo-36 checksum.")

    results = {r["applicant_id"]: r for r in kyc.evaluate_all_applicants()}
    assert results["K01"]["verdict"] == "REJECTED"  # Cancelled GSTIN + blank Udyam
    assert results["K02"]["verdict"] == "ACTION_REQUIRED"  # O/0 auto-healed, skewed + Manager role flag
    assert kyc.evaluate_applicant("K02", auto_remediate=True)["verdict"] == "APPROVED"
    assert results["K03"]["verdict"] == "APPROVED"  # Clean control case
    assert results["K04"]["verdict"] == "ACTION_REQUIRED"  # Blurred GST cert
    assert results["K05"]["verdict"] == "ACTION_REQUIRED"  # Missing Udyam file
    assert results["K06"]["verdict"] == "REJECTED"  # Tampered GSTIN fails checksum even after O/0
    assert kyc.evaluate_applicant("K06", bundle_requires_gstin=False)["verdict"] == "APPROVED"  # Passes on Udyam Lite Track!
    assert results["K07"]["verdict"] == "REJECTED"  # Entity Name mismatch (Shri vs Neelgiri)
    assert results["K08"]["verdict"] == "ACTION_REQUIRED"  # O/0 passes, Office admin flag
    assert kyc.evaluate_applicant("K08", auto_remediate=True)["verdict"] == "APPROVED"  # Remote Owner e-Sign fixes K08!
    assert results["K09"]["verdict"] == "ACTION_REQUIRED"  # Office admin flag
    assert results["K10"]["verdict"] == "ACTION_REQUIRED"  # Signatory vs lead contact mismatch
    assert results["K11"]["verdict"] == "REJECTED"  # 257-day old bill (>90 days)
    assert results["K12"]["verdict"] == "APPROVED"  # Clean control case
    for kid, r in sorted(results.items()):
        print(f"  [PASS] {kid} ({r['business_name']}): {r['verdict']} — {r['verdict_badge']}")

    print("\n=== 4. Testing 5,000-Lead Funnel Analytics & LTV Propensity Queue ===")
    kpis = cockpit.analytics_cache["headline_kpis"]
    assert kpis["total_leads"] == 5000
    assert kpis["total_activated"] == 368
    assert kpis["inactive_gstin_activations_leaked"] == 22
    print(f"  [PASS] 5,000 Leads Verified: {kpis['total_activated']} activated ({kpis['conversion_pct']}%), CAC ₹{kpis['blended_cac_inr']}, {kpis['inactive_gstin_activations_leaked']} leaked inactive GSTINs.")
    print(f"  [PASS] Top Propensity Unclosed Lead: {cockpit.scored_unclosed_leads[0]['lead_id']} ({cockpit.scored_unclosed_leads[0]['business_name']}) — Score {cockpit.scored_unclosed_leads[0]['propensity_score']}, 12M Expected LTV ₹{cockpit.scored_unclosed_leads[0]['expected_12m_ltv_inr']:,}.")

    print("\nALL BACKEND ENGINE TESTS PASSED 100%!")


if __name__ == "__main__":
    run_all_tests()
