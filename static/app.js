/* ==========================================================================
   Airtel UdyamOne — Enterprise Frontend Controller
   Dual-Mode: Studio Desktop vs Viewport-Constrained Smartphone PWA
   Includes Interactive WhatsApp Vernacular Voice Story Mode
   ========================================================================== */

const STATE = {
  catalogue: [],
  languagePacks: {},
  currentLanguage: "English",
  currentViewMode: "studio", // 'studio' | 'phone'
  activeTabId: "advisor",
  currentBundle: null,
  currentTracker: null,
  kycApplicants: [],
  currentKycId: "K06",
  currentKycResult: null,
  analytics: null,
  unclosedQueue: [],
  lockInDeferDays: 0,
  airfiberBridge: false,
  sidebarCollapsed: false,
};

const JUDGE_PRESETS = {
  micro_nogst: {
    business_name: "Gupta Kirana Store",
    business_type: "Kirana & Provision Store",
    segment: "Micro retail & services",
    city: "Bareilly",
    city_tier: 2,
    employee_count: 4,
    num_sites: 1,
    has_gstin: false,
    fibre_feasible: true,
    sim_only: false,
    budget_mode: false,
    requested_products: ["P15"],
    query_text: "मेरी बरेली में 4 लोगों की किराना दुकान है, मेरे पास अभी GSTIN नहीं है, मुझे UPI बिलिंग POS और WhatsApp कैटलॉग (P15) चाहिए।",
    language: "Hindi",
    kyc_id: "K06",
  },
  prof_tier2: {
    business_name: "Dr. Mehta Dental Clinic",
    business_type: "Healthcare & Dental Clinic",
    segment: "Professional offices",
    city: "Hubballi",
    city_tier: 2,
    employee_count: 4,
    num_sites: 1,
    has_gstin: true,
    fibre_feasible: true,
    sim_only: false,
    budget_mode: false,
    requested_products: ["P03", "P12", "P17"],
    query_text: "We run a 4-staff dental clinic in Hubballi (Tier-2) and need 1 Gbps fibre (P03), Cloud Telephony IVR (P12), and Cloud PC Backup (P17).",
    language: "English",
    kyc_id: "K08",
  },
  multisite: {
    business_name: "Surya Textiles & Garments",
    business_type: "Apparel & Retail Chain (4 Branches)",
    segment: "Small multi-site businesses",
    city: "Surat",
    city_tier: 2,
    employee_count: 35,
    num_sites: 4,
    has_gstin: true,
    fibre_feasible: true,
    sim_only: false,
    budget_mode: false,
    requested_products: ["P10", "P23", "P09"],
    query_text: "We operate 4 textile branches in Surat with 35 staff. Need central SD-WAN (P10), automatic 5G failover (P09), Cloud CCTV (P23), and one consolidated GST bill.",
    language: "Gujarati",
    kyc_id: "K03",
  },
  factory: {
    business_name: "Ramesh Auto Components",
    business_type: "Auto-Parts Manufacturing Unit",
    segment: "Small manufacturers",
    city: "Ludhiana",
    city_tier: 2,
    employee_count: 25,
    num_sites: 1,
    has_gstin: true,
    fibre_feasible: true,
    sim_only: false,
    budget_mode: false,
    requested_products: ["P05", "P21", "P24"],
    query_text: "25-employee auto-parts factory in Ludhiana needing 20 Mbps Leased Line (P05), SOC Managed Firewall (P21), and Machine Monitoring IoT (P24).",
    language: "Punjabi",
    kyc_id: "K12",
  },
  simonly: {
    business_name: "Kolkata Sweet Hub",
    business_type: "Retail Sweet Shop & Delivery",
    segment: "Micro retail & services",
    city: "Kolkata",
    city_tier: 1,
    employee_count: 3,
    num_sites: 1,
    has_gstin: false,
    fibre_feasible: true,
    sim_only: true,
    budget_mode: true,
    requested_products: ["P07"],
    query_text: "We only need 3 business mobile postpaid SIMs (P07) for our delivery staff with unlimited calls and 50 GB data. Do not bundle broadband.",
    language: "Bengali",
    kyc_id: "K03",
  },
  unfeasible: {
    business_name: "Highland Tea Cafe",
    business_type: "Boutique Cafe & Roastery",
    segment: "Professional offices",
    city: "Nilgiris",
    city_tier: 2,
    employee_count: 8,
    num_sites: 1,
    has_gstin: true,
    fibre_feasible: false,
    sim_only: false,
    budget_mode: false,
    requested_products: ["P02", "P22"],
    query_text: "8-staff cafe in Nilgiris where underground wired fibre is not feasible; need fast wireless broadband and Secure Guest Wi-Fi (P22).",
    language: "Tamil",
    kyc_id: "K05",
  },
};

window.addEventListener("DOMContentLoaded", async () => {
  mountModulesIntoDOM("studio");
  await bootstrapApp();
});

function mountModulesIntoDOM(targetContainerMode) {
  const template = document.getElementById("templateAllModules");
  if (!template) return;
  const clone = template.content.cloneNode(true);

  const studioPad = document.getElementById("studioModulesContainer");
  const mobilePad = document.getElementById("mobileModulesContainer");

  if (targetContainerMode === "studio") {
    mobilePad.innerHTML = "";
    studioPad.innerHTML = "";
    studioPad.appendChild(clone);
  } else {
    studioPad.innerHTML = "";
    mobilePad.innerHTML = "";
    mobilePad.appendChild(clone);
  }
}

async function bootstrapApp() {
  try {
    const res = await fetch("/api/bootstrap");
    const data = await res.json();
    STATE.catalogue = data.catalogue || [];
    STATE.languagePacks = data.language_packs || {};
    STATE.currentBundle = data.default_bundle;
    STATE.currentTracker = data.default_tracker;
    STATE.kycApplicants = data.kyc_applicants || [];
    STATE.analytics = data.analytics;
    STATE.unclosedQueue = (data.unclosed_queue && data.unclosed_queue.leads) || [];

    await applyJudgeScenario("micro_nogst", false);
    renderKycPillBar();
    await selectKycApplicant("K06");
    renderCockpitDashboard();
    seedWhatsAppBot();
  } catch (err) {
    console.error("Bootstrap error:", err);
  }
}

/* ============================================================================
 * VIEW MODE & DUAL NAVIGATION (STUDIO DESKTOP VS SMARTPHONE PWA)
 * ============================================================================ */
function setViewMode(mode) {
  STATE.currentViewMode = mode;
  document.getElementById("btnViewStudio").classList.toggle("active", mode === "studio");
  document.getElementById("btnViewPhone").classList.toggle("active", mode === "phone");

  if (mode === "phone") {
    document.body.classList.add("phone-mode");
    mountModulesIntoDOM("phone");
    syncInputsAndRender();
  } else {
    document.body.classList.remove("phone-mode");
    mountModulesIntoDOM("studio");
    syncInputsAndRender();
  }

  switchTab(STATE.activeTabId);
}

function syncInputsAndRender() {
  renderLanguageStrings();
  if (STATE.currentBundle) {
    renderAdvisorBundle(STATE.currentBundle);
    renderQuoteAndCheckout(STATE.currentBundle);
  }
  renderKycPillBar();
  if (STATE.currentKycResult) {
    renderCurrentKycApplicant();
  }
  if (STATE.currentTracker) {
    refreshTrackerView();
  }
  if (STATE.analytics) {
    renderCockpitDashboard();
  }
}

function switchTab(tabId) {
  STATE.activeTabId = tabId;
  const tabs = ["advisor", "quote", "kyc", "tracker", "cockpit"];

  // 1. Sync Studio Desktop Tabs
  tabs.forEach((t) => {
    const btn = document.getElementById(`tabBtn_${t}`);
    if (btn) btn.classList.toggle("active", t === tabId);
  });

  // 2. Sync Native Mobile Bottom Navigation
  tabs.forEach((t) => {
    const mBtn = document.getElementById(`mTabBtn_${t}`);
    if (mBtn) mBtn.classList.toggle("active", t === tabId);
  });

  // 3. Toggle Visibility of Panes inside active container
  tabs.forEach((t) => {
    const pane = document.getElementById(`tabPane_${t}`);
    if (pane) pane.classList.toggle("hidden", t !== tabId);
  });

  // Scroll mobile body to top on tab switch
  const mobileBody = document.getElementById("smartphoneScreenBody");
  if (mobileBody) mobileBody.scrollTop = 0;

  if (tabId === "tracker") {
    refreshTrackerView();
  }
}

function toggleLeftPanel() {
  const panel = document.getElementById("leftCommandPanel");
  panel.classList.toggle("collapsed");
  STATE.sidebarCollapsed = panel.classList.contains("collapsed");
}

function onLanguageChange(lang) {
  STATE.currentLanguage = lang;
  document.getElementById("globalLanguageSelect").value = lang;
  runAdvisorFromForm();
  renderLanguageStrings();
}

function renderLanguageStrings() {
  const pack = STATE.languagePacks[STATE.currentLanguage] || STATE.languagePacks["English"];
  if (!pack) return;
  const greetEl = document.getElementById("advisorGreetingSub");
  if (greetEl) greetEl.textContent = pack.greeting;
  const singleBillEl = document.getElementById("badgeSingleBill");
  if (singleBillEl) singleBillEl.textContent = pack.single_bill_badge;
  const consentTitleEl = document.getElementById("dpdpConsentTitle");
  if (consentTitleEl) consentTitleEl.textContent = pack.consent_title;
  const consentBodyEl = document.getElementById("dpdpConsentBody");
  if (consentBodyEl) consentBodyEl.textContent = pack.consent_body;
}

/* ============================================================================
 * MODULE 1 & 2: ADVISOR, DETERMINISTIC CPQ & QUOTE CHECKOUT
 * ============================================================================ */
async function applyJudgeScenario(key, switchToAdvisor = true) {
  document.querySelectorAll(".scenario-item").forEach((el) => el.classList.remove("active"));
  const btn = document.getElementById(`preset_${key}`);
  if (btn) btn.classList.add("active");

  const p = JUDGE_PRESETS[key];
  if (!p) return;

  STATE.currentLanguage = p.language || "English";
  document.getElementById("globalLanguageSelect").value = STATE.currentLanguage;

  const getSet = (id, val, isChk = false) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (isChk) el.checked = Boolean(val);
    else el.value = val;
  };

  getSet("advBizName", p.business_name);
  getSet("advSegment", p.segment);
  getSet("advEmployees", p.employee_count);
  getSet("advSites", p.num_sites);
  getSet("advCity", `${p.city}|${p.city_tier}`);
  getSet("advRequestedPids", (p.requested_products || []).join(", "));
  getSet("advHasGstin", p.has_gstin, true);
  getSet("advFibreFeasible", p.fibre_feasible, true);
  getSet("advSimOnly", p.sim_only, true);
  getSet("advBudgetMode", p.budget_mode, true);
  getSet("advQueryText", p.query_text || "");

  await runAdvisorFromForm();
  if (p.kyc_id) {
    await selectKycApplicant(p.kyc_id);
  }
  if (switchToAdvisor) {
    switchTab("advisor");
  }
}

function onCitySelectChange() {
  runAdvisorFromForm();
}

function fillVoiceSample(type) {
  if (type === "hindi_kirana") {
    document.getElementById("globalLanguageSelect").value = "Hindi";
    STATE.currentLanguage = "Hindi";
    document.getElementById("advBizName").value = "Gupta Kirana Store";
    document.getElementById("advSegment").value = "Micro retail & services";
    document.getElementById("advEmployees").value = 4;
    document.getElementById("advCity").value = "Bareilly|2";
    document.getElementById("advQueryText").value =
      "मेरी बरेली में 4 कर्मचारियों की किराना दुकान है, मेरे पास GST नहीं है, मुझे UPI POS बिलिंग और WhatsApp कैटलॉग (P15) चाहिए।";
    document.getElementById("advHasGstin").checked = false;
    document.getElementById("advRequestedPids").value = "P15, P19";
  } else if (type === "tamil_clinic") {
    document.getElementById("globalLanguageSelect").value = "Tamil";
    STATE.currentLanguage = "Tamil";
    document.getElementById("advBizName").value = "Dr. Mehta Dental Clinic";
    document.getElementById("advSegment").value = "Professional offices";
    document.getElementById("advEmployees").value = 6;
    document.getElementById("advCity").value = "Hubballi|2";
    document.getElementById("advQueryText").value =
      "எங்கள் பல் மருத்துவமனையில் 6 ஊழியர்கள் உள்ளனர், 300 Mbps இணையம் (P02), கிளவுட் டெலிபோனி IVR (P12) மற்றும் கிளவுட் பேக்கப் (P17) தேவை.";
    document.getElementById("advHasGstin").checked = true;
    document.getElementById("advRequestedPids").value = "P02, P12, P17";
  } else if (type === "punjabi_factory") {
    document.getElementById("globalLanguageSelect").value = "Punjabi";
    STATE.currentLanguage = "Punjabi";
    document.getElementById("advBizName").value = "Ramesh Auto Components";
    document.getElementById("advSegment").value = "Small manufacturers";
    document.getElementById("advEmployees").value = 25;
    document.getElementById("advCity").value = "Ludhiana|2";
    document.getElementById("advQueryText").value =
      "ਲੁਧਿਆਣਾ ਵਿੱਚ ਸਾਡੀ 25 ਕਰਮਚਾਰੀਆਂ ਦੀ ਆਟੋ-ਪਾਰਟਸ ਫੈਕਟਰੀ ਹੈ, ਸਾਨੂੰ ਲੀਜ਼ਡ ਲਾਈਨ (P05), ਫਾਇਰਵਾਲ (P21) ਅਤੇ ਮਸ਼ੀਨ IoT ਸੈਂਸਰ (P24) ਚਾਹੀਦੇ ਹਨ।";
    document.getElementById("advHasGstin").checked = true;
    document.getElementById("advRequestedPids").value = "P05, P21, P24";
  }
  return runAdvisorFromForm();
}

function simulateVoiceInput() {
  const btn = document.getElementById("btnVoiceSim");
  if (!btn) return;
  btn.textContent = "Listening...";
  setTimeout(() => {
    fillVoiceSample("hindi_kirana");
    btn.innerHTML = `
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
      Voice AI
    `;
  }, 600);
}

async function runAdvisorFromForm(overrideProductIds = null, overrideQuantities = null) {
  const cityEl = document.getElementById("advCity");
  if (!cityEl) return;
  const cityVal = cityEl.value.split("|");
  const city = cityVal[0] || "Bareilly";
  const cityTier = parseInt(cityVal[1] || "2", 10);
  const reqRaw = document.getElementById("advRequestedPids").value;
  const reqPids = reqRaw
    .split(/[,;\s]+/)
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);

  const payload = {
    business_name: document.getElementById("advBizName").value,
    segment: document.getElementById("advSegment").value,
    employee_count: parseInt(document.getElementById("advEmployees").value || "4", 10),
    num_sites: parseInt(document.getElementById("advSites").value || "1", 10),
    city: city,
    city_tier: cityTier,
    has_gstin: document.getElementById("advHasGstin").checked,
    fibre_feasible: document.getElementById("advFibreFeasible").checked,
    sim_only: document.getElementById("advSimOnly").checked,
    budget_mode: document.getElementById("advBudgetMode").checked,
    requested_products: reqPids,
    query_text: document.getElementById("advQueryText").value,
    language: STATE.currentLanguage,
  };

  if (overrideProductIds !== null) {
    payload.selected_product_ids = overrideProductIds;
  }
  if (overrideQuantities !== null) {
    payload.custom_quantities = overrideQuantities;
  }

  const res = await fetch("/api/advisor/recommend", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const bundle = await res.json();
  STATE.currentBundle = bundle;

  renderLanguageStrings();
  renderAdvisorBundle(bundle);
  renderQuoteAndCheckout(bundle);
  await refreshTrackerData();
}

function renderAdvisorBundle(b) {
  if (!b) return;
  const ps = b.pricing_summary;
  const pack = b.language_pack || {};

  const setTxt = (id, txt) => {
    const el = document.getElementById(id);
    if (el) el.textContent = txt;
  };

  setTxt("recBundleTitle", b.bundle_title);
  const prEl = document.getElementById("recPriceRange");
  if (prEl) {
    prEl.innerHTML = `₹${ps.monthly_min_inr.toLocaleString("en-IN")} – ₹${ps.monthly_max_inr.toLocaleString("en-IN")}<span style="font-size:11px;font-weight:500;">/mo</span>`;
  }
  setTxt("recSetupAndContract", `Setup: ₹${ps.one_time_setup_inr.toLocaleString("en-IN")} · ${ps.contract_months}-Mo`);

  const kycBadge = document.getElementById("badgeKycTrack");
  if (kycBadge) {
    if (ps.bundle_requires_gstin) {
      kycBadge.className = "badge badge-amber";
      kycBadge.textContent = pack.gstin_required_badge || "Requires Active GSTIN";
    } else {
      kycBadge.className = "badge badge-green";
      kycBadge.textContent = pack.zero_gstin_badge || "Udyam Lite: Zero GSTIN";
    }
  }

  const gWrap = document.getElementById("advisorGuardrailContainer");
  if (gWrap) {
    gWrap.innerHTML = "";
    (b.guardrail_notices || []).forEach((g) => {
      const div = document.createElement("div");
      div.className = `guardrail-item ${g.type || "info"}`;
      const tagCls = g.type === "pivot" ? "badge-green" : g.type === "warning" ? "badge-amber" : "badge-blue";
      div.innerHTML = `<span class="badge ${tagCls}" style="margin-right:6px;">${g.code}</span> ${g.message}`;
      gWrap.appendChild(div);
    });
  }

  const lWrap = document.getElementById("advisorLineItemsContainer");
  if (lWrap) {
    lWrap.innerHTML = "";
    (b.line_items || []).forEach((item) => {
      const card = document.createElement("div");
      card.className = "sku-card";
      card.innerHTML = `
        <div>
          <div class="sku-name">
            <span class="badge badge-blue" style="margin-right:4px;">${item.product_id}</span>
            ${item.product_name} <span style="color:var(--slate-500);font-weight:600;">× ${item.quantity}</span>
          </div>
          <div class="sku-why">${item.plain_why}</div>
          <div style="margin-top:5px; display:flex; gap:5px; flex-wrap:wrap;">
            <span class="badge ${item.typical_install_days <= 2 ? "badge-green" : "badge-amber"}" style="font-size:10px;">
              ${item.activation_track}
            </span>
          </div>
        </div>
        <div class="sku-price">
          <div class="sku-price-main">₹${item.monthly_min.toLocaleString("en-IN")}–₹${item.monthly_max.toLocaleString("en-IN")}/mo</div>
          <div class="sku-price-sub">Setup: ₹${item.one_time_setup.toLocaleString("en-IN")}</div>
        </div>
      `;
      lWrap.appendChild(card);
    });
  }

  const kycDocSummary = document.getElementById("recKycDocSummary");
  if (kycDocSummary) {
    kycDocSummary.innerHTML = `<strong>KYC (${ps.kyc_track}):</strong> ${ps.required_documents.join(" · ")}`;
  }
}

function renderQuoteAndCheckout(b) {
  if (!b) return;
  const ps = b.pricing_summary;
  const tco = b.tco_comparison;

  const setTxt = (id, txt) => {
    const el = document.getElementById(id);
    if (el) el.textContent = txt;
  };

  setTxt("quoteHeroTitle", `${b.bundle_title} (${b.profile.business_name})`);
  const qhm = document.getElementById("quoteHeroMonthly");
  if (qhm) {
    qhm.innerHTML = `₹${ps.monthly_recommended_inr.toLocaleString("en-IN")} <span>/mo + GST</span>`;
  }
  setTxt("quoteHeroRange", `Catalogue Range: ₹${ps.monthly_min_inr.toLocaleString("en-IN")} – ₹${ps.monthly_max_inr.toLocaleString("en-IN")}/mo`);

  setTxt("tcoSavingsBadge", `Save ${tco.savings_percentage}%`);
  setTxt("tcoFragmentedVal", `₹${tco.total_multi_vendor_monthly_tco_inr.toLocaleString("en-IN")}/mo`);
  setTxt("tcoAccelVal", `₹${tco.accel_bundle_monthly_min_inr.toLocaleString("en-IN")}/mo`);
  setTxt("tcoAnnualSavedVal", `₹${tco.estimated_annual_savings_inr.toLocaleString("en-IN")}/yr`);

  const feasBtn = document.getElementById("btnQuoteFeasibilityToggle");
  if (feasBtn) {
    if (b.profile.fibre_feasible) {
      feasBtn.textContent = "Simulate Fibre Full";
      feasBtn.className = "btn btn-sm btn-outline";
    } else {
      feasBtn.textContent = "5G AirFiber Active";
      feasBtn.className = "btn btn-sm btn-primary";
    }
  }

  const tbody = document.getElementById("quoteSelectedTableBody");
  if (tbody) {
    tbody.innerHTML = "";
    (b.line_items || []).forEach((item) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><strong>${item.product_name}</strong> <span style="color:var(--slate-500);">(${item.product_id})</span></td>
        <td>
          <input type="number" min="1" max="100" value="${item.quantity}" style="width:48px;padding:2px 4px;border:1px solid var(--slate-300);border-radius:4px;"
            onchange="updateSkuQuantity('${item.product_id}', this.value)" />
        </td>
        <td><strong>₹${item.monthly_recommended.toLocaleString("en-IN")}</strong></td>
        <td><span class="badge ${item.typical_install_days <= 2 ? "badge-green" : "badge-blue"}">${item.typical_install_days}d</span></td>
      `;
      tbody.appendChild(tr);
    });
  }

  renderAddonGrid();
}

function renderAddonGrid() {
  const b = STATE.currentBundle;
  if (!b) return;
  const searchInput = document.getElementById("addonSearchInput");
  const q = searchInput ? (searchInput.value || "").toLowerCase() : "";
  const grid = document.getElementById("quoteAddonGrid");
  if (!grid) return;
  grid.innerHTML = "";

  (b.available_addons || []).forEach((addon) => {
    if (
      q &&
      !addon.product_id.toLowerCase().includes(q) &&
      !addon.product_name.toLowerCase().includes(q) &&
      !addon.category.toLowerCase().includes(q)
    ) {
      return;
    }
    const card = document.createElement("div");
    card.className = `addon-card ${addon.is_selected ? "selected" : ""} ${!addon.is_eligible && !addon.is_selected ? "ineligible" : ""}`;

    const reasonText =
      !addon.is_eligible && addon.ineligible_reasons.length
        ? `<div style="font-size:10.5px;color:var(--airtel-red-dark);font-weight:600;margin-top:2px;">${addon.ineligible_reasons[0]}</div>`
        : "";

    card.innerHTML = `
      <div>
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span class="badge ${addon.is_selected ? "badge-red" : "badge-blue"}">${addon.product_id}</span>
          <span style="font-size:10.5px; font-weight:600; color:var(--slate-500);">${addon.typical_install_days}d · ${addon.min_contract_months}m</span>
        </div>
        <div style="font-weight:700; font-size:12px; margin-top:4px; color:var(--slate-900);">${addon.product_name}</div>
        <div style="font-size:11px; color:var(--slate-500); margin-top:2px;">${addon.plain_why}</div>
        ${reasonText}
      </div>
      <div style="display:flex; justify-content:space-between; align-items:center; padding-top:6px; border-top:1px solid var(--slate-100); margin-top:4px;">
        <div style="font-weight:700; font-size:12px;">₹${addon.price_min}–₹${addon.price_max}/mo</div>
        <button class="btn btn-sm ${addon.is_selected ? "btn-primary" : "btn-outline"}" onclick="toggleAddonProduct('${addon.product_id}')">
          ${addon.is_selected ? "Added" : "+ Add"}
        </button>
      </div>
    `;
    grid.appendChild(card);
  });
}

async function toggleAddonProduct(pid) {
  if (!STATE.currentBundle) return;
  const currentIds = STATE.currentBundle.line_items.map((x) => x.product_id);
  const qtys = {};
  STATE.currentBundle.line_items.forEach((x) => {
    qtys[x.product_id] = x.quantity;
  });

  let nextIds;
  if (currentIds.includes(pid)) {
    nextIds = currentIds.filter((id) => id !== pid);
  } else {
    nextIds = [...currentIds, pid];
  }
  await runAdvisorFromForm(nextIds, qtys);
}

async function updateSkuQuantity(pid, newQty) {
  if (!STATE.currentBundle) return;
  const currentIds = STATE.currentBundle.line_items.map((x) => x.product_id);
  const qtys = {};
  STATE.currentBundle.line_items.forEach((x) => {
    qtys[x.product_id] = x.quantity;
  });
  qtys[pid] = Math.max(1, parseInt(newQty || "1", 10));
  await runAdvisorFromForm(currentIds, qtys);
}

function toggleFibreFeasibilityFromQuote() {
  const chk = document.getElementById("advFibreFeasible");
  if (!chk) return;
  chk.checked = !chk.checked;
  runAdvisorFromForm();
}

function onLockInChange(days) {
  STATE.lockInDeferDays = parseInt(days || "0", 10);
  refreshTrackerData();
}

/* ============================================================================
 * MODULE 3: DPDP SMART KYC & K01–K12 FORENSIC INSPECTOR
 * ============================================================================ */
function renderKycPillBar() {
  const bar = document.getElementById("kycPillBar");
  if (!bar) return;
  bar.innerHTML = "";
  (STATE.kycApplicants || []).forEach((app) => {
    const cls = app.verdict === "APPROVED" ? "pass" : app.verdict === "ACTION_REQUIRED" ? "warn" : "fail";
    const btn = document.createElement("button");
    btn.className = `k-pill ${cls} ${app.applicant_id === STATE.currentKycId ? "active" : ""}`;
    btn.id = `kpill_${app.applicant_id}`;
    btn.textContent = `${app.applicant_id}: ${app.business_name.split(" ")[0]}`;
    btn.onclick = () => selectKycApplicant(app.applicant_id);
    bar.appendChild(btn);
  });
}

async function selectKycApplicant(applicantId, autoRemediate = false, forceZeroGstin = null) {
  STATE.currentKycId = applicantId;
  document.querySelectorAll(".k-pill").forEach((el) => el.classList.remove("active"));
  const activePill = document.getElementById(`kpill_${applicantId}`);
  if (activePill) activePill.classList.add("active");

  const bundleReqGstin =
    forceZeroGstin !== null
      ? !forceZeroGstin
      : STATE.currentBundle
      ? STATE.currentBundle.pricing_summary.bundle_requires_gstin
      : true;

  const res = await fetch("/api/kyc/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      applicant_id: applicantId,
      bundle_requires_gstin: bundleReqGstin,
      auto_remediate: autoRemediate,
    }),
  });
  STATE.currentKycResult = await res.json();
  renderCurrentKycApplicant();
}

function renderCurrentKycApplicant() {
  const r = STATE.currentKycResult;
  if (!r) return;
  const piiToggle = document.getElementById("piiMaskToggle");
  const maskPii = piiToggle ? piiToggle.checked : true;

  const setTxt = (id, txt) => {
    const el = document.getElementById(id);
    if (el) el.textContent = txt;
  };

  setTxt("kycMinimisationBadge", r.dpdp_compliance_metadata.data_minimisation_mode);
  setTxt("kycDocPanelTitle", `Documents (${r.applicant_id} — ${r.business_name})`);
  setTxt("kycLeadMeta", `Lead ${r.lead_id} · ${r.segment} · ${r.city}, ${r.state}`);
  setTxt("kycBizHeading", `${r.applicant_id}: ${r.business_name}`);

  const vBadge = document.getElementById("kycVerdictBadge");
  if (vBadge) {
    vBadge.textContent = r.verdict_badge.replace(/^[^\w]+/, "").trim();
    vBadge.className = `badge ${r.verdict === "APPROVED" ? "badge-green" : r.verdict === "ACTION_REQUIRED" ? "badge-amber" : "badge-red"}`;
  }

  // 4 Document Thumbnails
  const docGrid = document.getElementById("kycDocImagesGrid");
  if (docGrid) {
    docGrid.innerHTML = "";
    const docTypes = [
      { key: "gst_certificate", label: "1. GST Certificate" },
      { key: "udyam_certificate", label: "2. Udyam MSME Certificate" },
      { key: "signatory_id", label: "3. Signatory ID" },
      { key: "address_proof", label: "4. Utility Bill" },
    ];
    docTypes.forEach((dt) => {
      const fileName = r.files[dt.key];
      const div = document.createElement("div");
      div.className = "doc-thumb-card";
      if (fileName) {
        const imgUrl = `/kyc_documents/${fileName}`;
        div.innerHTML = `
          <div style="font-size:11px; font-weight:600; margin-bottom:4px; color:var(--slate-700);">${dt.label}</div>
          <img src="${imgUrl}" alt="${dt.label}" onclick="openImageZoomModal('${dt.label} (${r.applicant_id})', '${imgUrl}')" />
          <div style="font-size:10px; color:var(--slate-500); margin-top:2px;">${fileName}</div>
        `;
      } else {
        div.innerHTML = `
          <div style="font-size:11px; font-weight:600; margin-bottom:4px; color:var(--airtel-red);">${dt.label}</div>
          <div style="height:130px; display:flex; align-items:center; justify-content:center; background:var(--airtel-red-soft); border-radius:4px; color:var(--airtel-red-dark); font-weight:600; font-size:11px; padding:8px;">
            FILE MISSING FROM PACKET (${r.applicant_id})
          </div>
        `;
      }
      docGrid.appendChild(div);
    });
  }

  // Remediation
  const remBox = document.getElementById("kycRemediationBox");
  if (remBox) {
    remBox.innerHTML = "";
    if (r.remediation_actions && r.remediation_actions.length > 0 && r.verdict !== "APPROVED") {
      r.remediation_actions.forEach((act) => {
        const card = document.createElement("div");
        card.className = "guardrail-item pivot";
        card.style.display = "flex";
        card.style.justifyContent = "space-between";
        card.style.alignItems = "center";
        card.style.gap = "8px";
        const isUdyamLitePivot = act.action_id === "PIVOT_UDYAM_LITE";
        card.innerHTML = `
          <div>
            <div style="font-weight:700; font-size:11.5px;">Auto-Resolution Available</div>
            <div style="font-size:11px;">${act.description}</div>
          </div>
          <button class="btn btn-sm btn-primary" onclick="selectKycApplicant('${r.applicant_id}', true, ${isUdyamLitePivot})">
            ${act.label}
          </button>
        `;
        remBox.appendChild(card);
      });
    }
  }

  // Checks
  const checksWrap = document.getElementById("kycChecksContainer");
  if (checksWrap) {
    checksWrap.innerHTML = "";
    (r.checks || []).forEach((chk) => {
      const row = document.createElement("div");
      row.className = "check-row";
      row.innerHTML = `
        <span class="check-status ${chk.status}">${chk.status}</span>
        <div>
          <div style="font-weight:700; color:var(--slate-900); font-size:11.5px;">${chk.stage}</div>
          <div style="color:var(--slate-600); font-size:11px;">${chk.detail}</div>
        </div>
      `;
      checksWrap.appendChild(row);
    });
  }

  // Cross-Check Table
  const ccTable = document.getElementById("kycCrossCheckTable");
  if (ccTable) {
    const ext = r.ocr_extracted;
    const lc = r.lead_cross_check;
    const shownGstin = maskPii ? ext.masked_gstin : ext.normalized_gstin;
    const shownUdyam = maskPii ? ext.masked_udyam : ext.udyam_number;

    ccTable.innerHTML = `
      <thead>
        <tr><th>Field</th><th>Extracted from Image</th><th>Registry / Truth</th></tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>GSTIN</strong></td>
          <td><code>${shownGstin}</code></td>
          <td><code>${lc.lead_gstin || "N/A"}</code></td>
        </tr>
        <tr>
          <td><strong>Trade Name</strong></td>
          <td>${ext.trade_name}</td>
          <td>${r.business_name}</td>
        </tr>
        <tr>
          <td><strong>Udyam No.</strong></td>
          <td><code>${shownUdyam || "BLANK"}</code></td>
          <td><code>${lc.lead_udyam || "None"}</code></td>
        </tr>
        <tr>
          <td><strong>Signatory</strong></td>
          <td>${ext.signatory_name} (<strong>${ext.signatory_role}</strong>)</td>
          <td>Lead: ${lc.lead_contact_name} (${lc.lead_contact_role})</td>
        </tr>
        <tr>
          <td><strong>Bill Recency</strong></td>
          <td>Dated ${ext.bill_date} (<strong>${ext.bill_age_days}d old</strong>)</td>
          <td>Max 90d from 2026-07-15</td>
        </tr>
      </tbody>
    `;
  }
}

async function runCustomRegistryLookup() {
  const gst = document.getElementById("customGstinInput").value.trim();
  const udy = document.getElementById("customUdyamInput").value.trim();
  const box = document.getElementById("customLookupResultBox");
  if (!box) return;
  if (!gst && !udy) {
    box.innerHTML = `<span style="color:var(--airtel-red);">Enter a GSTIN or Udyam number above.</span>`;
    return;
  }

  const res = await fetch("/api/kyc/lookup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ gstin: gst, udyam_number: udy }),
  });
  const data = await res.json();
  let html = "";
  if (data.gstin_lookup) {
    const g = data.gstin_lookup;
    const rec = g.registry_record;
    html += `<div class="guardrail-item ${g.normalized_checksum_valid && rec && rec.status === "Active" ? "pivot" : "warning"}" style="margin-top:6px;">
      <strong>GSTIN:</strong> <code>${g.normalized_gstin}</code> (${g.normalized_checksum_message})<br/>
      <strong>Status:</strong> ${rec ? `Found: <strong>${rec.status}</strong> · ${rec.legal_name}` : "NOT FOUND in registry"}
    </div>`;
  }
  if (data.udyam_lookup) {
    const u = data.udyam_lookup;
    const rec = u.registry_record;
    html += `<div class="guardrail-item ${u.found_in_registry ? "pivot" : "warning"}" style="margin-top:6px;">
      <strong>Udyam:</strong> <code>${u.udyam_number}</code> (${u.format_valid ? "Valid" : "Invalid"})<br/>
      <strong>Status:</strong> ${rec ? `Found: ${rec.enterprise_name} (${rec.city})` : "NOT FOUND in registry"}
    </div>`;
  }
  box.innerHTML = html;
}

/* ============================================================================
 * MODULE 4: ORDER TRACKER & ONE-BILL HUB
 * ============================================================================ */
async function refreshTrackerData() {
  if (!STATE.currentBundle) return;
  const res = await fetch("/api/tracker/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      line_items: STATE.currentBundle.line_items,
      profile: STATE.currentBundle.profile,
      pricing_summary: STATE.currentBundle.pricing_summary,
      airfiber_fallback: STATE.airfiberBridge,
      lock_in_defer_days: STATE.lockInDeferDays,
    }),
  });
  STATE.currentTracker = await res.json();
  refreshTrackerView();
}

function toggleTrackerAirfiberBridge() {
  STATE.airfiberBridge = !STATE.airfiberBridge;
  const btn = document.getElementById("btnTrackerAirfiberBridge");
  if (btn) {
    btn.className = STATE.airfiberBridge ? "btn btn-sm btn-primary" : "btn btn-sm btn-outline";
    btn.textContent = STATE.airfiberBridge ? "5G AirFiber Bridge Active" : "48h 5G AirFiber Bridge";
  }
  refreshTrackerData();
}

function refreshTrackerView() {
  const t = STATE.currentTracker;
  if (!t) return;

  const setTxt = (id, txt) => {
    const el = document.getElementById(id);
    if (el) el.textContent = txt;
  };

  setTxt("trackerPhysicalEtaDays", `${t.summary_metrics.blended_full_install_days} Days`);
  setTxt(
    "trackerBillingStartNote",
    t.lock_in_defer_days > 0 ? `Deferred (${t.lock_in_defer_days}d): ${t.billing_start_date}` : `Billing: ${t.billing_start_date}`
  );

  const renderTrackItems = (items, containerId) => {
    const wrap = document.getElementById(containerId);
    if (!wrap) return;
    wrap.innerHTML = "";
    if (!items || items.length === 0) {
      wrap.innerHTML = `<div style="font-size:11.5px;color:var(--slate-500);padding:6px;">Items provisioned on parallel track.</div>`;
      return;
    }
    items.forEach((item) => {
      const div = document.createElement("div");
      div.className = "sku-card";
      div.style.flexDirection = "column";
      const msHtml = (item.milestones || [])
        .map(
          (m) =>
            `<span class="badge ${m.state === "done" ? "badge-green" : m.state === "active" ? "badge-blue" : ""}" style="font-size:10px;">
              ${m.step}
            </span>`
        )
        .join(" ");
      div.innerHTML = `
        <div style="display:flex; justify-content:space-between; width:100%; align-items:center;">
          <div style="font-weight:700; font-size:12.5px;">${item.product_id} · ${item.product_name} × ${item.quantity}</div>
          <span class="badge ${item.typical_install_days <= 2 ? "badge-green" : "badge-blue"}">${item.status}</span>
        </div>
        <div style="width:100%; background:var(--slate-100); height:5px; border-radius:3px; overflow:hidden; margin:5px 0;">
          <div style="width:${item.progress_pct}%; background:${item.typical_install_days <= 2 ? "var(--emerald-600)" : "var(--blue-600)"}; height:100%;"></div>
        </div>
        <div style="display:flex; gap:5px; flex-wrap:wrap;">${msHtml}</div>
      `;
      wrap.appendChild(div);
    });
  };

  renderTrackItems(t.track_a_instant_digital, "trackerTrackAContainer");
  renderTrackItems(t.track_b_physical_install, "trackerTrackBContainer");

  const engCard = document.getElementById("trackerEngineerCard");
  if (engCard) {
    const eng = t.engineer_card;
    engCard.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
        <div>
          <div style="font-weight:700; font-size:13px;">${eng.engineer_name} <span class="badge badge-green" style="margin-left:4px;">${eng.rating}</span></div>
          <div style="font-size:11px; color:var(--slate-600); margin-top:2px;">${eng.badge_id} · ${eng.phone}</div>
          <div style="font-size:11.5px; color:var(--blue-700); font-weight:600; margin-top:2px;">${eng.current_status}</div>
        </div>
        <button class="btn btn-sm btn-outline" onclick="alert('Installation slot rescheduled via WhatsApp self-serve.')">
          Reschedule Slot
        </button>
      </div>
    `;
  }

  const waWrap = document.getElementById("trackerWhatsappFeed");
  if (waWrap) {
    waWrap.innerHTML = "";
    (t.whatsapp_feed || []).forEach((w) => {
      const d = document.createElement("div");
      d.className = "guardrail-item pivot";
      d.innerHTML = `<div style="font-size:10px;color:var(--slate-500);">${w.timestamp}</div><strong>${w.title}</strong><div style="font-size:11px;">${w.message}</div>`;
      waWrap.appendChild(d);
    });
  }
}

/* ============================================================================
 * MODULE 5: SALES COCKPIT & PROSPECTS QUEUE (CLEAN FLUENT KPI CARDS)
 * ============================================================================ */
function renderCockpitDashboard() {
  const a = STATE.analytics;
  if (!a) return;
  const k = a.headline_kpis;

  const strip = document.getElementById("cockpitHeadlineStrip");
  if (strip) {
    strip.innerHTML = `
      <div class="fluent-kpi-card">
        <div class="fluent-kpi-top">
          <span class="fluent-kpi-label">Conversion Rate</span>
          <span class="badge badge-red">Target 18.5%</span>
        </div>
        <div class="fluent-kpi-val">${k.conversion_pct}% <span style="font-size:12px; color:var(--emerald-700);">→ 18.5%</span></div>
        <div class="fluent-kpi-sub">${k.total_activated} Activated · ${k.unclosed_leads.toLocaleString()} Unclosed</div>
      </div>

      <div class="fluent-kpi-card">
        <div class="fluent-kpi-top">
          <span class="fluent-kpi-label">Blended CAC</span>
          <span class="badge badge-amber">-53% Reduction</span>
        </div>
        <div class="fluent-kpi-val">₹${k.blended_cac_inr.toLocaleString("en-IN")} <span style="font-size:12px; color:var(--emerald-700);">→ ₹5,200</span></div>
        <div class="fluent-kpi-sub">Total Spend: ₹${(k.total_acquisition_spend_inr / 100000).toFixed(1)}L</div>
      </div>

      <div class="fluent-kpi-card">
        <div class="fluent-kpi-top">
          <span class="fluent-kpi-label">GSTIN vs Non-GSTIN</span>
          <span class="badge badge-blue">Udyam Lite</span>
        </div>
        <div class="fluent-kpi-val">${k.gstin_activation_pct}% vs ${k.no_gstin_activation_pct}%</div>
        <div class="fluent-kpi-sub">Unlocks 55% Micro Retail Base</div>
      </div>

      <div class="fluent-kpi-card">
        <div class="fluent-kpi-top">
          <span class="fluent-kpi-label">Compliance Guard</span>
          <span class="badge badge-green">Zero Leaks</span>
        </div>
        <div class="fluent-kpi-val">${k.inactive_gstin_activations_leaked} Leaks</div>
        <div class="fluent-kpi-sub">Closed by Real-Time Registry Check</div>
      </div>
    `;
  }

  const segTable = document.getElementById("cockpitSegmentTable");
  if (segTable) {
    segTable.innerHTML = `
      <thead>
        <tr><th>Segment</th><th>Conv %</th><th>Mean MRR</th><th>CAC</th><th>MRR Share</th></tr>
      </thead>
      <tbody>
        ${(a.segment_economics || [])
          .map(
            (s) => `
          <tr>
            <td><strong>${s.segment}</strong></td>
            <td>${s.conversion_pct}%</td>
            <td>₹${s.mean_mrr_inr.toLocaleString("en-IN")}</td>
            <td>₹${s.cac_per_activation_inr.toLocaleString("en-IN")}</td>
            <td><span class="badge badge-blue">${s.share_of_new_mrr_pct}%</span></td>
          </tr>
        `
          )
          .join("")}
      </tbody>
    `;
  }

  const sigWrap = document.getElementById("cockpitSignalsContainer");
  if (sigWrap) {
    sigWrap.innerHTML = "";
    (a.planted_signals_summary || []).forEach((sig) => {
      const d = document.createElement("div");
      d.className = "sku-card";
      d.style.flexDirection = "column";
      d.innerHTML = `
        <div style="font-weight:700; font-size:12px;">
          <span class="badge badge-red">${sig.id}</span> ${sig.title}
        </div>
        <div style="font-size:11px; color:var(--slate-600);">${sig.finding}</div>
      `;
      sigWrap.appendChild(d);
    });
  }

  renderCockpitLeadsRows(STATE.unclosedQueue);
}

async function fetchCockpitLeads() {
  const segEl = document.getElementById("cockpitFilterSegment");
  const stgEl = document.getElementById("cockpitFilterStage");
  const srchEl = document.getElementById("cockpitSearchInput");
  if (!segEl) return;

  const params = new URLSearchParams({
    segment: segEl.value,
    stage: stgEl ? stgEl.value : "ALL",
    owner: "ALL",
    search: srchEl ? srchEl.value : "",
    limit: "25",
  });
  const res = await fetch(`/api/cockpit/leads?${params.toString()}`);
  const data = await res.json();
  const sub = document.getElementById("cockpitQueueSub");
  if (sub) {
    sub.textContent = `Matching Leads: ${data.total_matching_unclosed.toLocaleString()} · Recoverable: ₹${data.expected_recoverable_mrr_inr.toLocaleString("en-IN")}/mo`;
  }
  renderCockpitLeadsRows(data.leads || []);
}

function renderCockpitLeadsRows(leads) {
  const tbody = document.getElementById("cockpitLeadsTableBody");
  if (!tbody) return;
  tbody.innerHTML = "";
  leads.forEach((l) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>${l.business_name}</strong><br/><span style="font-size:10.5px;color:var(--slate-500);">${l.city}</span></td>
      <td>${l.segment}</td>
      <td><span style="color:var(--airtel-red-dark); font-weight:600; font-size:11px;">${l.drop_reason}</span></td>
      <td><span class="badge badge-green">${l.p_convert_pct}%</span></td>
      <td>₹${l.est_mrr_inr.toLocaleString("en-IN")}</td>
      <td><strong>₹${l.expected_12m_ltv_inr.toLocaleString("en-IN")}</strong></td>
      <td>
        <button class="btn btn-sm btn-primary" onclick='openLeadRescueModal(${JSON.stringify(l).replace(/'/g, "&apos;")})'>
          Rescue
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

/* ============================================================================
 * WHATSAPP CUSTOMER BOT & INTERACTIVE VERNACULAR VOICE STORY MODE
 * ============================================================================ */
function toggleWhatsAppDrawer() {
  const drawer = document.getElementById("waDrawer");
  if (drawer) drawer.classList.toggle("open");
}

function buildWaveformHtml(durationStr) {
  const heights = [6, 12, 9, 15, 8, 14, 11, 6, 13, 16, 10, 7, 14, 9, 12, 6];
  const bars = heights.map((h) => `<span style="height:${h}px;"></span>`).join("");
  return `
    <div class="wa-audio-player">
      <div class="wa-play-icon">▶</div>
      <div class="wa-waveform">${bars}</div>
      <span style="font-size:10px; font-weight:700; color:var(--slate-600);">${durationStr}</span>
    </div>
  `;
}

function seedWhatsAppBot() {
  const list = document.getElementById("waMessagesList");
  if (!list) return;
  list.innerHTML = `
    <div class="wa-bubble bot">
      <strong>Namaste from Airtel Business UdyamOne</strong><br/>
      Send a vernacular voice note or text message in Hindi, Tamil, Marathi, Punjabi, or English. Click any <strong>Voice Note Demo</strong> pill above to test live voice onboarding.
    </div>
    <div class="wa-bubble user">
      ${buildWaveformHtml("0:04")}
      <div style="font-size:11px; color:var(--slate-700);">"मेरी बरेली में किराना दुकान है, मेरे पास GST नहीं है, POS और तेज़ इंटरनेट चाहिए।"</div>
    </div>
    <div class="wa-bubble bot">
      <div style="font-size:10px; font-weight:700; color:var(--whatsapp-green); text-transform:uppercase;">Instant Single-Bill Quote</div>
      <strong>Dukaan Digital Starter (Gupta Kirana Store)</strong><br/>
      • Biz Fibre 100 Mbps (P01)<br/>
      • 2× Business Postpaid SIMs (P07)<br/>
      • Cloud POS Billing Tablet (P19)<br/>
      • WhatsApp Catalogue Bot (P15)<br/>
      <div style="margin-top:4px; font-weight:700; color:var(--slate-900);">₹2,495/mo · Udyam Lite (Zero GSTIN Required)</div>
      <div style="margin-top:6px; display:flex; gap:6px;">
        <button class="btn btn-sm btn-primary" style="font-size:10.5px; padding:4px 8px;" onclick="acceptWhatsAppQuote()">1-Tap Accept Quote</button>
        <button class="btn btn-sm btn-outline" style="font-size:10.5px; padding:4px 8px;" onclick="switchTab('quote')">Customize</button>
      </div>
    </div>
  `;
}

async function simulateWhatsAppVoiceStory(storyType) {
  const list = document.getElementById("waMessagesList");
  if (!list) return;

  const metaMap = {
    hindi_kirana: {
      dur: "0:04",
      langLabel: "Hindi Voice Note",
      transcript: "मेरी बरेली में 4 कर्मचारियों की किराना दुकान है, मेरे पास GST नहीं है, मुझे UPI POS बिलिंग और WhatsApp कैटलॉग चाहिए।",
    },
    tamil_clinic: {
      dur: "0:05",
      langLabel: "Tamil Voice Note",
      transcript: "எங்கள் பல் மருத்துவமனையில் 6 ஊழியர்கள் உள்ளனர், 300 Mbps இணையம், கிளவுட் டெலிபோனி IVR மற்றும் கிளவுட் பேக்கப் தேவை.",
    },
    punjabi_factory: {
      dur: "0:06",
      langLabel: "Punjabi Voice Note",
      transcript: "ਲੁਧਿਆਣਾ ਵਿੱਚ ਸਾਡੀ 25 ਕਰਮਚਾਰੀਆਂ ਦੀ ਆਟੋ-ਪਾਰਟਸ ਫੈਕਟਰੀ ਹੈ, ਸਾਨੂੰ ਲੀਜ਼ਡ ਲਾਈਨ, ਫਾਇਰਵਾਲ ਅਤੇ ਮਸ਼ੀਨ IoT ਸੈਂਸਰ ਚਾਹੀਦੇ ਹਨ।",
    },
  };

  const m = metaMap[storyType] || metaMap.hindi_kirana;

  list.innerHTML += `
    <div class="wa-bubble user">
      ${buildWaveformHtml(m.dur)}
      <div style="font-size:11px; color:var(--slate-700);"><em>[${m.langLabel}]</em> "${m.transcript}"</div>
    </div>
  `;
  list.scrollTop = list.scrollHeight;

  await fillVoiceSample(storyType);
  const b = STATE.currentBundle;
  if (!b) return;

  const itemsStr = (b.line_items || []).map((i) => `• ${i.product_name} ×${i.quantity}`).join("<br/>");
  const kycNote = b.pricing_summary.bundle_requires_gstin
    ? "Standard GSTIN Verification"
    : "Udyam Lite Track (Zero GSTIN)";

  list.innerHTML += `
    <div class="wa-bubble bot">
      <div style="font-size:10px; font-weight:700; color:var(--whatsapp-green); text-transform:uppercase;">AI Transcribed · CPQ Quote Ready</div>
      <strong>${b.bundle_title} (${b.profile.business_name})</strong><br/>
      ${itemsStr}<br/>
      <div style="margin-top:4px; font-weight:700; color:var(--slate-900);">
        ₹${b.pricing_summary.monthly_recommended_inr.toLocaleString("en-IN")}/mo · ${kycNote}
      </div>
      <div style="margin-top:6px; display:flex; gap:6px; flex-wrap:wrap;">
        <button class="btn btn-sm btn-primary" style="font-size:10.5px; padding:4px 8px;" onclick="acceptWhatsAppQuote()">1-Tap Accept Quote</button>
        <button class="btn btn-sm btn-outline" style="font-size:10.5px; padding:4px 8px;" onclick="switchTab('quote')">Open in Studio</button>
      </div>
    </div>
  `;
  list.scrollTop = list.scrollHeight;
}

function acceptWhatsAppQuote() {
  const list = document.getElementById("waMessagesList");
  if (!list) return;
  const bizName = STATE.currentBundle ? STATE.currentBundle.profile.business_name : "Gupta Kirana Store";

  list.innerHTML += `
    <div class="wa-bubble user">
      Quote accepted for ${bizName}. Send remote e-Sign link.
    </div>
    <div class="wa-bubble bot">
      <div style="font-size:10px; font-weight:700; color:var(--blue-700); text-transform:uppercase;">Aadhaar Remote e-Sign Magic Link</div>
      <strong>Owner Approval &amp; DPDP Consent</strong><br/>
      Tap below to sign digitally via Aadhaar OTP in 10 seconds:<br/>
      <code style="font-size:10.5px; color:var(--blue-700);">https://udyamone.airtel.in/esign/OTP-8841</code>
      <div style="margin-top:6px;">
        <button class="btn btn-sm btn-dark" style="font-size:10.5px; padding:4px 10px;" onclick="completeWhatsAppEsign()">Sign via Aadhaar OTP</button>
      </div>
    </div>
  `;
  list.scrollTop = list.scrollHeight;
}

function completeWhatsAppEsign() {
  const list = document.getElementById("waMessagesList");
  if (!list) return;

  list.innerHTML += `
    <div class="wa-bubble bot" style="border:1px solid var(--emerald-border); background:var(--emerald-50);">
      <div style="font-size:10px; font-weight:700; color:var(--emerald-700); text-transform:uppercase;">Order Confirmed · Split Provisioning Live</div>
      <strong>Track A (Digital &amp; eSIM):</strong> Live in &lt; 2 Hours<br/>
      <strong>Track B (Physical Fibre):</strong> Engineer Rajesh Kumar assigned<br/>
      <div style="margin-top:6px;">
        <button class="btn btn-sm btn-primary" style="font-size:10.5px; padding:4px 10px;" onclick="switchTab('tracker')">View Live Order Tracker &rarr;</button>
      </div>
    </div>
  `;
  list.scrollTop = list.scrollHeight;
}

async function sendWhatsAppMessage() {
  const inp = document.getElementById("waInputBox");
  if (!inp) return;
  const txt = inp.value.trim();
  if (!txt) return;
  inp.value = "";

  const list = document.getElementById("waMessagesList");
  list.innerHTML += `<div class="wa-bubble user">${txt}</div>`;
  list.scrollTop = list.scrollHeight;

  const queryEl = document.getElementById("advQueryText");
  if (queryEl) queryEl.value = txt;
  await runAdvisorFromForm();
  const b = STATE.currentBundle;
  const itemsStr = (b.line_items || []).map((i) => `• ${i.product_name} ×${i.quantity}`).join("<br/>");
  list.innerHTML += `
    <div class="wa-bubble bot">
      <strong>${b.bundle_title}</strong><br/>
      ${itemsStr}<br/>
      <strong>₹${b.pricing_summary.monthly_min_inr.toLocaleString("en-IN")}–₹${b.pricing_summary.monthly_max_inr.toLocaleString("en-IN")}/mo</strong>
      <div style="margin-top:6px;">
        <button class="btn btn-sm btn-primary" style="font-size:10.5px; padding:4px 8px;" onclick="acceptWhatsAppQuote()">1-Tap Accept Quote</button>
      </div>
    </div>
  `;
  list.scrollTop = list.scrollHeight;
}

function openImageZoomModal(title, url) {
  document.getElementById("modalTitle").textContent = title;
  document.getElementById("modalBodyContent").innerHTML = `
    <div style="text-align:center; background:var(--slate-50); padding:10px; border-radius:8px; border:1px solid var(--slate-200);">
      <img src="${url}" style="max-width:100%; max-height:70vh; border-radius:4px;" />
    </div>
  `;
  document.getElementById("appModal").classList.add("open");
}

function openSingleInvoiceModal() {
  const t = STATE.currentTracker;
  const b = STATE.currentBundle;
  if (!t || !b) return;
  const bill = t.consolidated_single_bill;

  document.getElementById("modalTitle").textContent = `Consolidated Single GST Invoice (${bill.invoice_number})`;
  document.getElementById("modalBodyContent").innerHTML = `
    <div class="panel">
      <div style="display:flex; justify-content:space-between; border-bottom:1px solid var(--slate-200); padding-bottom:10px; margin-bottom:10px;">
        <div>
          <div style="font-weight:800; font-size:15px; color:var(--airtel-red);">AIRTEL BUSINESS · UDYAM-ONE</div>
          <div style="font-size:11.5px; color:var(--slate-600);">Account: <strong>${bill.single_account_id}</strong></div>
        </div>
        <div style="text-align:right; font-size:11px; color:var(--slate-600);">
          <div>Support: ${bill.single_support_hotline}</div>
          <div>Billing Date: ${t.billing_start_date}</div>
        </div>
      </div>
      <table class="data-table">
        <thead><tr><th>Item</th><th>Qty</th><th>Monthly (₹)</th><th>Setup (₹)</th></tr></thead>
        <tbody>
          ${b.line_items
            .map(
              (i) => `
            <tr>
              <td>${i.product_name} (${i.product_id})</td>
              <td>${i.quantity}</td>
              <td>₹${i.monthly_recommended.toLocaleString("en-IN")}</td>
              <td>₹${i.one_time_setup.toLocaleString("en-IN")}</td>
            </tr>
          `
            )
            .join("")}
        </tbody>
      </table>
      <div style="margin-top:10px; text-align:right; font-size:12px;">
        <div>Monthly Recurring: <strong>₹${bill.monthly_recurring_inr.toLocaleString("en-IN")}</strong></div>
        <div>One-Time Setup: <strong>₹${bill.one_time_setup_inr.toLocaleString("en-IN")}</strong></div>
        <div>GST (18%): <strong>₹${bill.gst_18_pct_inr.toLocaleString("en-IN")}</strong></div>
        <div style="font-size:15px; font-weight:800; color:var(--airtel-red-dark); margin-top:4px;">
          Total First Bill: ₹${bill.total_first_bill_inr.toLocaleString("en-IN")}
        </div>
      </div>
    </div>
  `;
  document.getElementById("appModal").classList.add("open");
}

function openPartnerQrModal() {
  document.getElementById("modalTitle").textContent = "Channel Partner Phygital QR";
  document.getElementById("modalBodyContent").innerHTML = `
    <div class="panel">
      <div style="font-weight:700; font-size:13px; margin-bottom:4px;">Turning Channel Conflict into a Force Multiplier</div>
      <p style="font-size:11.5px; color:var(--slate-600); margin-bottom:10px;">
        Local IT and CCTV resellers scan their unique Partner QR on the customer's phone to complete onboarding in 3 minutes, earning full commission for assisted last-mile KYC &amp; installation.
      </p>
      <div style="background:#fff; border:1px dashed var(--slate-300); border-radius:8px; padding:14px; text-align:center;">
        <div style="font-family:monospace; font-size:13px; font-weight:700; color:var(--slate-900);">
          [ QR: https://udyamone.airtel.in/p/PARTNER-LUDHIANA-409 ]
        </div>
        <div style="font-size:11px; color:var(--emerald-700); font-weight:600; margin-top:4px;">
          Instant Attribution · Assisted KYC Bonus · Zero Paperwork
        </div>
      </div>
    </div>
  `;
  document.getElementById("appModal").classList.add("open");
}

function openLeadRescueModal(lead) {
  document.getElementById("modalTitle").textContent = `AI Rescue Action — ${lead.business_name}`;
  document.getElementById("modalBodyContent").innerHTML = `
    <div class="panel">
      <div style="display:flex; justify-content:space-between; gap:6px; margin-bottom:8px;">
        <span class="badge badge-red">Blocker: ${lead.drop_reason}</span>
        <span class="badge badge-green">12M LTV: ₹${lead.expected_12m_ltv_inr.toLocaleString("en-IN")}</span>
      </div>
      <div style="font-weight:700; font-size:12.5px;">Recommended Playbook: ${lead.action_badge}</div>
      <div style="font-size:11.5px; color:var(--slate-600); margin-top:3px;">${lead.rescue_pitch}</div>
      <div class="guardrail-item pivot" style="margin-top:10px;">
        <strong>WhatsApp Automated Message:</strong><br/>
        "Namaste ${lead.contact_name}, your pre-approved Airtel UdyamOne bundle for ${lead.business_name} (${lead.city}) is ready with <strong>${lead.action_badge}</strong>. Tap to activate in 60 seconds: https://udyamone.airtel.in/r/${lead.lead_id}"
      </div>
    </div>
  `;
  document.getElementById("appModal").classList.add("open");
}

function closeModal() {
  const modal = document.getElementById("appModal");
  if (modal) modal.classList.remove("open");
}

function runAutoDemoWalkthrough() {
  const steps = ["advisor", "quote", "kyc", "tracker", "cockpit"];
  let idx = 0;
  switchTab(steps[0]);
  const timer = setInterval(() => {
    idx++;
    if (idx >= steps.length) {
      clearInterval(timer);
      return;
    }
    switchTab(steps[idx]);
  }, 3000);
}
