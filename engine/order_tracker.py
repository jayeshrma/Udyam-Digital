"""
Zero-Call Split-Order Provisioning Tracker, 5G AirFiber Fallback & Consolidated One-Bill Engine.
Eliminates the 17.6-day activation wait, 98 >21-day delay drops, 41 unfeasible-fibre drops, and 3.0x status chase calls.
"""
from __future__ import annotations
import datetime
from typing import Any, Dict, List


REFERENCE_TODAY = datetime.date(2026, 7, 15)


class OrderTrackerEngine:
    def generate_order_plan(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        line_items: List[Dict[str, Any]] = payload.get("line_items", [])
        profile: Dict[str, Any] = payload.get("profile", {})
        pricing: Dict[str, Any] = payload.get("pricing_summary", {})
        airfiber_fallback: bool = bool(payload.get("airfiber_fallback", False))
        lock_in_defer_days: int = int(payload.get("lock_in_defer_days", 0))

        business_name = profile.get("business_name", "Saffron Bakers")
        city = profile.get("city", "Ludhiana")
        num_sites = int(profile.get("num_sites", 1))

        start_date = REFERENCE_TODAY + datetime.timedelta(days=lock_in_defer_days)

        track_a_items: List[Dict[str, Any]] = []
        track_b_items: List[Dict[str, Any]] = []
        max_days = 1

        for item in line_items:
            pid = item["product_id"]
            days = int(item.get("typical_install_days", 3))
            name = item["product_name"]
            qty = item.get("quantity", 1)

            # If AirFiber fallback is triggered for delayed fibre (P01/P02/P03/P05/P06), provision P04 in 2 days!
            is_bridged = False
            if airfiber_fallback and pid in ["P01", "P02", "P03", "P05", "P06"]:
                days = 2
                is_bridged = True

            eta_date = (start_date + datetime.timedelta(days=days)).isoformat()
            max_days = max(max_days, days)

            entry = {
                "product_id": pid,
                "product_name": name + (" [5G AirFiber Day-2 Bridge Active]" if is_bridged else ""),
                "quantity": qty,
                "unit": item.get("unit", "per site"),
                "monthly_recommended": item.get("monthly_recommended", 0),
                "typical_install_days": days,
                "eta_date": eta_date,
                "status": "LIVE — Activated Automatically" if days <= 1 else ("PLUG & PLAY DISPATCHED (48h)" if days == 2 else "ENGINEER ASSIGNED — IN PROGRESS"),
                "progress_pct": 100 if days <= 1 else (80 if days <= 2 else 45),
                "milestones": (
                    [
                        {"step": "Order & e-Sign Verified", "state": "done", "time": "10:02 AM"},
                        {"step": "Automated Cloud / eSIM Provisioning", "state": "done", "time": "10:15 AM"},
                        {"step": "Credentials & QR Sent on WhatsApp", "state": "done", "time": "10:18 AM"},
                    ]
                    if days <= 2
                    else [
                        {"step": "GIS Port & Feasibility Locked", "state": "done", "time": "Day 0 · 10:05 AM"},
                        {"step": "CPE Router / Hardware Dispatched", "state": "done", "time": "Day 1 · 09:30 AM"},
                        {"step": f"Field Engineer On-Site Cabling ({city})", "state": "active", "time": f"Scheduled · {eta_date}"},
                        {"step": "Speed Test & SLA Sign-Off on Phone", "state": "pending", "time": f"ETA · {eta_date}"},
                    ]
                ),
            }

            if days <= 2:
                track_a_items.append(entry)
            else:
                track_b_items.append(entry)

        whatsapp_notifications = [
            {
                "timestamp": "Today, 10:02 AM",
                "title": "Order Confirmed & Single Account Created",
                "message": f"Namaste {business_name}! Your Accel UdyamOne Order #ORD-2026-8841 is active. Zero follow-up calls needed—track everything live right here.",
            },
            {
                "timestamp": "Today, 10:18 AM",
                "title": f"Track A Live: {len(track_a_items)} Digital/SIM Service(s) Activated!",
                "message": "Your Business SIM eSIM QR codes, Cloud Email admin login, and security licenses are ready for immediate use.",
            },
            {
                "timestamp": "Today, 11:30 AM",
                "title": "Field Engineer Assigned with Live GPS",
                "message": f"Er. Rajesh Kumar (+91-98100-44210) is assigned for your {city} installation. Tap 'Reschedule Slot' anytime if you are busy.",
            },
        ]
        if airfiber_fallback:
            whatsapp_notifications.append({
                "timestamp": "Today, 11:45 AM",
                "title": "Instant 5G AirFiber 100 Bridge Activated",
                "message": "To prevent underground fibre trenching delays, a plug-and-play Biz 5G AirFiber 100 unit is arriving within 48 hours at ₹0 extra setup!",
            })
        if lock_in_defer_days > 0:
            whatsapp_notifications.append({
                "timestamp": "Today, 11:50 AM",
                "title": f"Contract Lock-In Switcher: Billing Deferred by {lock_in_defer_days} Days",
                "message": f"Your digital add-ons are live today, while broadband billing starts on {start_date.isoformat()} when your previous ISP contract expires.",
            })

        monthly_sub = int(pricing.get("monthly_recommended_inr", 3200))
        setup_fee = int(pricing.get("one_time_setup_inr", 0))
        gst_tax = int(round((monthly_sub + setup_fee) * 0.18))

        return {
            "order_id": "ORD-2026-8841",
            "reference_date": REFERENCE_TODAY.isoformat(),
            "billing_start_date": start_date.isoformat(),
            "lock_in_defer_days": lock_in_defer_days,
            "airfiber_fallback_active": airfiber_fallback,
            "summary_metrics": {
                "day1_digital_ready_hours": "< 2 Hours",
                "blended_full_install_days": max_days,
                "legacy_avg_install_days": 17.6,
                "expected_support_chase_calls": 0,
                "legacy_avg_chase_calls": 3.0,
            },
            "track_a_instant_digital": track_a_items,
            "track_b_physical_install": track_b_items,
            "engineer_card": {
                "engineer_name": "Er. Rajesh Kumar",
                "badge_id": "ACCEL-FE-4092",
                "phone": "+91 98100 44210",
                "rating": "4.9 ★ (412 SMB Installs)",
                "current_status": f"En route in {city} · 1.4 km from site",
                "scheduled_slot": f"{(start_date + datetime.timedelta(days=min(3, max_days))).isoformat()} · 11:00 AM – 01:00 PM",
                "can_reschedule_on_whatsapp": True,
            },
            "whatsapp_feed": whatsapp_notifications,
            "consolidated_single_bill": {
                "invoice_number": "INV-ACCEL-2026-078841",
                "single_account_id": f"ACCEL-ONE-{num_sites:02d}SITE",
                "single_support_hotline": "1800-103-UDYAM (Priority Single-Window Desk)",
                "whatsapp_support_bot": "+91 99000 UDYAM",
                "line_items_count": len(line_items),
                "monthly_recurring_inr": monthly_sub,
                "one_time_setup_inr": setup_fee,
                "gst_18_pct_inr": gst_tax,
                "total_first_bill_inr": monthly_sub + setup_fee + gst_tax,
                "payment_mandate_status": "UPI Autopay / NACH e-Mandate Active (Zero First-Payment Failure Risk)",
            },
        }
