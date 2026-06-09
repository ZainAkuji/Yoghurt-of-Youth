import React, { useEffect, useMemo, useState } from "react";
import { sendCAPIEvent, newEventId } from "./capi";

const BRAND = "Yoghurt of Youth";
const OWNER_EMAIL = "zainul_a@hotmail.co.uk";
const OWNER_PHONE = "+44 7756231844";

const PICKUP_START_HOUR = 9;
const PICKUP_END_HOUR = 18;
const PICKUP_INTERVAL_MIN = 30;

const ADDRESS_LINES = [
  "11 Billinge Avenue",
  "Blackburn",
  "Lancashire",
  "BB2 6SD",
];
const MAPS_QUERY = encodeURIComponent(`${ADDRESS_LINES.join(", ")}, United Kingdom`);

// ---------- Utils ----------
const gbp = (n: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n);
const cn = (...a: (string | false | null | undefined)[]) => a.filter(Boolean).join(" ");

function toHTMLFromSimpleMarkdown(s) {
  const escaped = s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\\"/g, "&quot;")
    .replace(/'/g, "&#39;");
  return escaped.replace(/\*([^*]+)\*/g, "<em>$1</em>");
}

function placeholder(text: string, bg = "#f8fafc", fg = "#334155") {
  const svg = encodeURIComponent(`
    <svg xmlns='http://www.w3.org/2000/svg' width='900' height='600'>
      <rect width='100%' height='100%' fill='${bg}'/>
      <text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-family='Inter,Arial' font-size='36' fill='${fg}'>${text}</text>
    </svg>`);
  return `data:image/svg+xml;utf8,${svg}`;
}

const PRODUCTS = [
  { id: "PLN", name: "PLN", price: 2.1, size: "250 mL", img: "/plain.png" },
  { id: "BFC", name: "BFC", price: 2.2, size: "250 mL", img: "/bfc.png" },
  { id: "STR", name: "STR", price: 2.2, size: "250 mL", img: "/str.png" },
  { id: "MNG", name: "MNG", price: 2.2, size: "250 mL", img: "/mng.png" },
];

const GROUPED = [
  {
    key: "prcxn",
    title: "PRCXN",
    blurb: <>Yoghurt fermented by <em>L. reuteri</em> DSM 17648.<br />
      1 trillion CFU.<br />
      Targets <em>H. pylori</em>.<br />
      Alternated with SPCTRL for full gut restoration.<br />
      No added sweeteners.<br />
      Lactose-free.<br />
      250ml.
    </>,
    img: "prcxn.png",
    variants: [],
  },
  {
    key: "spctrl",
    title: "SPCTRL",
    blurb: <>Yoghurt fermented by <em>L. reuteri</em> DSM 17938.<br />
      1 trillion CFU.<br />
      Targets pathogens including <em>Candida</em>.<br />
      Alternated with PRCXN for full gut restoration.<br />
      No added sweeteners.<br />
      Lactose-free.<br />
      250ml.
    </>,
    img: "spctrl.png",
    variants: [],
  },
];

function computeTotals(
  cart: Record<string, number>,
  discountPercent: number = 0,
  delivery_method: "delivery" | "collection" = "delivery",
  giftStrQty: number = 0
) {
  // expand cart into full product objects + qty
  const items = Object.entries(cart)
    .map(([id, qty]) => {
      const product = PRODUCTS.find((p) => p.id === id);
      if (!product) return null;
      return { ...product, qty };
    })
    .filter(Boolean) as Array<(typeof PRODUCTS)[number] & { qty: number }>;

  // ✅ bottles count includes gift STR
  const qtyTotal = items.reduce((s, i) => s + i.qty, 0) + (giftStrQty || 0);

  // classify by price: £2.10 = "plain", £2.20 = "flavoured"
  const plainItems = items.filter((i) => i.price === 2.1);
  const flavItems = items.filter((i) => i.price === 2.2);

  const plainQty = plainItems.reduce((s, i) => s + i.qty, 0);
  const flavQty  = flavItems.reduce((s, i) => s + i.qty, 0);

  // unit prices (taken from products so it's future-proof)
  const plainUnit = plainItems[0]?.price ?? 2.1;
  const flavUnit  = flavItems[0]?.price ?? 2.2;

  // "no bundle" full price (for savings display)
  const plainSubtotalRaw = plainQty * plainUnit;
  const flavSubtotalRaw  = flavQty * flavUnit;

  // ── DEAL: 7 for the price of 6, separately for plain and flavoured ──
  const plainBundles   = Math.floor(plainQty / 7);
  const plainRemainder = plainQty % 7;
  const plainBundleTotal =
    plainBundles * 6 * plainUnit + plainRemainder * plainUnit;

  const flavBundles   = Math.floor(flavQty / 7);
  const flavRemainder = flavQty % 7;
  const flavBundleTotal =
    flavBundles * 6 * flavUnit + flavRemainder * flavUnit;

  // discounted merchandise total (bottles only, no delivery)
  const merchTotal = plainBundleTotal + flavBundleTotal;

  // "full price" if no bundles at all (also bottles only)
  const fullPrice = plainSubtotalRaw + flavSubtotalRaw;

  const savings = Math.max(0, fullPrice - merchTotal);

  // ---- DELIVERY LOGIC ----
  const FREE_DELIVERY_THRESHOLD = 1000;

  // ✅ collection = no delivery fee, ever
  const freeDeliveryUnlocked =
    delivery_method === "collection" ? true : merchTotal >= FREE_DELIVERY_THRESHOLD;

  // ✅ collection = £0, delivery = existing logic
  const deliveryFee =
    delivery_method === "collection"
      ? 0
      : merchTotal === 0
        ? 0
        : freeDeliveryUnlocked
          ? 0
          : 4.95;

  // final amount customer pays (bottles + delivery)
  const discount = discountPercent > 0 ? Math.round(merchTotal * discountPercent) / 100 : 0;
  const total = merchTotal - discount + deliveryFee;

  // legacy combined bundle/remainder if you still show them anywhere
  const bundles   = plainBundles + flavBundles;
  const remainder = plainRemainder + flavRemainder;

  return {
    items,
    qtyTotal,
    bundles,
    remainder,

    // money
    total,
    savings,
    plainSubtotal: fullPrice,
    merchTotal,
    deliveryFee,
    freeDeliveryUnlocked,
    delivery_method,

    // breakdown
    plainQty,
    flavQty,
    plainBundles,
    flavBundles,
    plainRemainder,
    flavRemainder,

    discount,
    discountPercent,
    giftStrQty,
  };
}

// --- week rotation helpers ---

// ISO week number (1–53)
function getISOWeek(date: Date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7; // 1–7, Mon=1
  // Thursday of this week
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((+d - +yearStart + 1) / 86400000) / 7);
  return weekNo;
}

// decide which brand is active this week
function getBrandForDate(date: Date) {
  const week = getISOWeek(date);
  return week % 2 === 0 ? "SPCTRL" : "PRCXN";
}

function getBrandRotation() {
  const today = new Date();
  const week = getISOWeek(today);

  // even = SPCTRL, odd = PRCXN
  const isSPCTRLWeek = week % 2 === 0;

  const thisWeekBrand = isSPCTRLWeek ? "SPCTRL" : "PRCXN";
  const nextWeekBrand = isSPCTRLWeek ? "PRCXN" : "SPCTRL";

  return { isSPCTRLWeek, thisWeekBrand, nextWeekBrand };
}

function AboutSection() {
  return (
    <section
      id="about"
      className="relative scroll-mt-32 md:scroll-mt-24 text-white py-12"
      style={{
        backgroundImage: "linear-gradient(rgba(0,0,0,0.65), rgba(0,0,0,0.65)), url('/about_bg.png')",
        backgroundSize: "cover",
        backgroundPosition: "50% center",
        backgroundRepeat: "no-repeat",
      }}
    >
      
      
      <div className="max-w-6xl px-8">
        <h2 className="text-2xl md:text-3xl font-bold text-white">
          About Yoghurt of Youth
        </h2>

        <p className="mt-4 text-white">
          Each of our yoghurts is efficiently fermented with live{" "}
          <em>Lactobacillus reuteri</em> strains that have been studied for
          their unique, health-supporting properties.
        </p>

        <div className="mt-6 space-y-6">
          <div>
            <h4 className="font-semibold text-white">
              PRCXN — DSM 17648
            </h4>
            <p className="mt-2 text-white text-sm leading-relaxed">
              A precision-targeted strain shown in clinical research to bind to
              and reduce populations of <em>Helicobacter pylori</em>, a
              bacterium linked to stomach discomfort and ulcers. By helping
              clear <em>H. pylori</em> from the stomach lining, this culture
              supports a calmer, more balanced digestive environment.
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-white">
              SPCTRL — DSM 17938
            </h4>
            <p className="mt-2 text-white text-sm leading-relaxed">
              A broad-acting <em>L. reuteri</em> strain observed in studies to
              help limit unwanted microbes, including{" "}
              <em>Candida</em> species, while coexisting peacefully with
              beneficial flora. It contributes to microbial balance throughout
              the gut and is widely recognised for its excellent safety record.
            </p>
          </div>
        </div>

        <h3 className="mt-8 text-xl font-semibold text-white">
          Why Gut Health Matters
        </h3>
        <p className="mt-2 text-white text-sm leading-relaxed">
          Modern research consistently links gut balance to nearly every aspect
          of wellbeing. Scientific studies suggest that a well-functioning
          microbiome influences:
        </p>

        <div className="mt-2 text-sm text-white leading-relaxed">
          <ul className="list-disc list-inside space-y-1">
            <li><strong>General wellbeing &amp; energy</strong> – balanced digestion and reduced bloating promote comfort and nutrient absorption.</li>
            <li><strong>IBS &amp; IBD</strong> – dysbiosis and intestinal inflammation are central to these conditions; balanced flora can help stabilise the gut environment.</li>
            <li><strong>Nutrient deficiencies</strong> – microbial imbalances can impair absorption of iron, B-vitamins, and magnesium.</li>
            <li><strong>Chronic inflammation &amp; disease</strong> – microbial metabolites regulate immune signalling throughout the body.</li>
            <li><strong>Cardiovascular health</strong> – balanced gut flora correlates with healthy blood pressure and cholesterol.</li>
            <li><strong>Kidney stones &amp; gout</strong> – certain microbes degrade oxalate and uric acid, helping the body excrete them safely.</li>
            <li><strong>Bile sludge &amp; fat digestion</strong> – microbial enzymes aid bile circulation and emulsify fats efficiently.</li>
            <li><strong>Obesity &amp; blood sugar</strong> – gut composition affects insulin sensitivity and energy storage.</li>
            <li><strong>Cancer prevention</strong> – research connects gut integrity with reduced inflammation and improved detoxification.</li>
            <li><strong>Mental health &amp; cognition</strong> – the gut–brain axis influences mood, clarity, and focus. Studies link dysbiosis with depression, anxiety, and brain fog.</li>
            <li><strong>Stress &amp; sleep</strong> – gut microbes help regulate serotonin and melatonin production.</li>
            <li><strong>Ageing &amp; inflammaging</strong> – balanced microbiota reduce chronic low-grade inflammation, the driver of premature ageing.</li>
          </ul>
        </div>

        <p className="mt-2 text-white text-sm leading-relaxed">
          Restoring microbial balance can therefore ripple through every system
          of the body.
        </p>

        <h3 className="mt-8 text-xl font-semibold text-white">
          The Power of <em>Lactobacillus reuteri</em>
        </h3>
        
        <p className="mt-2 text-white text-sm leading-relaxed">
          When harmful microbes dominate the gut or stomach, inflammation and discomfort follow.
          Our two <em>L. reuteri</em> strains address this at the root each through a complementary mechanism:
        </p>
        
        <ul className="mt-2 list-disc list-inside text-sm text-white space-y-1">
          <li>
            <strong>DSM&nbsp;17648 (“PRCXN”)</strong> selectively binds <em>Helicobacter pylori</em>
            in the stomach, forming harmless complexes that are naturally cleared through digestion.
            This physical binding reduces bacterial load and supports mucosal recovery.
          </li>
          <li>
            <strong>DSM&nbsp;17938 (“SPCTRL”)</strong> promotes a balanced gut environment by
            limiting the overgrowth of opportunistic species, including <em>Candida</em>,
            while reinforcing a healthy microbial community along the intestinal tract.
          </li>
        </ul>
        
        <p className="mt-2 text-white text-sm leading-relaxed">
          Used together, like by alternating them daily or weekly,
          <strong>PRCXN and SPCTRL act in synergy</strong>:
          one targets <em>H.&nbsp;pylori</em> directly in the stomach, while the other restores microbial
          diversity and suppresses residual pathogens downstream. This dual approach
          helps reduce the microbial imbalance that allows <em>H.&nbsp;pylori</em> and similar organisms
          to persist, supporting both gastric comfort and long-term gut stability.
        </p>
        
        <p className="mt-2 text-white text-sm leading-relaxed">
          When both yoghurts are taken in rotation, they help create a more resilient digestive ecosystem
          less prone to chronic irritation, reflux, bloating, and secondary infections,
          laying a foundation for lasting digestive harmony and whole-body wellbeing.
        </p>

        <p className="mt-2 text-white text-sm leading-relaxed">
          Each bottle of yoghurt contains 250&nbsp;ml,
          delivering live counts on the order of <strong>one trillion CFU</strong>, a level consistent
          with genuine biological effect.
        </p>
        
        <p className="mt-2 text-white text-sm leading-relaxed">
          During the first few days, some people may notice mild digestive upsets such as increased movement,
          temporary bloating, or mild warmth in the stomach. These signs usually indicate that the
          probiotics are <strong>actively displacing unwanted microbes</strong> and restoring balance.
          Such effects are normal and typically fade early on, with health benefits gradually appearing
          over a longer time frame so long as the yoghurt is consistently taken.
        </p>
        
        <p className="mt-2 text-white text-sm leading-relaxed">
          All of our yoghurts are lactose-free to minimise negative reactions.
        </p>

        {/* NAC adjunct info */}
        <h3 className="mt-8 text-xl font-semibold text-white">
          Optional: NAC alongside your yoghurt
        </h3>
        <p className="mt-2 text-white text-sm leading-relaxed">
          <strong>N-acetylcysteine (NAC)</strong> is a mucolytic antioxidant that can help
          <em> disrupt microbial biofilms</em> in the stomach, including those formed by
          <em> Helicobacter pylori</em>. By breaking disulfide bonds in the mucus layer and
          loosening biofilm structure, NAC may improve access for the body’s defenses and for
          antimicrobials where used.<span className="text-slate-500">†</span>
        </p>
        <p className="mt-2 text-white text-sm leading-relaxed">
          Clinical studies and reviews have reported that NAC can destabilise <em>H. pylori</em> biofilms and
          has been tested as an adjunct to standard eradication regimens. Results vary by protocol,
          but the biofilm mechanism is consistently described in the literature.<span className="text-slate-500">†</span>
        </p>
        <p className="mt-2 text-white text-sm leading-relaxed">
          NAC is best taken on an empty stomach, around <strong>30 – 60 minutes before meals</strong>.
          This timing allows it to reach the stomach mucosa before food buffers its effect.
        </p>
        <p className="mt-2 text-white text-sm leading-relaxed">
          Scientific studies exploring NAC for <em>H.&nbsp;pylori</em> biofilm disruption commonly use
          daily amounts in the range of <strong>600 – 1200 mg</strong>, divided into one or two servings.
          For example, many individuals take <strong>600 mg twice daily</strong>, once in the morning and once
          in the late afternoon or evening, though exact routines can vary depending on tolerance
          and professional guidance.
        </p>
        <p className="mt-3 text-white text-xs leading-relaxed">
          Note: NAC is a supplement and not a medicine. This information is educational only and
          not medical advice. If you are on medication (e.g., anticoagulants) or pregnant/breast-feeding, seek professional
          guidance before using NAC.
        </p>


        <h3 className="mt-8 text-xl font-semibold text-white">
          Scientific Studies
        </h3>
        <p className="mt-2 text-white text-sm">
          Independent research exploring the strains we use:
        </p>

        <ol className="list-decimal pl-5 mt-2 space-y-1 text-sm text-white">
          <li>
            <span className="font-medium">Holz et&nbsp;al., 2015 (Beneficial Microbes):</span>
            &nbsp;<em>L. reuteri</em> DSM&nbsp;17648 reduced <em>H. pylori</em> colonisation in humans.
          </li>
          <li>
            <span className="font-medium">Indrio et&nbsp;al., 2014 (Journal of Pediatrics):</span>
            &nbsp;DSM&nbsp;17938 supported gastrointestinal function in infants; widely studied for tolerance and safety.
          </li>
          <li>
            <span className="font-medium">Savino et&nbsp;al., 2020 (BMC Gastroenterology):</span>
            &nbsp;Reviews on <em>L. reuteri</em> and microbial balance.
          </li>
          <li>
            <span className="font-medium">Cammarota et&nbsp;al., 2022 (World Journal of Gastroenterology):</span>
            &nbsp;N-acetylcysteine (NAC) shown to disrupt <em>H.&nbsp;pylori</em> biofilms and enhance antimicrobial access by
            cleaving disulfide bonds in the mucous layer.
          </li>
          <li>
            <span className="font-medium">Su et&nbsp;al., 2023 (Frontiers in Microbiology):</span>
            &nbsp;Review describing how combining probiotic strains with complementary mechanisms
            enhances suppression of <em>H.&nbsp;pylori</em> and supports restoration of healthy microbiota.
          </li>
        </ol>
        
        <p className="mt-3 text-white text-xs leading-relaxed">
          Disclaimer: This information summarises findings from independent scientific
          research on the bacterial strains used. It is provided for educational
          purposes and is not medical advice. Original publications available via 
          PubMed and other open scientific databases. Our products are fermented foods
          intended to support natural gut balance as part of a healthy lifestyle.
        </p>

        <h3 className="mt-8 text-xl font-semibold text-white">
          Instructions
        </h3>

        <p className="mt-2 text-white text-sm leading-relaxed">
          The yoghurt may be consumed at any time in the day, but for best effect, it is recommended to have it right in between lunch and dinner
          on an empty stomach, with at least <strong>one hour of no food or drink before and after</strong> the yoghurt.
          This allows the beneficial bacteria to reach the gut unimpeded while also easing the enteric stress it may cause.
        </p>
        
        <p className="mt-2 text-white text-sm leading-relaxed">
          Please do the following:
        </p>

        <div className="mt-2 text-sm text-white leading-relaxed">
          <ul className="list-disc list-inside space-y-1">
            <li>Natural yoghurt can separate, which is perfectly natural, so shake well before use.</li>
            <li>Keep refrigerated.</li>
            <li>Consume within 3 days of opening.</li>
          </ul>
        </div>

        <p className="mt-2 text-white text-sm leading-relaxed">
          The SPCTRL yoghurt (and PRCXN to a lesser extent) can be used to make a powerful, natural <strong>mask</strong> that takes advantage of its antibacterial and antifungal properties topically. To do that, follow these steps:
        </p>

        <div className="mt-2 text-sm text-white leading-relaxed">
          <ul className="list-disc list-inside space-y-1">
            <li>Add 1 tbsp of yoghurt into a cup</li>
            <li>Add 3 flat tsp of cornflour into the cup</li>
            <li>Mix until the mixture is thick and sticky (take care not to overdo it)</li>
            <li>Apply a thick layer on the face or any skin that requires treating until the skin is concealed under the mask</li>
            <li>Leave on the skin for an hour</li>
            <li>Peel off the dried mask; it will be brittle so it should just crack off easily</li>
            <li>Leave the powdery residue on</li>
            <li>Avoid washing the area for as long as possible to maximise health benefit</li>
          </ul>
        </div>

        <p className="mt-2 text-white text-sm leading-relaxed">
          Do that everyday for as long as you may to see significant dermal health benefits.
        </p>

        <h3 className="mt-8 text-xl font-semibold text-white">Contact</h3>
        <p className="mt-2 text-white text-sm leading-relaxed">
          For personalised support or product advice, get in touch below.
        </p>
        <div className="mt-2 space-y-2 text-white text-sm">
          <p>
            📧 Email:{" "}
            <a href="mailto:support@yoghurtofyouth.co.uk" className="underline hover:text-slate-900">
              support@yoghurtofyouth.co.uk
            </a>
          </p>
          <p>
            📞 Phone:{" "}
            <a
              href="tel:+447756231844"
              className="underline hover:text-amber-300 transition"
            >
              07756 231844
            </a>
          </p>
          <p className="text-xs text-white">We aim to respond within one working day.</p>
        </div>
      </div>
    </section>
  );
}

type ConfirmOrder = {
  orderId?: string;
  formattedDate: string;
  deliveryWindow: string;
  lines: string[];
  qtyTotal: number;
  plainQty: number;
  flavQty: number;
  totalText: string;
  address: string;
  name: string;
  paymentMethod: string;
  delivery_method?: "delivery" | "collection";
};

function buildConfirmOrderFromDraft(
  draft: any,
  orderId: string,
  paymentMethod: string
): ConfirmOrder | null {
  if (!draft) return null;

  // ---------- SUBSCRIPTION DRAFT ----------
  if (draft?.kind === "subscription") {
    const plan = draft?.plan || {};
    const planKey = String(plan?.key || "");
    const planLabel = String(plan?.label || planKey || "Plan");

    const firstISO = String(draft?.first_delivery_iso || "");
    const firstText =
      String(draft?.first_delivery_text || "") ||
      (firstISO ? `${formatDateUK(firstISO)} (${weekdayFromISO(firstISO)})` : "");

    const deliveryWindow = String(draft?.delivery_window || "18:30–20:00");

    // derive weekly box contents (7 bottles)
    const lines: string[] = (() => {
      if (planKey === "MIX") return ["Weekly box: 2× BFC, 3× STR, 2× MNG (7 bottles)"];
      if (planKey) return [`Weekly box: 7× ${planKey} (${planLabel})`];
      return ["Weekly box (7 bottles)"];
    })();

    // parse price label
    const priceLabel = String(plan?.priceLabel || "");
    const numeric = Number(priceLabel.replace(/[^\d.]/g, "")) || 0;

    const address = String(draft?.customer?.address || "");
    const name = String(draft?.customer?.name || "");

    // qty breakdown (nice to show)
    const qtyTotal = 7;
    const plainQty = planKey === "PLN" ? 7 : planKey === "MIX" ? 1 : 0;
    const flavQty =
      planKey === "MIX" ? 6 : ["BFC", "STR", "MNG"].includes(planKey) ? 7 : 0;

    return {
      orderId: orderId || "",
      formattedDate: firstText || "Monday",
      deliveryWindow,
      lines,
      qtyTotal,
      plainQty,
      flavQty,
      totalText: numeric ? gbp(numeric) : priceLabel || "—",
      address,
      name,
      paymentMethod,
      delivery_method: (draft?.delivery_method || "delivery"),
    };
  }

  // ---------- ONE-OFF DRAFT (existing behaviour) ----------
  const lines: string[] = Array.isArray(draft.lines) ? draft.lines : [];

  const iso = String(draft.delivery_date_iso || "");
  const formattedDate = iso
    ? `${formatDateUK(iso)} (${weekdayFromISO(iso)})`
    : String(draft.delivery_date || "");

  const totals = draft.totals || {};
  const qtyTotal = Number(totals.qtyTotal ?? 0);
  const plainQty = Number(totals.plainQty ?? 0);
  const flavQty = Number(totals.flavQty ?? 0);
  const total = Number(totals.total ?? 0);

  const address = String(draft?.customer?.address || "");
  const name = String(draft?.customer?.name || "");

  return {
    orderId: orderId || "",
    formattedDate,
    deliveryWindow: String(draft.delivery_window || "18:30–20:00"),
    lines,
    qtyTotal,
    plainQty,
    flavQty,
    totalText: gbp(total),
    address,
    name,
    paymentMethod,
    delivery_method: (draft?.delivery_method || "delivery"),
  };
}

function nextEligibleMondayISO(): string {
  const now = new Date();

  // candidate = next Monday
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);

  const day = d.getDay(); // 0 Sun .. 6 Sat
  let daysUntilMonday = (8 - day) % 7;
  if (daysUntilMonday === 0) daysUntilMonday = 7;
  d.setDate(d.getDate() + daysUntilMonday);

  // Stripe rule: must be >= 24h away → if too soon, push 7 days
  const cutoff = new Date(d);
  cutoff.setDate(d.getDate() - 2); // Saturday before Monday
  cutoff.setHours(21, 0, 0, 0);    // 21:00 Saturday
  
  if (now.getTime() >= cutoff.getTime()) {
    d.setDate(d.getDate() + 7);
  }

  // ISO yyyy-mm-dd
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

export default function App(){
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<Record<string,number>>(()=>{ try{ return JSON.parse(localStorage.getItem("yoy_cart") || "{}"); }catch{ return {}; }});
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [reserveOpen, setReserveOpen] = useState(false);
  const [nutritionModal, setNutritionModal] = React.useState<null | { title: string; src: string }>(null);
  const [displayQty, setDisplayQty] = useState<Record<string, number>>({});
  
  useEffect(()=>{ localStorage.setItem("yoy_cart", JSON.stringify(cart)); }, [cart]);

  const [payMode, setPayMode] = useState<"checkout" | "success" | "subscription">("checkout");
  const [subscriptionPlan, setSubscriptionPlan] = useState<"PLN" | "BFC" | "STR" | "MNG" | "MIX" | null>(null);
  const [confirmedOrder, setConfirmedOrder] = useState<ConfirmOrder | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const pay = params.get("pay");
    const provider = params.get("provider");
  
    if (pay !== "success") return;
  
    async function run() {
      try {
        let paid = false;
        let orderId = "";
  
        if (provider === "stripe" || provider === "stripe_sub") {
          const sessionId = params.get("session_id");
          if (!sessionId) return;
  
          const r = await fetch(
            `/api/stripe/verify-session?session_id=${encodeURIComponent(sessionId)}`
          );
          const data = await r.json();
          if (!data?.paid) return;
  
          paid = true;
          orderId = data.order_id || "";
        }
  
        if (!paid) return;
  
        const rawDraft = sessionStorage.getItem("yoy_checkout_draft");
        if (!rawDraft) return;
  
        const draft = JSON.parse(rawDraft);
        const order = buildConfirmOrderFromDraft(
          draft,
          orderId,
          provider === "stripe" ? "Stripe" : provider === "stripe_sub" ? "Weekly Gut Punch (Stripe)" : "PayPal"
        );
  
        if (!order) return;
  
        setConfirmedOrder(order);
        setPayMode("success");
        setReserveOpen(true);

        // Meta Pixel - Purchase event
        if (typeof window !== 'undefined' && window.fbq) {
          const orderValue = order?.totalText
            ? parseFloat(order.totalText.replace(/[^0-9.]/g, ''))
            : 0;
          window.fbq('track', 'Purchase', {
            value: orderValue,
            currency: 'GBP',
          }, { eventID: order.orderId });
        }
  
        // clear basket AFTER success (only for one-off checkout)
        if (provider === "stripe" || provider === "paypal") {
          setCart({});
          setDisplayQty({});
          localStorage.removeItem("yoy_cart");
        }
        
        // always clear draft after success
        sessionStorage.removeItem("yoy_checkout_draft");
  
        // clean URL
        const url = new URL(window.location.href);
        url.search = "";
        window.history.replaceState({}, "", url.toString());
      } catch (e) {
        console.error(e);
      }
    }
  
    run();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const pay = params.get("pay");
  
    if (pay !== "cancel") return;
  
    const raw = sessionStorage.getItem("yoy_checkout_draft");
  
    // Default fallback
    let nextPayKind: "oneoff" | "subscription" = "oneoff";
    let nextSelectedPlan: any = null;
  
    if (raw) {
      try {
        const draft = JSON.parse(raw);
  
        // ✅ Decide from the draft, not the URL
        if (draft?.kind === "subscription" && draft?.plan) {
          nextPayKind = "subscription";
          nextSelectedPlan = draft.plan;
        } else {
          nextPayKind = "oneoff";
        }
      } catch (e) {
        console.error("Failed to parse cancel draft", e);
      }
    }
  
    // ✅ Apply state
    setPayKind(nextPayKind);
    setSelectedPlan(nextSelectedPlan);
    setPayMode("checkout");     // keep PayModal in "checkout" mode; subscription is controlled by payKind+selectedPlan
    setReserveOpen(true);
  
    // Optional: clean URL here (or let PayModal do it, but do it in ONE place only)
    const url = new URL(window.location.href);
    url.search = "";
    window.history.replaceState({}, "", url.toString());
  }, []);

  const results = useMemo(()=>{
    if(!query) return PRODUCTS;
    const q = query.toLowerCase();
    return PRODUCTS.filter(p => p.name.toLowerCase().includes(q));
  }, [query]);

  const totals = computeTotals(cart);
  const {
    items,
    qtyTotal,
    bundles,
    remainder,
    total,
    savings,
    plainBundles,
    flavBundles,
    plainRemainder,
    flavRemainder,
    merchTotal,
    deliveryFee,
    freeDeliveryUnlocked,
    plainQty,
    flavQty,
  } = totals;

  function trackAddToCart(contentName: string, value: number, numItems: number) {
    const eventId = newEventId();
    const data = { content_name: contentName, content_type: "product", value, currency: "GBP", num_items: numItems };
    if (typeof window !== "undefined" && window.fbq) {
      window.fbq("track", "AddToCart", data, { eventID: eventId });
    }
    sendCAPIEvent("AddToCart", { eventId, customData: data });
  }

  const add = (id:string)=> setCart(c=>({ ...c, [id]: (c[id]||0)+1 }));
  const sub = (id:string)=> setCart(c=>{ const n={...c}; if(!n[id]) return n; n[id]--; if(n[id]<=0) delete n[id]; return n; });
  const remove = (id:string)=> setCart(c=>{ const n={...c}; delete n[id]; return n; });
  const clear = () => {
    setCart({});
    setDisplayQty({});
    localStorage.removeItem("yoy_cart");
  };

  const SUBSCRIPTION_PLANS = [
    { key: "PLN", label: "PLN (plain)", priceLabel: "£11.34", bg: "bg-white/15" },
    { key: "BFC", label: "BFC (black forest)", priceLabel: "£11.88", bg: "bg-rose-900/40" },
    { key: "STR", label: "STR (strawberry)", priceLabel: "£11.88", bg: "bg-pink-500/35" },
    { key: "MNG", label: "MNG (mango)", priceLabel: "£11.88", bg: "bg-amber-300/45" },
    { key: "MIX", label: "MIX (mixed)", priceLabel: "£11.88", bg: "MIX_STRIPES" },
  ] as const;
  
  type SubscriptionPlanKey = typeof SUBSCRIPTION_PLANS[number]["key"];
  type SubscriptionPlan = typeof SUBSCRIPTION_PLANS[number];

  const [payKind, setPayKind] = useState<"oneoff" | "subscription">("oneoff");
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);

  function openCheckout(mode: "checkout" | "subscription", plan?: "PLN" | "BFC" | "STR" | "MNG" | "MIX") {
    // always close any other UI that could be open
    setDrawerOpen(false);
  
    // set state in a predictable order
    setPayMode(mode);
  
    if (mode === "subscription") {
      setSubscriptionPlan(plan ?? null);
    } else {
      setSubscriptionPlan(null);
    }
  
    setReserveOpen(true);
  }

  return (
    <div className="scroll-smooth min-h-screen bg-gradient-to-b from-white to-slate-50 text-slate-800">
      <Header brand={BRAND} itemsCount={qtyTotal} openCart={()=>setDrawerOpen(true)} />

      {/* Hero Section */}
      <section
        id="hero"
        className="relative w-full overflow-hidden bg-black"
        style={{ aspectRatio: "16 / 9" }} // keeps proportions clean during load
      >
        {/* Video background */}
        <video
          className="absolute inset-0 w-full h-full object-cover"
          src="/hero_bg.mp4"
          autoPlay
          loop
          muted
          playsInline
        />
      
        {/* Optional dark overlay for logo contrast */}
        <div className="absolute inset-0 bg-black/25" />

        {/* Slogan (top-left corner) */}
        <div className="absolute top-3 left-4 sm:top-6 sm:left-8 z-20">
          <h1 className="text-white font-mono font-bold text-xl sm:text-3xl md:text-6xl leading-tight drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)]">
            By L reuteri.
          </h1>
        </div>
        
        {/* Logo overlay */}
        <div className="relative z-10 flex items-center justify-center h-full">
          <img
            src="/logo_inverted_transparent.png"
            alt="Yoghurt of Youth logo"
            className="w-auto h-24 sm:h-36 md:h-56 lg:h-72 max-w-[88%] object-contain"
          />
        </div>
      </section>
      
      {/* SHOP – product lines overview only */}
      <section id="shop" className="scroll-mt-32 md:scroll-mt-24 w-full">
        <div className="mx-auto grid grid-cols-1 md:grid-cols-2 gap-0 w-full">
          {GROUPED
            .filter((g) => {
              const q = (query || "").toLowerCase();
              return (
                !q ||
                g.title.toLowerCase().includes(q) ||
                g.variants.some((v) => v.label.toLowerCase().includes(q))
              );
            })
            .map((g, idx) => (
              <article
                key={g.key + "-hero-mobile"}
                className="relative aspect-[3/2] w-full overflow-hidden"
              >
                {/* background image */}
                <img
                  src={g.img}
                  alt={g.title}
                  className="absolute inset-0 w-full h-full object-cover"
                />
      
                {/* dark overlay */}
                <div className="absolute inset-0 bg-black/40" />
      
                {/* content */}
                <div className="relative z-10 h-full flex flex-col justify-between p-6">
                  <div>
                    <p className="text-sm uppercase tracking-[0.2em] text-white mb-1">
                      {idx === 0 ? "Targeted" : "Broad-acting"}
                    </p>
      
                    {g.key === "prcxn" ? (
                      <img
                        src="/prcxn_logo.png"
                        alt="PRCXN"
                        className="w-[60%] object-contain drop-shadow-lg"
                      />
                    ) : g.key === "spctrl" ? (
                      <img
                        src="/spctrl_logo.png"
                        alt="SPCTRL"
                        className="w-[60%] object-contain drop-shadow-lg"
                      />
                    ) : (
                      <h3 className="text-3xl font-bold text-white drop-shadow-md">
                        {g.title}
                      </h3>
                    )}
      
                    <p className="mt-2 text-sm text-white max-w-md leading-relaxed">
                      {g.blurb}
                    </p>
                  </div>
                </div>
              </article>
            ))}
        </div>
      </section>


      {/* FLAVOUR SELECTION – single panel for current week */}
      <section
        id="flavours"
        className="scroll-mt-32 md:scroll-mt-24 w-full py-12 relative text-white"
        style={{
          backgroundImage:
            "linear-gradient(rgba(0,0,0,0.65), rgba(0,0,0,0.65)), url('/flavour_bg.png')",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          {/** work out which yoghurt is active this week */}
          {(() => {
            const { thisWeekBrand, nextWeekBrand } = getBrandRotation();
      
            // --- map active brand → product IDs ---
            const ids = { PLN: "PLN", BFC: "BFC", STR: "STR", MNG: "MNG" };
      
            const qty = (id: string) => cart[id] || 0;
      
            const totalPlain = qty(ids.PLN);
            const totalFlavoured = qty(ids.BFC) + qty(ids.STR) + qty(ids.MNG);
      
            const plainOnBundle = totalPlain >= 7;
            const flavOnBundle = totalFlavoured >= 7;
            const freeDeliveryUnlocked = merchTotal >= 20;
      
            return (
              <>
                <h2 className="text-2xl sm:text-3xl font-bold mb-3">
                  Flavour Selection – {thisWeekBrand}
                </h2>
      
                {/* Info text */}
                <div className="text-sm sm:text-base text-white max-w-2xl space-y-1">
                  <p>
                    This week is <strong>{thisWeekBrand}</strong> week; next week is{" "}
                    <strong>{nextWeekBrand}</strong> week.
                  </p>
                  <p>
                    UK-wide chilled next-day delivery available.
                    Dispatched on <strong>Monday</strong> and <strong>Thursday</strong>.
                  </p>
                  <p>
                    Collection available at our <strong>Blackburn</strong> premises on <strong>Monday</strong> and <strong>Thursday</strong> from 12:00-21:00.
                    Please ensure you can collect within the specified window. UK-wide delivery is recommended for distant locations.
                  </p>
                  <p>Fermented on the day before dispatch / collection for freshness.</p>
                </div>
      
                <div className="mt-6 bg-black/40 rounded-2xl border border-white/10 p-3 sm:p-4 backdrop-blur-sm">
                  <div className="text-sm sm:text-base text-white max-w-4xl space-y-1.5">
                    <p>Browse our selection.</p>
                    <p><strong>Taster</strong> consists of 1 of each flavour.
                      Each flavour option consists of <strong>7 bottles</strong>.{" "}
                      <strong>Mixed</strong> consists of <strong>2 BFC</strong> (black forest chocolate),{" "}
                      <strong>3 STR</strong> (strawberry), and <strong>2 MNG</strong> (mango).</p>
                    <p>Click on a flavour header to view the nutrition information.</p>
                    <p>Click on the <strong>basket icon</strong> on the top right to complete your purchase.</p>
                  </div>
                  
                  {/* 2-row cards per flavour: header + controls */}
                  <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-px text-sm text-white">
                    {[
                      // --- TASTER (new) ---
                      { id: "TASTER", label: "Taster", bg: "TASTER_STRIPES" as const },
                    
                      // existing flavours (unchanged labels + nutrition)
                      { id: ids.PLN, label: "PLN (plain)", bg: "bg-white/15", nutritionSrc: "/pln_nutrition.png" },
                      { id: ids.BFC, label: "BFC (black forest)", bg: "bg-rose-900/40", nutritionSrc: "/bfc_nutrition.png" },
                      { id: ids.STR, label: "STR (strawberry)", bg: "bg-pink-500/35", nutritionSrc: "/str_nutrition.png" },
                      { id: ids.MNG, label: "MNG (mango)", bg: "bg-amber-300/45", nutritionSrc: "/mng_nutrition.png" },
                    
                      // --- MIX (new) ---
                      { id: "MIX", label: "Mixed", bg: "MIX_STRIPES" as const },
                    ].map((f) => {                   
                      const isPreset = f.id === "TASTER" || f.id === "MIX";
                      const isMix = f.bg === "MIX_STRIPES";
                      const isTaster = f.bg === "TASTER_STRIPES";
                    
                      function setQty(id: string, n: number) {
                        setCart((c) => {
                          const next = { ...c };
                          if (n <= 0) delete next[id];
                          else next[id] = n;
                          return next;
                        });
                      }

                      function bumpDisplay(id: string, delta: number) {
                        setDisplayQty((d) => {
                          const next = { ...d };
                          const v = (next[id] || 0) + delta;
                          if (v <= 0) delete next[id];
                          else next[id] = v;
                          return next;
                        });
                      }
                    
                      function decPreset(kind: "TASTER" | "MIX") {
                        setCart((c) => {
                          const next = { ...c };
                      
                          const dec = (id: string, by: number) => {
                            const v = Number(next[id] || 0) - by;
                            if (v <= 0) delete next[id];
                            else next[id] = v;
                          };
                      
                          if (kind === "TASTER") {
                            dec(ids.PLN, 1);
                            dec(ids.BFC, 1);
                            dec(ids.STR, 1);
                            dec(ids.MNG, 1);
                          } else {
                            dec(ids.BFC, 2);
                            dec(ids.STR, 3);
                            dec(ids.MNG, 2);
                          }
                      
                          return next;
                        });
                      
                        bumpDisplay(kind, -1);
                      }
                      
                      function incPreset(kind: "TASTER" | "MIX") {
                        setCart((c) => {
                          const next = { ...c };
                      
                          const inc = (id: string, by: number) => {
                            next[id] = Number(next[id] || 0) + by;
                          };
                      
                          if (kind === "TASTER") {
                            inc(ids.PLN, 1);
                            inc(ids.BFC, 1);
                            inc(ids.STR, 1);
                            inc(ids.MNG, 1);
                          } else {
                            inc(ids.BFC, 2);
                            inc(ids.STR, 3);
                            inc(ids.MNG, 2);
                          }
                      
                          return next;
                        });
                      
                        bumpDisplay(kind, 1);
                      }
                    
                      return (
                        <div key={f.id} className="grid grid-rows-[auto,auto] gap-px">
                          {/* header cell */}
                          {isPreset ? (
                            <div className="bg-black/70 px-2 py-1.5 font-semibold text-center">
                              {f.label}
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setNutritionModal({ title: `${f.label} – Nutrition`, src: (f as any).nutritionSrc })}
                              className="bg-black/70 px-2 py-1.5 font-semibold text-center hover:bg-black/50 hover:text-amber-300 transition-colors"
                            >
                              {f.label}
                            </button>
                          )}
                    
                          {/* controls cell */}
                          <div className={cn("relative px-2 py-2 flex items-center justify-center gap-2", !isMix && !isTaster && (f as any).bg)}>
                            {/* preset stripes backgrounds */}
                            {isMix && (
                              <>
                                <div className="absolute inset-0 grid grid-cols-3">
                                  <div className="bg-rose-900/40" />
                                  <div className="bg-pink-500/35" />
                                  <div className="bg-amber-300/45" />
                                </div>
                                <div className="absolute inset-0 bg-black/25" />
                              </>
                            )}
                    
                            {isTaster && (
                              <>
                                <div className="absolute inset-0 grid grid-cols-4">
                                  <div className="bg-white/15" />
                                  <div className="bg-rose-900/40" />
                                  <div className="bg-pink-500/35" />
                                  <div className="bg-amber-300/45" />
                                </div>
                                <div className="absolute inset-0 bg-black/25" />
                              </>
                            )}
                    
                            <button
                              onClick={() => {
                                if (f.id === "TASTER") return decPreset("TASTER");
                                if (f.id === "MIX") return decPreset("MIX");

                                if (f.id === ids.PLN || f.id === ids.BFC || f.id === ids.STR || f.id === ids.MNG) {
                                  const cur = qty(f.id);
                                  if (cur > 0) {
                                    setQty(f.id, Math.max(0, cur - 7));
                                    bumpDisplay(f.id, -1);
                                  }
                                  return;
                                }

                                return sub(f.id);
                              }}
                              className="relative z-10 w-5 h-5 sm:w-6 sm:h-6 grid place-items-center rounded-lg bg-black/30 text-white hover:bg-black/40 transition leading-none"
                              aria-label="Remove one"
                            >
                              <span className="translate-y-[-1px] text-sm font-semibold">−</span>
                            </button>
                    
                            <span className="relative z-10 w-6 text-center text-sm font-semibold qty-flash">
                              {displayQty[f.id] || 0}
                            </span>
                    
                            <button
                              onClick={() => {
                                if (f.id === ids.PLN) { setQty(ids.PLN, qty(ids.PLN) + 7); bumpDisplay(f.id, 1); trackAddToCart("PLN", 7 * 2.1, 7); return; }
                                if (f.id === ids.BFC) { setQty(ids.BFC, qty(ids.BFC) + 7); bumpDisplay(f.id, 1); trackAddToCart("BFC", 7 * 2.2, 7); return; }
                                if (f.id === ids.STR) { setQty(ids.STR, qty(ids.STR) + 7); bumpDisplay(f.id, 1); trackAddToCart("STR", 7 * 2.2, 7); return; }
                                if (f.id === ids.MNG) { setQty(ids.MNG, qty(ids.MNG) + 7); bumpDisplay(f.id, 1); trackAddToCart("MNG", 7 * 2.2, 7); return; }
                                
                                if (f.id === "TASTER") { incPreset("TASTER"); trackAddToCart("Taster", 2.1 + 2.2 * 3, 4); return; }
                                if (f.id === "MIX") { incPreset("MIX"); trackAddToCart("Mixed", 2.2 * 7, 7); return; }
                              }}
                              className="relative z-10 w-5 h-5 sm:w-6 sm:h-6 grid place-items-center rounded-lg bg-white text-slate-900 hover:bg-slate-200 transition leading-none"
                              aria-label="Add"
                            >
                              <span className="translate-y-[-1px] text-sm font-semibold">+</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                   
                  {/* pricing + badges */}
                  <div className="mt-2 text-xs text-white space-y-1.5">
                    <p className="flex flex-wrap items-center gap-2">
                      <span>
                        PLN: <strong>£2.10</strong> each ·{" "}
                        <strong>7 for the price of 6</strong>
                      </span>
                      {totalPlain > 0 ? (
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs shadow-md backdrop-blur-md",
                            plainOnBundle
                              ? "bg-emerald-500/80 text-slate-900"
                              : "bg-black/60 text-white"
                          )}
                        >
                          In basket:&nbsp;
                          <strong>{totalPlain}</strong>
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-black/60 px-2.5 py-0.5 text-xs shadow-md backdrop-blur-md invisible">
                          In basket:&nbsp;
                          <strong>0</strong>
                        </span>
                      )}
                    </p>
      
                    <p className="flex flex-wrap items-center gap-2">
                      <span>
                        BFC, STR &amp; MNG: <strong>£2.20</strong> each ·{" "}
                        <strong>7 for the price of 6</strong>
                      </span>
                      {totalFlavoured > 0 ? (
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs shadow-md backdrop-blur-md",
                            flavOnBundle
                              ? "bg-emerald-500/80 text-slate-900"
                              : "bg-black/60 text-white"
                          )}
                        >
                          In basket:&nbsp;
                          <strong>{totalFlavoured}</strong>
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-black/60 px-2.5 py-0.5 text-xs shadow-md backdrop-blur-md invisible">
                          In basket:&nbsp;
                          <strong>0</strong>
                        </span>
                      )}
                    </p>
      
                    {/* Delivery info + "Spent" badge */}
                    <p className="flex flex-wrap items-center gap-2">
                      <span>
                        Chilled Next Day Delivery charge of <strong>£4.95</strong> ·{" "}
                        Collect for <strong>FREE</strong>
                      </span>
                    </p>                    
                  </div>
                </div>
                
                {/* Weekly Gut Punch */}
                <div className="mt-8 bg-black/40 rounded-2xl border border-white/10 p-3 sm:p-4 backdrop-blur-sm">
                  <h3 className="text-xl sm:text-2xl font-bold mb-2">Weekly Gut Punch</h3>
                
                  <div className="text-sm sm:text-base text-white max-w-4xl space-y-1.5">
                    <p><strong>Subscribe and save.</strong> Receive <strong>7 bottle of yoghurts every week</strong>{" "}
                      at a <strong>10% discount</strong>,
                      fermented the day before dispatch for freshness.</p>
                    <p>Your first batch will be dispatched on the coming <strong>available Monday</strong>. Book by <strong>Saturday evening</strong> for the <strong>coming Monday</strong>.</p>
                    <p>You will be charged <strong>every week</strong> on the day of dispatch. Pause or cancel anytime by emailing <a href="mailto:support@yoghurtofyouth.co.uk" className="underline hover:text-slate-900">
                        support@yoghurtofyouth.co.uk
                      </a>.</p>
                    <p>We alternate between <strong>PRCXN</strong> and <strong>SPCTRL</strong> yoghurt variants every week.</p>
                    <p>Tap a plan below to subscribe.</p>
                  </div>
                
                  {/* Plans table */}
                  <div className="mt-4">
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-px text-sm text-white">
                      {SUBSCRIPTION_PLANS.map((p) => {
                        const isMix = p.bg === "MIX_STRIPES";
                  
                        return (
                          <button
                            key={p.key}
                            type="button"
                            onClick={() => {
                              setSelectedPlan(p);
                              setPayKind("subscription");
                              setReserveOpen(true);
                            }}
                            className="text-left grid grid-rows-[auto,auto] gap-px focus:outline-none"
                          >
                            {/* header cell */}
                            <div className="bg-black/70 px-2 py-1.5 font-semibold text-center">
                              {p.label}
                            </div>
                  
                            {/* price cell (clickable) */}
                            <div
                              className={cn(
                                "relative px-2 py-3 flex items-center justify-center font-semibold",
                                "transition-all duration-200 ease-out",
                                "hover:brightness-125 active:brightness-150",
                                "hover:ring-1 hover:ring-white/30 active:ring-white/45",
                                !isMix && (p.key === "PLN"
                                  ? "bg-white/15 hover:bg-white/20 active:bg-white/25"
                                  : p.bg)
                              )}
                            >
                              {/* MIX stripes */}
                              {isMix && (
                                <div className="absolute inset-0 grid grid-cols-3">
                                  <div className="bg-rose-900/40" />
                                  <div className="bg-pink-500/35" />
                                  <div className="bg-amber-300/45" />
                                </div>
                              )}
                  
                              {isMix && <div className="absolute inset-0 bg-black/25" />}
                  
                              <span className="relative z-10">{p.priceLabel}</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  
                    <p className="mt-2 text-xs text-white leading-relaxed">
                      <strong>MIX</strong> contains 2 BFC, 3 STR, and 2 MNG
                    </p>

                    <p className="mt-2 text-xs text-white leading-relaxed">
                      Standard weekly delivery charge of <strong>£4.95</strong>
                    </p>
                    
                  </div>

                </div>

              </>
            );
          })()}
        </div>
      </section>

      {/* Behind the scenes */}
      <section
        id="bts"
        className="relative w-full overflow-hidden bg-black scroll-mt-32 md:scroll-mt-24"
        style={{ aspectRatio: "16 / 9" }}
      >
        <video
          className="absolute inset-0 w-full h-full object-cover"
          src="/bts.mp4"
          autoPlay
          loop
          muted
          playsInline
        />
      </section>

      {nutritionModal && (
        <Modal
          title={nutritionModal.title}
          onClose={() => setNutritionModal(null)}
        >
          <img
            src={nutritionModal.src}
            alt={nutritionModal.title}
            className="w-full rounded-xl border border-white/15"
          />
        </Modal>
      )}


      {/* About */}
      <AboutSection />

      
      <Footer brand={BRAND} />

      
      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Your Basket"
      >
        <Basket
          items={items}
          qtyTotal={qtyTotal}
          bundles={bundles}
          remainder={remainder}
          total={total}
          savings={savings}
          plainBundles={plainBundles}
          flavBundles={flavBundles}
          plainRemainder={plainRemainder}
          flavRemainder={flavRemainder}
          merchTotal={merchTotal}
          deliveryFee={deliveryFee}
          freeDeliveryUnlocked={freeDeliveryUnlocked}
          add={add}
          sub={sub}
          remove={remove}
          clear={clear}
          onReserve={() => {
            const eventId = newEventId();
            const data = { value: total, currency: "GBP", num_items: qtyTotal };
            if (typeof window !== "undefined" && window.fbq) {
              window.fbq("track", "InitiateCheckout", data, { eventID: eventId });
            }
            sendCAPIEvent("InitiateCheckout", { eventId, customData: data });
            openCheckout("checkout");
          }}
        />
      </Drawer>

      {reserveOpen && (
        <PayModal
          onClose={() => {
            setReserveOpen(false);
            setPayMode("checkout");
            setConfirmedOrder(null);
            setPayKind("oneoff");
            setSelectedPlan(null);
          }}
          cart={cart}
          totals={totals}
          mode={payMode}
          confirmedOrder={confirmedOrder}
          payKind={payKind}
          subscriptionPlan={selectedPlan}
        />
      )}
    </div>
  );
}

function Header({ brand, itemsCount, openCart }) {
  const [scrolled, setScrolled] = React.useState(false);

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 100);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="sticky top-0 z-50 transition-all duration-500 ease-in-out group">
      {/* Background */}
      <div
        className={`
          relative transition-all duration-500
          ${scrolled ? "h-20" : "h-32"}
          group-hover:h-32
        `}
        style={{
          backgroundImage: "url('header_bg.png')",
          backgroundSize: "cover",
          backgroundPosition: `center ${scrolled ? "50%" : "50%"}`, // tweak for horizon
          backgroundRepeat: "no-repeat",
        }}
      >
        {/* Darken bottom for readability */}
        <div className="absolute inset-0 bg-black/40 pointer-events-none" />

        {/* Content anchored to bottom (so shrink is from top) */}
        <div className="relative mx-auto max-w-6xl px-4 h-full flex items-center justify-between">
          <div className="w-full flex items-center justify-between pb-2">
            <a href="#" className="flex items-center">
              <img
                src="logo_inverted_transparent.png"
                alt="Yoghurt of Youth logo"
                className={`
                  object-contain transition-all duration-500
                  ${scrolled ? "h-10 md:h-12" : "h-14 md:h-16"}
                  group-hover:h-14 md:group-hover:h-16
                `}
              />
            </a>

            {/* NAVIGATION */}
            <nav className="flex items-center gap-6 text-white font-medium text-xs sm:text-sm md:text-base">
              <div className="flex items-center gap-6 leading-none">
                <a href="#shop" className="hover:text-amber-300 transition-colors">Shop</a>
                <a href="#about" className="hover:text-amber-300 transition-colors">About</a>
              </div>

              {/* Basket button perfectly aligned */}
              <button
                onClick={openCart}
                className="flex items-center gap-2 h-[40px] border border-white/70 px-4 rounded-xl hover:bg-white/10 transition-all leading-none"
              >
                <img
                  src="/basket_icon.png"
                  alt="Basket"
                  className="h-5 w-5 select-none"
                  draggable={false}
                />
              
                {itemsCount > 0 && (
                  <span className="ml-1 inline-flex items-center justify-center min-w-[26px] h-[26px] px-2 rounded-lg bg-emerald-500/80 text-black text-xs font-semibold leading-none">
                    {itemsCount}
                  </span>
                )}
              </button>
            </nav>
          </div>
        </div>
      </div>
    </header>
  );
}

function Logo({ brand }:{ brand:string }) {
  return (
    <a href="#" className="flex items-center gap-3">
      <div className="grid place-items-center w-9 h-9 rounded-2xl bg-slate-900 text-white text-lg">Y</div>
      <span className="font-extrabold tracking-tight">{brand}</span>
    </a>
  );
}

function Drawer({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      aria-hidden={!open}
      className={cn(
        "fixed inset-0 z-50 transition-all duration-500",
        open ? "" : "pointer-events-none"
      )}
    >
      {/* Background overlay */}
      <div
        onClick={onClose}
        className={cn(
          "absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-500",
          open ? "opacity-100" : "opacity-0"
        )}
      />

      {/* Transparent drawer */}
      <aside
        className={cn(
          "absolute right-0 top-0 h-full w-full max-w-md bg-black/60 backdrop-blur-sm text-white shadow-2xl border-l border-white/10 p-6 transition-transform duration-500 ease-in-out",
          open ? "translate-x-0" : "translate-x-full"
        )}
        style={{
          backgroundColor: "rgba(0, 0, 0, 0.55)", // true transparency for browsers that ignore Tailwind alpha
        }}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-full w-8 h-8 grid place-items-center hover:bg-white/10 transition"
          >
            ✕
          </button>
        </div>

        <div className="mt-4 text-white overflow-y-auto max-h-[calc(100%-5rem)] pr-2">
          {children}
        </div>
      </aside>
    </div>
  );
}

const FLAVOUR_STYLE = {
  PLN: { bg: "bg-white/15", emoji: "🥛" },
  BFC: { bg: "bg-rose-900/40", emoji: "🍫" },
  STR: { bg: "bg-pink-500/35", emoji: "🍓" },
  MNG: { bg: "bg-amber-300/45", emoji: "🥭" },
};

function Basket({
  items,
  qtyTotal,
  bundles,
  remainder,
  total,               // FINAL total including delivery (from computeTotals)
  savings,
  plainBundles,
  flavBundles,
  plainRemainder,
  flavRemainder,
  merchTotal,          // bottles only, after bundles (if you want to show it later)
  deliveryFee,
  freeDeliveryUnlocked,
  add,
  sub,
  remove,
  clear,
  onReserve,
}: {
  items: any[];
  qtyTotal: number;
  bundles: number;          // still passed, even if not shown
  remainder: number;        // still passed, even if not shown
  total: number;            // final total INCLUDING delivery
  savings: number;
  plainBundles: number;
  flavBundles: number;
  plainRemainder: number;
  flavRemainder: number;
  deliveryFee: number;
  freeDeliveryUnlocked: boolean;
  merchTotal: number;
  add: (id: string) => void;
  sub: (id: string) => void;
  remove: (id: string) => void;
  clear: () => void;
  onReserve: () => void;
}) {
  return (
    <div className="space-y-4 text-white">
      {items.length === 0 && (
        <p className="text-sm text-white/60">Your basket is empty.</p>
      )}

      {items.map((i) => (
        <div key={i.id} className="flex gap-3">
          {/* flavour colour + emoji panel */}
          <div
            className={cn(
              "w-16 h-12 rounded-lg ring-1 ring-white/20 flex items-center justify-center text-2xl",
              FLAVOUR_STYLE[i.id]?.bg || "bg-black/30"
            )}
          >
            <span>{FLAVOUR_STYLE[i.id]?.emoji || "❓"}</span>
          </div>

          <div className="flex-1">
            <div className="flex justify-between text-sm">
              <div>
                <div className="font-medium text-white">{i.name}</div>
                <div className="text-white/60">{i.size}</div>
              </div>
              {/* real product price */}
              <div className="font-medium text-white/90">
                £{(i.qty * i.price).toFixed(2)}
              </div>
            </div>

            <div className="mt-2 flex items-center gap-2">
              {/*<button
                onClick={() => sub(i.id)}
                className="w-7 h-7 rounded-lg bg-white/10 text-white hover:bg-white/20 transition"
              >
                −
              </button>*/}
              <span className="w-8 text-sm">{i.qty}</span>
              {/*<button
                onClick={() => add(i.id)}
                className="w-7 h-7 rounded-lg bg-white text-slate-900 font-semibold hover:bg-amber-300 transition"
              >
                +
              </button>
              <button
                onClick={() => remove(i.id)}
                className="ml-auto text-xs text-white/60 hover:text-white transition"
              >
                Remove
              </button>*/}
            </div>
          </div>
        </div>
      ))}

      {/* Totals */}
      <div className="border-t border-white/20 pt-4 space-y-2 text-sm text-white/80">
        <div className="flex justify-between">
          <span>Bottles</span>
          <span>{qtyTotal}</span>
        </div>

        {plainRemainder > 0 && (
          <div className="flex justify-between">
            <span>PLN</span>
            <span>{plainRemainder} × £2.10</span>
          </div>
        )}

        {plainBundles > 0 && (
          <div className="flex justify-between">
            <span>Free PLN (7 for 6)</span>
            <span>{plainBundles}</span>
          </div>
        )}

        {flavRemainder > 0 && (
          <div className="flex justify-between">
            <span>Flavoured</span>
            <span>{flavRemainder} × £2.20</span>
          </div>
        )}

        {flavBundles > 0 && (
          <div className="flex justify-between">
            <span>Free flavoured (7 for 6)</span>
            <span>{flavBundles}</span>
          </div>
        )}

        {savings > 0 && (
          <div className="flex justify-between text-emerald-400">
            <span>You save</span>
            <span>−{gbp(savings)}</span>
          </div>
        )}

        <div className="flex justify-between font-semibold text-white">
          <span>Total due to be paid</span>
          <span>{gbp(merchTotal)}</span>
        </div>
      </div>

      {/* Buttons */}
      <div className="flex gap-2">
        <button
          onClick={onReserve}
          disabled={qtyTotal === 0}
          className={cn(
            "flex-1 rounded-2xl px-5 py-3 text-sm font-semibold transition",
            qtyTotal
              ? "bg-white text-slate-900 hover:bg-amber-300"
              : "bg-white/10 text-white/40 cursor-not-allowed"
          )}
        >
          Pay
        </button>
        <button
          onClick={clear}
          className="rounded-2xl border border-white/30 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10 transition"
        >
          Clear
        </button>
      </div>
    </div>
  );
}

// ---- helper functions for delivery ----
const DELIVERY_DAYS = [1, 4]; // Monday=1, Thursday=4

function toISODate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(base: Date, n: number) {
  const d = new Date(base);
  d.setDate(d.getDate() + n);
  return d;
}

// find the next Monday/Thursday on or after a given date
function nextDeliveryOnOrAfter(start: Date) {
  const d = new Date(start);
  while (!DELIVERY_DAYS.includes(d.getDay())) {
    d.setDate(d.getDate() + 1);
  }
  return d;
}

function formatDateUK(iso: string) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso || "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`; // dd/mm/yyyy
}

function weekdayFromISO(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const names = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  return names[date.getDay()];
}

function nextDispatchISO(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0 Sun .. 6 Sat
  // Wed–Sat -> next Monday;  Sun–Tue -> next Thursday
  const target = (day >= 3 && day <= 6) ? 1 : 4;
  let add = (target - day + 7) % 7;
  if (add === 0) add = 7; // never today
  d.setDate(d.getDate() + add);
  return toISODate(d);
}

function PayModal({
  onClose,
  cart,
  totals,
  mode = "checkout",
  confirmedOrder,
  payKind = "oneoff",
  subscriptionPlan,
}: {
  onClose: () => void;
  cart: Record<string, number>;
  totals: ReturnType<typeof computeTotals>;
  mode?: "checkout" | "success";
  confirmedOrder?: ConfirmOrder | null;

  payKind?: "oneoff" | "subscription";
  subscriptionPlan?: SubscriptionPlan | null;
}) {

  const isSubscription = payKind === "subscription" && !!subscriptionPlan;

  const [delivery_method, setDeliveryMethod] = useState<"delivery" | "collection">("delivery");

  const firstISO = nextEligibleMondayISO();
  const firstText = `${formatDateUK(firstISO)} (${weekdayFromISO(firstISO)})`;

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [postcode, setPostcode] = useState("");
  const [streetAddress, setStreetAddress] = useState("");
  const [townCity, setTownCity] = useState("");

  const date = nextDispatchISO();
  const formattedDate = formatDateUK(date);
  const deliveryWindow = "18:30–20:00";

  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const [giftCode, setGiftCode] = useState("");

  const normalizedGiftCode = giftCode.trim().toUpperCase();
  const discountPercent =
    normalizedGiftCode === "MINUS10" ? 10 : 0;
  const giftStrQty =
    normalizedGiftCode === "YOY25" ? 1 : 0;

  const totalsWithGift = useMemo(() => {
    return computeTotals(cart, discountPercent, delivery_method, giftStrQty);
  }, [cart, discountPercent, delivery_method, giftStrQty]);

  const {
    qtyTotal,
    total,
    savings,
    plainQty,
    flavQty,
    plainBundles,
    flavBundles,
    plainRemainder,
    flavRemainder,
    deliveryFee,
    freeDeliveryUnlocked,
  } = totalsWithGift;

  const lines = Object.entries(cart).map(([id, qty]) => {
    const p = PRODUCTS.find((p) => p.id === id);
    return `${p?.name ?? id} × ${qty}`;
  });

  if (discountPercent > 0) {
    lines.push(`10% discount applied (${normalizedGiftCode})`);
  }
  if (giftStrQty > 0) {
    lines.push(`STR × 1 (FREE — ${normalizedGiftCode})`);
  }
  
  const normalizedPostcode = postcode.trim().toUpperCase();

  const fullAddress =
    delivery_method === "collection"
      ? "Collection"
      : [streetAddress.trim(), townCity.trim(), normalizedPostcode].filter(Boolean).join(", ");

  const valid = isSubscription
    ? (!!name && !!email && !!phone &&
       (delivery_method === "delivery" ? (!!postcode && !!streetAddress && !!townCity) : true))
    : (qtyTotal > 0 && !!date);

  function validateBeforePay(): boolean {
    if (!valid) {
      setError("Please complete all required fields first.");
      return false;
    }
    if (isSubscription && !subscriptionPlan) {
      setError("Please choose a subscription plan.");
      return false;
    }
    return true;
  }

  useEffect(() => {
    if (typeof window === "undefined") return;
  
    const raw = sessionStorage.getItem("yoy_checkout_draft");
    if (!raw) return;
  
    try {
      const draft = JSON.parse(raw);
  
      // Restore customer fields for BOTH one-off and subscription
      setName(draft?.customer?.name || "");
      setEmail(draft?.customer?.email || "");
      setPhone(draft?.customer?.phone || "");
      setNote(draft?.note || "");
      setDeliveryMethod(draft?.delivery_method || "delivery");
      setGiftCode(draft?.gift_code || "");
  
      // Restore address fields safely
      const savedAddress = String(draft?.customer?.address || "");
      const parts = savedAddress
        .split(',')
        .map(part => String(part || "").trim())
        .filter(part => part.length > 0);
  
      setStreetAddress(parts[0] || "");
      setTownCity(parts[1] || "");
      setPostcode(parts[2] || "");
  
    } catch (e) {
      console.error("Failed to restore checkout draft", e);
    }
  }, []);

  useEffect(() => {
    const raw = sessionStorage.getItem("yoy_checkout_draft");
    let existing: any = {};
    try { existing = raw ? JSON.parse(raw) : {}; } catch {}
  
    const updated = {
      ...existing,
      customer: {
        ...(existing.customer || {}),
        name,
        email,
        phone,
        address: fullAddress,
      },
      note,
      gift_code: giftCode,
      delivery_method,
    };
  
    sessionStorage.setItem("yoy_checkout_draft", JSON.stringify(updated));
  }, [name, email, phone, fullAddress, note, delivery_method, giftCode]);

  // ✅ SUBSCRIPTION MODE (Weekly Gut Punch)
  if (isSubscription && subscriptionPlan) {
    return (
      <Modal onClose={onClose} title="Weekly Gut Punch">
        <p className="text-sm text-white">
          You’re subscribing to <span className="font-semibold">{subscriptionPlan.label}</span> Weekly Gut Punch.
          We dispatch your first batch on {" "}<span className="font-semibold">{firstText}</span> then every following <span className="font-semibold">Monday</span>.
          We deliver UK-wide, and use DPD Next Day delivery.
          The weekly delivery charge is <span className="font-semibold">£4.95</span>.
          Please fill in the details below.
        </p>

        <div className="mt-4 grid md:grid-cols-2 gap-4">
          <input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Full name"
            className="rounded-xl border border-white/30 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:ring-2 focus:ring-white/40" />
          <input value={email} onChange={(e) => setEmail(e.target.value)} required type="email" placeholder="Email"
            className="rounded-xl border border-white/30 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:ring-2 focus:ring-white/40" />
          <input value={phone} onChange={(e) => setPhone(e.target.value)} required type="tel" placeholder="Mobile number (for dispatch information)"
            className="rounded-xl border border-white/30 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:ring-2 focus:ring-white/40" />
          <input value={streetAddress} onChange={(e) => setStreetAddress(e.target.value)} required placeholder="Street address"
            className="rounded-xl border border-white/30 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:ring-2 focus:ring-white/40" />
          <input value={postcode} onChange={(e) => setPostcode(e.target.value)} required placeholder="Postcode (UK)"
            className="rounded-xl border border-white/30 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:ring-2 focus:ring-white/40" />
          <input value={townCity} onChange={(e) => setTownCity(e.target.value)} required placeholder="Town/City"
            className="rounded-xl border border-white/30 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:ring-2 focus:ring-white/40" />
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Order note (optional)"
            className="rounded-xl border border-white/30 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:ring-2 focus:ring-white/40 md:col-span-2" />
        </div>

        {error && <p className="mt-3 text-sm text-rose-300">{error}</p>}

        <div className="mt-5 flex flex-col sm:flex-row gap-3">
          <button
            disabled={sending}
            onClick={async () => {
              if (!validateBeforePay()) return;
          
              setSending(true);
              setError("");
          
              try {
                const customer = {
                  name,
                  email,
                  phone,
                  address: fullAddress,
                };
          
                if (isSubscription && subscriptionPlan) {
                  // Save draft so cancel-return can repopulate fields
                  const draft = {
                    kind: "subscription",
                    plan: subscriptionPlan,
                    customer,
                    note,
                    first_delivery_iso: firstISO,
                    first_delivery_text: firstText,
                    delivery_window: "18:30–20:00",
                    savedAt: Date.now(),
                    provider: "stripe_sub",
                  };
                  sessionStorage.setItem("yoy_checkout_draft", JSON.stringify(draft));
          
                  const res = await fetch("/api/stripe/create-subscription-session", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      planKey: subscriptionPlan.key,
                      customer,
                      note,
                    }),
                  });
          
                  const text = await res.text();
                  let data: any = {};
                  try { data = JSON.parse(text); } catch {}
          
                  if (!res.ok) {
                    console.error("Subscription checkout error:", text);
                    setError(data?.error || "Subscription checkout failed (server error).");
                    return;
                  }
          
                  if (data?.url) window.location.href = data.url;
                  else setError("Stripe subscription checkout failed.");
                  return;
                }
          
                // ---- existing ONE-OFF checkout (your current code) ----
                const draft = {
                  cart,
                  totals: totalsWithGift,
                  customer,
                  delivery_method,
                  delivery_date_iso: date,
                  delivery_date: formattedDate,
                  delivery_window: deliveryWindow,
                  note,
                  lines,
                  gift_code: normalizedGiftCode,
                  discount_percent: discountPercent,
                  gift_str_qty: giftStrQty,
                  savedAt: Date.now(),
                  provider: "stripe",
                };
                sessionStorage.setItem("yoy_checkout_draft", JSON.stringify(draft));
          
                const res = await fetch("/api/stripe/create-checkout-session", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    cart,
                    totals: totalsWithGift,
                    lines,
                    customer,
                    delivery_method,
                    delivery_date: formattedDate,
                    delivery_window: deliveryWindow,
                    note,
                    gift_code: normalizedGiftCode,
                    discount_percent: discountPercent,
                    gift_str_qty: giftStrQty,
                  }),
                });
          
                const text = await res.text();
                let data: any = {};
                try { data = JSON.parse(text); } catch {}
          
                if (!res.ok) {
                  console.error("Checkout error:", text);
                  setError(data?.error || "Checkout failed (server error).");
                  return;
                }
          
                if (data?.url) window.location.href = data.url;
                else setError("Stripe checkout failed.");
              } catch (e) {
                console.error(e);
                setError(isSubscription ? "Stripe subscription checkout failed." : "Stripe checkout failed.");
              } finally {
                setSending(false);
              }
            }}
            className="sm:w-72 h-12 rounded-2xl px-1 text-sm font-semibold text-white bg-[#635BFF] hover:bg-[#5147ff] transition flex items-center justify-center"
          >
            <img src="/stripe_logo.png" alt="Stripe" className="h-14" />
            <span className="text-white mr-2">|</span>
            <span>{sending ? "Processing…" : "Subscribe"}</span>
          </button>
          
          <button
            onClick={onClose}
            className="sm:w-72 h-12 rounded-2xl border border-white/30 px-1 py-3 text-sm font-semibold text-white hover:bg-white/10 transition"
          >
            Cancel
          </button>
        </div>

        <p className="mt-3 text-center text-xs text-white/50 flex items-center justify-center gap-1.5">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5">
            <path fillRule="evenodd" d="M12 1.5a5.25 5.25 0 0 0-5.25 5.25v3a3 3 0 0 0-3 3v6.75a3 3 0 0 0 3 3h10.5a3 3 0 0 0 3-3v-6.75a3 3 0 0 0-3-3v-3c0-2.9-2.35-5.25-5.25-5.25Zm3.75 8.25v-3a3.75 3.75 0 1 0-7.5 0v3h7.5Z" clipRule="evenodd" />
          </svg>
          Secure checkout · payments processed by Stripe
        </p>
      </Modal>
    );
  }

  // ✅ SUCCESS MODE: show confirmation instead of checkout
  if (mode === "success" && confirmedOrder) {
    const order = confirmedOrder;

    const isCollection =
      typeof order.delivery_method === "string" &&
      order.delivery_method.toLowerCase() === "collection";
    
    const dateLabel = isCollection ? "Collection date:" : "Dispatch date:";
    const addressLabel = isCollection ? "Collection address" : "Delivery address";
    
    const collectionMapsUrl =
      "https://www.google.com/maps/search/?api=1&query=11+Billinge+Avenue,+Blackburn,+Lancashire,+BB2+6SD";
  
    const isSubscriptionSuccess =
      typeof order.paymentMethod === "string" &&
      order.paymentMethod.toLowerCase().includes("weekly gut punch");
  
    // ----- SUBSCRIPTION CONFIRMATION -----
    if (isSubscriptionSuccess) {
      return (
        <Modal onClose={onClose} title="Subscription confirmed">
          <ConfettiOverlay />
  
          <p className="text-sm text-white/80 mt-1">
            Thank you, {order.name}. Your <span className="font-semibold">Weekly Gut Punch</span> subscription is live.
          </p>
  
          <div className="mt-3 rounded-xl bg-black/40 border border-white/15 px-4 py-3 text-sm">
            <div className="text-white/60">Subscription reference</div>
            <div className="font-mono font-semibold tracking-wide break-all">
              {order.orderId || "—"}
            </div>
          </div>0
  
          <div className="my-4 border-t border-white/20" />
  
          <div className="grid sm:grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-white/60">First dispatch</div>
              <div className="font-medium">{order.formattedDate}</div>
            </div>
  
            <div>
              <div className="text-white/60">Billing</div>
              <div className="font-medium">
                Weekly · charged on <span className="font-semibold">Monday</span>
              </div>
            </div>
  
            <div>
              <div className="text-white/60">Weekly price</div>
              <div className="font-semibold text-emerald-400">{order.totalText}</div>
            </div>
          </div>
  
          <div className="mt-4 text-sm">
            <div className="text-white/60 mb-1">Delivery address</div>
            <div className="leading-relaxed">{order.address}</div>
          </div>
  
          <div className="mt-5 rounded-2xl bg-black/40 border border-white/15 p-4 text-sm">
            <div className="font-semibold mb-2">What you’ll receive each week</div>
  
            <div className="space-y-1 text-white/85">
              {order.lines.map((line, i) => (
                <div key={i}>• {line}</div>
              ))}
            </div>
  
            <div className="mt-3 text-white/70 text-xs leading-relaxed">
              We alternate PRCXN and SPCTRL by week.
              Your yoghurt is fermented on the day before dispatch for freshness.
              Delivery is £4.95 for Weekly Gut Punch.
            </div>
          </div>
  
          <p className="mt-4 text-xs text-white/70 leading-relaxed">
            You’ll receive an email receipt with full order details shortly.
            If it doesn’t arrive within 5 minutes, please check spam.
            If you have any questions, please email support@yoghurtofyouth.co.uk.
          </p>

          <p className="mt-4 text-xs text-white/70 leading-relaxed">
            If you wish to cancel, please email support@yoghurtofyouth.co.uk.
            Please also provide your name and address.
            We will cancel your subscription shortly.
          </p>
  
          <button
            onClick={onClose}
            className="mt-5 w-full rounded-2xl bg-white text-slate-900 py-3 text-sm font-semibold hover:bg-amber-300 transition"
          >
            Close
          </button>
        </Modal>
      );
    }
  
    // ----- ONE-OFF CONFIRMATION (your existing UI) -----
    return (
      <Modal onClose={onClose} title="Order confirmed">
        {/* Confetti */}
        <ConfettiOverlay />

        {/* ✅ KLAVIYO PLACED ORDER TRACKING */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              var _learnq = _learnq || [];
              _learnq.push(['track', 'Placed Order', {
                "$event_id": "${order.orderId || 'unknown'}",
                "$value": ${order.total || 0},
                "OrderId": "${order.orderId || 'unknown'}",
                "Currency": "GBP",
                "Items": ${JSON.stringify(
                  (order.lines || []).map((line, index) => ({
                    ProductName: line,
                    ProductID: `item-${index}`,
                    Quantity: 1,
                    ItemPrice: 0 // You can improve this later if needed
                  }))
                )}
              }]);
            `,
          }}
        />
  
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-white/70 mt-1">
              Thank you for your order, {order.name}.
            </p>
          </div>
        </div>
  
        {/* Order reference */}
        <div className="mt-3 rounded-xl bg-black/40 border border-white/15 px-4 py-3 text-sm">
          <div className="text-white/60">Order reference</div>
          <div className="font-mono font-semibold tracking-wide">
            {order.orderId || "—"}
          </div>
        </div>
  
        <div className="my-4 border-t border-white/20" />
  
        {/* Key info */}
        <div className="grid sm:grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-white/60">{dateLabel}</div>
            <div className="font-medium">{order.formattedDate}</div>
          </div>
  
          {isCollection && (
            <div>
              <div className="text-white/60">Collection window</div>
              <div className="font-medium">12:00–21:00</div>
            </div>
          )}
  
          <div>
            <div className="text-white/60">Payment method</div>
            <div className="font-medium">{order.paymentMethod}</div>
          </div>
  
          <div>
            <div className="text-white/60">Total paid</div>
            <div className="font-semibold text-emerald-400">
              {order.totalText}
            </div>
          </div>
        </div>
  
        {/* Address */}
        <div className="mt-4 text-sm">
          <div className="text-white/60 mb-1">{addressLabel}</div>
        
          {isCollection ? (
            <a
              href={collectionMapsUrl}
              target="_blank"
              rel="noreferrer"
              className="leading-relaxed underline underline-offset-2 hover:text-amber-300 transition"
            >
              11 Billinge Avenue, Blackburn, Lancashire, BB2 6SD
            </a>
          ) : (
            <div className="leading-relaxed">{order.address}</div>
          )}
        </div>
  
        {/* Items */}
        <div className="mt-5 rounded-2xl bg-black/40 border border-white/15 p-4 text-sm">
          <div className="font-semibold mb-2">Order summary</div>
  
          <div className="space-y-1 text-white/85">
            {order.lines.map((line, i) => (
              <div key={i}>• {line}</div>
            ))}
          </div>
        </div>
  
        {/* Email notice */}
        <p className="mt-4 text-xs text-white/70 leading-relaxed">
          {isCollection ? (
            <>Your yoghurt is fermented on the day before collection for freshness.
              You’ll receive an email receipt with full order details shortly.
              If it doesn’t arrive within 5 minutes, please check spam.
              If you have any questions, please email support@yoghurtofyouth.co.uk.</>
          ) : (
            <>Your yoghurt is fermented on the day before dispatch for freshness.
              You’ll receive an email receipt with full order details shortly.
              If it doesn’t arrive within 5 minutes, please check spam.
              If you have any questions, please email support@yoghurtofyouth.co.uk.</>
          )}
        </p>
  
        {/* Close */}
        <button
          onClick={onClose}
          className="mt-5 w-full rounded-2xl bg-white text-slate-900 py-3 text-sm font-semibold hover:bg-amber-300 transition"
        >
          Close
        </button>
      </Modal>
    );
  }

  return (
    <Modal onClose={onClose} title="Checkout & Delivery">
      <p className="text-sm text-white/80">
        Choose below, then continue to payment, where you will also enter your contact and delivery details.
        We deliver UK-wide, dispatch every <span className="font-semibold">Monday</span> & <span className="font-semibold">Thursday</span>,
        and use DPD Next Day delivery.
      </p>

      <div className="mt-4 grid md:grid-cols-2 gap-4">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setDeliveryMethod("delivery")}
            className={
              "flex-1 rounded-xl border px-3 py-2 text-sm font-semibold transition " +
              (delivery_method === "delivery"
                ? "border-white/60 bg-white/15 text-white"
                : "border-white/25 bg-black/20 text-white/80 hover:bg-white/10")
            }
          >
            Delivery
          </button>
        
          <button
            type="button"
            onClick={() => setDeliveryMethod("collection")}
            className={
              "flex-1 rounded-xl border px-3 py-2 text-sm font-semibold transition " +
              (delivery_method === "collection"
                ? "border-white/60 bg-white/15 text-white"
                : "border-white/25 bg-black/20 text-white/80 hover:bg-white/10")
            }
          >
            Collection
          </button>
        </div>

        {!isSubscription && (
          <div className="md:col-span-2 pl-3 text-sm text-white/80">
            {delivery_method === "delivery" ? "Dispatch date" : "Collection date"}:{" "}
            <span className="font-semibold text-white">
              {formatDateUK(date)} ({weekdayFromISO(date)})
            </span>
          </div>
        )}

        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Order note (optional)"
          className="rounded-xl border border-white/30 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:ring-2 focus:ring-white/40 md:col-span-2"
        />
      </div>

      {/* Gift code */}
      {!isSubscription && (
        <div className="mt-4 md:col-span-2">
          <div className="flex gap-2">
            <input
              value={giftCode}
              onChange={(e) => setGiftCode(e.target.value)}
              placeholder="Enter gift code"
              className="flex-1 rounded-xl border border-white/30 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:ring-2 focus:ring-white/40"
            />

            {discountPercent > 0 ? (
              <div className="px-3 py-2 rounded-xl bg-emerald-500/20 border border-emerald-400/30 text-emerald-200 text-sm font-semibold">
                Applied: 10% off
              </div>
            ) : giftStrQty > 0 ? (
              <div className="px-3 py-2 rounded-xl bg-emerald-500/20 border border-emerald-400/30 text-emerald-200 text-sm font-semibold">
                Applied: +1 free STR
              </div>
            ) : (
              <div className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white/60 text-sm">
                Not applied
              </div>
            )}
          </div>
        </div>
      )}

      {/* summary */}
      {qtyTotal > 0 && (
        <div className="mt-4 rounded-2xl bg-black/40 border border-white/15 p-4 text-sm text-white/85">
          <div className="font-semibold mb-2">Summary</div>
          <div className="grid sm:grid-cols-2 gap-2">
            <div>
              {lines.map((l, i) => (
                <div key={i}>• {l}</div>
              ))}
            </div>
            <div>
              <div className="mb-1">Bottles: {qtyTotal}</div>
              {plainRemainder > 0 && <div>PLN: {plainRemainder} × £2.10</div>}
              {plainBundles > 0 && <div>Free PLN (7 for 6): {plainBundles}</div>}
              {flavRemainder > 0 && <div>Flavoured: {flavRemainder} × £2.20</div>}
              {flavBundles > 0 && <div>Free flavoured (7 for 6): {flavBundles}</div>}

              {deliveryFee > 0 && !freeDeliveryUnlocked && (
                <div className="mt-1">Delivery: {gbp(deliveryFee)}</div>
              )}

              {delivery_method === "delivery" && freeDeliveryUnlocked && (
                <div className="mt-1 text-emerald-400">
                  Free delivery unlocked (orders over £50)
                </div>
              )}

              {totalsWithGift.discount > 0 && (
                <div className="flex justify-between text-emerald-400 mt-1">
                  <span>{normalizedGiftCode} (10% off)</span>
                  <span>−{gbp(totalsWithGift.discount)}</span>
                </div>
              )}

              {savings > 0 && (
                <div className="flex justify-between text-emerald-400 mt-1">
                  <span>You save</span>
                  <span>−{gbp(savings)}</span>
                </div>
              )}

              <div className="font-semibold mt-1">Total due: {gbp(total)}</div>
            </div>
          </div>
        </div>
      )}

      {error && <p className="mt-3 text-sm text-rose-300">{error}</p>}

      <div className="mt-5 flex flex-col sm:flex-row gap-3">
        {/* STRIPE */}
        <button
          disabled={sending}
          onClick={async () => {
            if (!validateBeforePay()) return;

            setSending(true);
            setError("");

            try {
              // ✅ STEP 1: save draft BEFORE redirecting away
              const draft = {
                cart,
                totals: totalsWithGift,
                customer: {
                  name,
                  email,
                  phone,
                  address: fullAddress,
                },
                delivery_method,
                delivery_date_iso: date,       // important for restoring <select>
                delivery_date: formattedDate,  // optional, nice for emails/records
                delivery_window: deliveryWindow,
                note,
                lines,
                gift_code: normalizedGiftCode,
                discount_percent: discountPercent,
                gift_str_qty: giftStrQty,
                savedAt: Date.now(),
                provider: "stripe",
              };
              sessionStorage.setItem("yoy_checkout_draft", JSON.stringify(draft));

              const endpoint = isSubscription
                ? "/api/stripe/create-subscription-session"
                : "/api/stripe/create-checkout-session";

              const res = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  cart,
                  totals: totalsWithGift,
                  lines,
                  subscriptionPlan,
                  customer: {
                    name,
                    email,
                    phone,
                    address: fullAddress,
                  },
                  delivery_method,
                  delivery_date: formattedDate,
                  delivery_window: deliveryWindow,
                  note,
                  gift_code: normalizedGiftCode,
                  discount_percent: discountPercent,
                  gift_str_qty: giftStrQty,
                }),
              });

              const text = await res.text();
              let data: any = {};
              try {
                data = JSON.parse(text);
              } catch {}

              if (!res.ok) {
                console.error("Checkout error:", text);
                setError(data?.error || "Checkout failed (server error).");
                return;
              }

              if (data?.url) {
                window.location.href = data.url;
              } else {
                setError("Stripe checkout failed.");
              }
            } catch (e) {
              console.error(e);
              setError("Stripe checkout failed.");
            } finally {
              setSending(false);
            }
          }}
          className="sm:w-72 h-12 rounded-2xl px-1 text-sm font-semibold text-white bg-[#635BFF] hover:bg-[#5147ff] transition flex items-center justify-center"
        >
          <img src="/stripe_logo.png" alt="Stripe" className="h-14" />
          <span className="text-white mr-2">|</span>
          <span>{sending ? "Processing…" : `Pay ${gbp(total)}`}</span>
        </button>

        {/* PAYPAL */}
        {/*<button
          disabled={sending}
          onClick={async () => {
            if (!validateBeforePay()) return;
          
            setSending(true);
            setError("");
          
            try {
              // ✅ SAVE DRAFT (same as Stripe)
              const draft = {
                cart,
                totals: totalsWithGift,
                customer: {
                  name,
                  email,
                  phone,
                  address: fullAddress,
                },
                delivery_method,
                delivery_date_iso: date,
                delivery_date: formattedDate,
                delivery_window: deliveryWindow,
                note,
                lines,
                gift_code: normalizedGiftCode,
                discount_percent: discountPercent,
                gift_str_qty: giftStrQty,
                savedAt: Date.now(),
                provider: "paypal",
              };
              sessionStorage.setItem("yoy_checkout_draft", JSON.stringify(draft));
          
              const res = await fetch("/api/paypal/create-order", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  cart,
                  totals: totalsWithGift,
                  lines,
                  customer: { name, email, phone, address: fullAddress },
                  delivery_method,
                  delivery_date: formattedDate,
                  delivery_window: deliveryWindow,
                  note,
                  gift_code: normalizedGiftCode,
                  discount_percent: discountPercent,
                  gift_str_qty: giftStrQty,
                }),
              });
          
              const text = await res.text();
              let data: any = {};
              try { data = JSON.parse(text); } catch {}
          
              if (!res.ok) {
                console.error("Checkout error:", text);
                setError(data?.error || "Checkout failed (server error).");
                return;
              }
          
              if (data?.approvalUrl) {
                window.location.href = data.approvalUrl;
              } else {
                setError("PayPal checkout failed.");
              }
            } catch (e) {
              console.error(e);
              setError("PayPal checkout failed.");
            } finally {
              setSending(false);
            }
          }}
          className="sm:w-72 h-12 rounded-2xl px-1 py-1 text-sm font-semibold bg-[#ffc439] text-slate-900 hover:bg-[#ffcf43] transition flex items-center justify-center"
        >
          <img
            src="/paypal_logo.png"
            alt="Pay with PayPal"
            className="h-6"
           />
        </button>*/}

        <button
          onClick={onClose}
          className="sm:w-72 h-12 rounded-2xl border border-white/30 px-1 py-3 text-sm font-semibold text-white hover:bg-white/10 transition"
        >
          Cancel
        </button>
      </div>

      <p className="mt-3 text-center text-xs text-white/50 flex items-center justify-center gap-1.5">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5">
          <path fillRule="evenodd" d="M12 1.5a5.25 5.25 0 0 0-5.25 5.25v3a3 3 0 0 0-3 3v6.75a3 3 0 0 0 3 3h10.5a3 3 0 0 0 3-3v-6.75a3 3 0 0 0-3-3v-3c0-2.9-2.35-5.25-5.25-5.25Zm3.75 8.25v-3a3.75 3.75 0 1 0-7.5 0v3h7.5Z" clipRule="evenodd" />
        </svg>
        Secure checkout · payments processed by Stripe
      </p>
    </Modal>
  );
}

function Modal({
  onClose,
  title,
  children,
}: {
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  React.useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50">
      {/* Dim / blur the page behind */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
      />

      {/* Centered frosted panel */}
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div
          className="w-full max-w-lg rounded-2xl border border-white/20 shadow-2xl p-6 text-white backdrop-blur-sm max-h-[85vh] overflow-y-auto overscroll-contain"
          style={{
            // REAL transparency – same vibe as the drawer
            backgroundColor: "rgba(0, 0, 0, 0.55)",
          }}
        >
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">{title}</h3>
            <button
              onClick={onClose}
              aria-label="Close"
              className="rounded-full w-8 h-8 grid place-items-center hover:bg-white/10 transition"
            >
              ✕
            </button>
          </div>

          <div className="mt-3">{children}</div>
        </div>
      </div>
    </div>
  );
}

function ConfettiOverlay() {
  const pieces = Array.from({ length: 80 });

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden z-40">
      {pieces.map((_, i) => (
        <span
          key={i}
          className="confetti-piece"
          style={{
            left: Math.random() * 100 + "%",
            animationDelay: Math.random() * 1.5 + "s",
            backgroundColor: [
              "#fbbf24", // amber
              "#34d399", // emerald
              "#60a5fa", // blue
              "#f472b6", // pink
              "#e5e7eb", // soft white
            ][i % 5],
          }}
        />
      ))}
    </div>
  );
}

function Footer() {
  return (
    <footer
      className="relative aspect-[5120/1078] bg-no-repeat bg-contain bg-center text-white flex items-center"
      style={{
        backgroundImage: "url('/footer_bg.png')",
      }}
    >
      {/* Dark overlay for contrast */}
      <div className="absolute inset-0 bg-black/50" />

      <div
        className="
          relative z-10 mx-auto max-w-6xl
          grid grid-cols-4
          gap-3 sm:gap-4 md:gap-8
          px-3 sm:px-4 md:px-6
          items-center
          text-left md:text-left
          text-[10px] sm:text-xs md:text-sm
          leading-tight
          w-full
        "
      >
        {/* Logo */}
        <div className="flex justify-center md:justify-start min-w-0">
          <img
            src="logo_inverted_transparent.png"
            alt="Yoghurt of Youth Logo"
            className="h-10 sm:h-12 md:h-16 w-auto object-contain"
          />
        </div>

        {/* Rights (wraps instead of truncating) */}
        <div className="min-w-0">
          <p className="break-words">
            © {new Date().getFullYear()} Yoghurt of Youth.
            <br />
            All rights reserved.
          </p>
        </div>

        {/* Social Media */}
        <div className="flex justify-center md:justify-center gap-4">
          {/* Instagram */}
          <a
            href="https://www.instagram.com/yoghurtofyouth"
            target="_blank"
            rel="noreferrer"
          >
            <img
              src="instagram_icon.png"
              alt="Instagram"
              className="h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8 opacity-90 hover:opacity-100 transition"
            />
          </a>
        </div>

        {/* Google Maps link */}
        <div className="flex justify-center md:justify-end">
          <a
            href="https://www.google.com/maps/search/?api=1&query=11+Billinge+Avenue,+Blackburn,+Lancashire,+BB2+6SD"
            target="_blank"
            rel="noreferrer"
          >
            <img
              src="maps_icon.png"
              alt="Google Maps"
              className="h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8 opacity-90 hover:opacity-100 transition"
            />
          </a>
        </div>
      </div>
    </footer>
  );
}
