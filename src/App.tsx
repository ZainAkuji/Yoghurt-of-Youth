import React, { useEffect, useMemo, useState } from "react";

/** App code (trimmed for brevity in the generator) — identical to the canvas version **/

// ---------- Configuration ----------
const BRAND = "Yoghurt of Youth";
const OWNER_EMAIL = "zainul_a@hotmail.co.uk";
const OWNER_PHONE = "+44 7756231844"; // optional

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

// EmailJS
const EMAILJS_SERVICE_ID = "service_oh51win";
const EMAILJS_TEMPLATE_ID = "template_yoghurtofyouth";
const EMAILJS_PUBLIC_KEY = "-Ko2GYKHx1EYIJgM5";

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
  // --- base SKUs (keep for backwards compatibility) ---
  {
    id: "PRCXN",
    name: "PRCXN",
    price: 2.0,
    size: "250 mL",
    desc: "Classic dairy yoghurt fermented with *L. reuteri* DSM 17648. Targets *H. pylori*.",
    tags: ["Classic", "DSM 17648"],
    img: "/prcxn.png",
  },
  {
    id: "PRCXN LF",
    name: "PRCXN LF",
    price: 2.0,
    size: "250 mL",
    desc: "Lactose-free dairy yoghurt, fermented with *L. reuteri* DSM 17648. Targets *H. pylori*.",
    tags: ["Lactose-free", "DSM 17648"],
    img: "/prcxn.png",
  },
  {
    id: "SPCTRL",
    name: "SPCTRL",
    price: 2.0,
    size: "250 mL",
    desc: "Classic dairy yoghurt fermented with *L. reuteri* DSM 17938. Targets harmful microbes including *Candida*.",
    tags: ["Classic", "DSM 17938"],
    img: "/spctrl.png",
  },
  {
    id: "SPCTRL LF",
    name: "SPCTRL LF",
    price: 2.0,
    size: "250 mL",
    desc: "Lactose-free dairy yoghurt, fermented with *L. reuteri* DSM 17938. Targets harmful microbes including *Candida*.",
    tags: ["Lactose-free", "DSM 17938"],
    img: "/spctrl.png",
  },

  // --- PRCXN flavours (standard) ---
  {
    id: "PRCXN_PLN",
    name: "PRCXN PLN",
    price: 2.0,
    size: "250 mL",
    desc: "Plain PRCXN yoghurt fermented with *L. reuteri* DSM 17648. Targets *H. pylori*.",
    tags: ["PRCXN", "Plain"],
    img: "/prcxn.png",
  },
    {
    id: "PRCXN_BFC",
    name: "PRCXN BFC",
    price: 3.0,
    size: "250 mL",
    desc: "Black forest chocolate PRCXN yoghurt fermented with *L. reuteri* DSM 17648. Targets *H. pylori*.",
    tags: ["PRCXN", "Black forest chocolate"],
    img: "/prcxn.png",
  },
  {
    id: "PRCXN_STR",
    name: "PRCXN STR",
    price: 3.0,
    size: "250 mL",
    desc: "Strawberry PRCXN yoghurt fermented with *L. reuteri* DSM 17648. Targets *H. pylori*.",
    tags: ["PRCXN", "Strawberry"],
    img: "/prcxn.png",
  },
  {
    id: "PRCXN_MNG",
    name: "PRCXN MNG",
    price: 3.0,
    size: "250 mL",
    desc: "Mango PRCXN yoghurt fermented with *L. reuteri* DSM 17648. Targets *H. pylori*.",
    tags: ["PRCXN", "Mango"],
    img: "/prcxn.png",
  },

  // --- PRCXN flavours (lactose-free) ---
  {
    id: "PRCXN_LF_PLN",
    name: "PRCXN LF PLN",
    price: 2.0,
    size: "250 mL",
    desc: "Lactose-free plain PRCXN yoghurt fermented with *L. reuteri* DSM 17648. Targets *H. pylori*.",
    tags: ["PRCXN", "Lactose-free", "Plain"],
    img: "/prcxn.png",
  },
  {
    id: "PRCXN_LF_BFC",
    name: "PRCXN LF BFC",
    price: 3.0,
    size: "250 mL",
    desc: "Lactose-free black forest chocolate PRCXN yoghurt fermented with *L. reuteri* DSM 17648. Targets *H. pylori*.",
    tags: ["PRCXN", "Lactose-free", "Black forest chocolate"],
    img: "/prcxn.png",
  },
  {
    id: "PRCXN_LF_STR",
    name: "PRCXN LF STR",
    price: 3.0,
    size: "250 mL",
    desc: "Lactose-free strawberry PRCXN yoghurt fermented with *L. reuteri* DSM 17648. Targets *H. pylori*.",
    tags: ["PRCXN", "Lactose-free", "Strawberry"],
    img: "/prcxn.png",
  },
  {
    id: "PRCXN_LF_MNG",
    name: "PRCXN LF MNG",
    price: 3.0,
    size: "250 mL",
    desc: "Lactose-free mango PRCXN yoghurt fermented with *L. reuteri* DSM 17648. Targets *H. pylori*.",
    tags: ["PRCXN", "Lactose-free", "Mango"],
    img: "/prcxn.png",
  },

  // --- SPCTRL flavours (standard) ---
  {
    id: "SPCTRL_PLN",
    name: "SPCTRL PLN",
    price: 2.0,
    size: "250 mL",
    desc: "Plain SPCTRL yoghurt fermented with *L. reuteri* DSM 17938. Targets harmful microbes including *Candida*.",
    tags: ["SPCTRL", "Plain"],
    img: "/spctrl.png",
  },
  {
    id: "SPCTRL_BFC",
    name: "SPCTRL BFC",
    price: 3.0,
    size: "250 mL",
    desc: "Black forest chocolate SPCTRL yoghurt fermented with *L. reuteri* DSM 17938. Targets harmful microbes including *Candida*.",
    tags: ["SPCTRL", "Black forest chocolate"],
    img: "/spctrl.png",
  },
  {
    id: "SPCTRL_STR",
    name: "SPCTRL STR",
    price: 3.0,
    size: "250 mL",
    desc: "Strawberry SPCTRL yoghurt fermented with *L. reuteri* DSM 17938. Targets harmful microbes including *Candida*.",
    tags: ["SPCTRL", "Strawberry"],
    img: "/spctrl.png",
  },
  {
    id: "SPCTRL_MNG",
    name: "SPCTRL MNG",
    price: 3.0,
    size: "250 mL",
    desc: "Mango SPCTRL yoghurt fermented with *L. reuteri* DSM 17938. Targets harmful microbes including *Candida*.",
    tags: ["SPCTRL", "Mango"],
    img: "/spctrl.png",
  },

  // --- SPCTRL flavours (lactose-free) ---
  {
    id: "SPCTRL_LF_PLN",
    name: "SPCTRL LF PLN",
    price: 2.0,
    size: "250 mL",
    desc: "Lactose-free plain SPCTRL yoghurt fermented with *L. reuteri* DSM 17938. Targets harmful microbes including *Candida*.",
    tags: ["SPCTRL", "Lactose-free", "Plain"],
    img: "/spctrl.png",
  },
  {
    id: "SPCTRL_LF_BFC",
    name: "SPCTRL LF BFC",
    price: 3.0,
    size: "250 mL",
    desc: "Lactose-free black forest chocolate SPCTRL yoghurt fermented with *L. reuteri* DSM 17938. Targets harmful microbes including *Candida*.",
    tags: ["SPCTRL", "Lactose-free", "Black forest chocolate"],
    img: "/spctrl.png",
  },
  {
    id: "SPCTRL_LF_STR",
    name: "SPCTRL LF STR",
    price: 3.0,
    size: "250 mL",
    desc: "Lactose-free strawberry SPCTRL yoghurt fermented with *L. reuteri* DSM 17938. Targets harmful microbes including *Candida*.",
    tags: ["SPCTRL", "Lactose-free", "Strawberry"],
    img: "/spctrl.png",
  },
  {
    id: "SPCTRL_LF_MNG",
    name: "SPCTRL LF MNG",
    price: 3.0,
    size: "250 mL",
    desc: "Lactose-free mango SPCTRL yoghurt fermented with *L. reuteri* DSM 17938. Targets harmful microbes including *Candida*.",
    tags: ["SPCTRL", "Lactose-free", "Mango"],
    img: "/spctrl.png",
  },
];


const GROUPED = [
  {
    key: "prcxn",
    title: "PRCXN",
    blurb: <>Yoghurt fermented by <em>L. reuteri</em> DSM 17648.<br />
      1 trillion CFU.<br />
      Targets <em>H. pylori</em>.<br />
      Pair with SPCTRL for full gut restoration.<br />
      No added sweeteners.<br />
      Lactose-free available.<br />
      250ml..</>,
    img: "prcxn.png",
    variants: [
      { id: "PRCXN", label: "PRCXN" },
      { id: "PRCXN LF", label: "PRCXN LF" },
    ],
  },
  {
    key: "spctrl",
    title: "SPCTRL",
    blurb: <>Yoghurt fermented by <em>L. reuteri</em> DSM 17938.<br />
      1 trillion CFU.<br />
      Targets pathogens including <em>Candida</em>.<br />
      Pair with PRCXN for full gut restoration.<br />
      No added sweeteners.<br />
      Lactose-free available.<br />
      250ml.</>,
    img: "spctrl.png",
    variants: [
      { id: "SPCTRL", label: "SPCTRL" },
      { id: "SPCTRL LF", label: "SPCTRL LF" },
    ],
  },
];

function computeTotals(cart: Record<string, number>) {
  // expand cart into full product objects + qty
  const items = Object.entries(cart)
    .map(([id, qty]) => {
      const product = PRODUCTS.find((p) => p.id === id);
      if (!product) return null;
      return { ...product, qty };
    })
    .filter(Boolean) as Array<(typeof PRODUCTS)[number] & { qty: number }>;

  const qtyTotal = items.reduce((s, i) => s + i.qty, 0);

  // classify by price: £2 = "plain", £2.50 = "flavoured"
  const plainItems = items.filter((i) => i.price === 2.0);
  const flavItems = items.filter((i) => i.price === 3.0);

  const plainQty = plainItems.reduce((s, i) => s + i.qty, 0);
  const flavQty = flavItems.reduce((s, i) => s + i.qty, 0);

  // unit prices (taken from products so it's future-proof)
  const plainUnit = plainItems[0]?.price ?? 2.0;
  const flavUnit = flavItems[0]?.price ?? 3.0;

  // "no bundle" full price (for savings display)
  const plainSubtotalRaw = plainQty * plainUnit;
  const flavSubtotalRaw = flavQty * flavUnit;

  // ── NEW DEAL: 7 for the price of 6, separately for plain and flavoured ──
  const plainBundles = Math.floor(plainQty / 7);
  const plainRemainder = plainQty % 7;
  const plainBundleTotal =
    plainBundles * 6 * plainUnit + plainRemainder * plainUnit;

  const flavBundles = Math.floor(flavQty / 7);
  const flavRemainder = flavQty % 7;
  const flavBundleTotal =
    flavBundles * 6 * flavUnit + flavRemainder * flavUnit;

  // discounted total actually charged
  const total = plainBundleTotal + flavBundleTotal;

  // "full price" if no bundles at all
  const fullPrice = plainSubtotalRaw + flavSubtotalRaw;

  const savings = Math.max(0, fullPrice - total);

  // legacy combined bundle/remainder if you still show them anywhere
  const bundles = plainBundles + flavBundles;
  const remainder = plainRemainder + flavRemainder;

  return {
    items,
    qtyTotal,
    bundles,
    remainder,
    total,
    savings,
    // keep this name so your UI still works:
    plainSubtotal: fullPrice,
    plainQty,
    flavQty,
    plainBundles,
    flavBundles,
    plainRemainder,
    flavRemainder,
  };
}


function nextBundleHint(plainQty: number, flavQty: number) {
  // no items at all
  if (plainQty === 0 && flavQty === 0) {
    return "Bundles: PLN 7 for £10 · STR/MNG/BFC 5 for £10.";
  }

  const plainNeed = (7 - (plainQty % 7)) % 7; // how many plain to next 7-for-£10
  const flavNeed = (5 - (flavQty % 5)) % 5;   // how many flavoured to next 5-for-£10

  // already perfectly on both bundles
  if (plainNeed === 0 && plainQty > 0 && flavNeed === 0 && flavQty > 0) {
    return "You’re on all available bundles – great value.";
  }

  // only PLN in basket
  if (flavQty === 0 && plainQty > 0) {
    if (plainNeed === 0) return "You’re on the PLN 7-for-£10 bundle – great value.";
    return `Add ${plainNeed} more PLN to unlock the 7-for-£10 bundle.`;
  }

  // only flavoured in basket
  if (plainQty === 0 && flavQty > 0) {
    if (flavNeed === 0) return "You’re on the flavoured 5-for-£10 bundle – great value.";
    return `Add ${flavNeed} more flavoured to unlock the 5-for-£10 bundle.`;
  }

  // mix of PLN + flavoured
  const parts: string[] = [];

  if (plainNeed > 0) {
    parts.push(`add ${plainNeed} PLN for 7-for-£10`);
  } else if (plainQty > 0) {
    parts.push("PLN already on 7-for-£10");
  }

  if (flavNeed > 0) {
    parts.push(`add ${flavNeed} flavoured for 5-for-£10`);
  } else if (flavQty > 0) {
    parts.push("flavoured already on 5-for-£10");
  }

  return parts.join(" · ") + ".";
}


function AboutSection() {
  return (
    <section
      id="about"
      className="relative scroll-mt-32 md:scroll-mt-24 text-white py-12"
      style={{
        backgroundImage: "linear-gradient(rgba(0,0,0,0.50), rgba(0,0,0,0.50)), url('/about_bg.png')",
        backgroundSize: "cover",
        backgroundPosition: "78% center",
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
          Our two <em>L. reuteri</em> strains address this at the source — each through a complementary mechanism:
        </p>
        
        <ul className="mt-2 list-disc list-inside text-sm text-white space-y-1">
          <li>
            <strong>DSM&nbsp;17648 (“PRCXN”)</strong> selectively binds <em>Helicobacter pylori</em>
            in the stomach, forming harmless complexes that are naturally cleared through digestion.
            This physical binding reduces bacterial load and supports mucosal recovery.
          </li>
          <li>
            <strong>DSM&nbsp;17938 (“SPCTRL”)</strong> promotes a balanced gut environment by
            limiting the overgrowth of opportunistic species — including <em>Candida</em> —
            while reinforcing a healthy microbial community along the intestinal tract.
          </li>
        </ul>
        
        <p className="mt-2 text-white text-sm leading-relaxed">
          Used together — for example by alternating them daily or weekly —
          <strong>PRCXN and SPCTRL act in synergy</strong>:
          one targets <em>H.&nbsp;pylori</em> directly in the stomach, while the other restores microbial
          diversity and suppresses residual pathogens downstream. This dual approach
          helps reduce the microbial imbalance that allows <em>H.&nbsp;pylori</em> and similar organisms
          to persist, supporting both gastric comfort and long-term gut stability.
        </p>
        
        <p className="mt-2 text-white text-sm leading-relaxed">
          When both yoghurts are taken in rotation, they help create a more resilient digestive ecosystem —
          one less prone to chronic irritation, reflux, bloating, and secondary infections —
          laying a foundation for lasting digestive harmony and whole-body wellbeing.
        </p>

        <p className="mt-2 text-white text-sm leading-relaxed">
          Each bottle of yoghurt contains 250&nbsp;ml,
          delivering live counts on the order of <strong>one trillion CFU</strong> — a level consistent
          with genuine biological effect. For best results, enjoy one serving on an empty stomach,
          around <strong>60&nbsp;minutes before a meal</strong>, to allow the beneficial bacteria to reach
          the gut unimpeded.
        </p>
        
        <p className="mt-2 text-white text-sm leading-relaxed">
          During the first few days, some people may notice mild digestive upsets such as increased movement,
          temporary bloating, or mild warmth in the stomach. These signs usually indicate that the
          probiotics are <strong>actively displacing unwanted microbes</strong> and restoring balance.
          Such effects are normal and typically fade early on, with health benefits gradually appearing
          over a longer time frame so long as the yoghurt is consistently taken.
        </p>
        
        <p className="mt-2 text-white text-sm leading-relaxed">
          Everyone’s gut is unique — and so is their response.
          If you experience negative reactions, please try the <strong>lactose-free</strong> options.
          We find that the issue is most often due to lactose intolerance.
          If you would like personalised guidance on how to ease the transition, please reach out to us.
          We’re happy to help you find the rhythm that suits your body best.
        </p>

        {/* NAC adjunct info */}
        <h3 className="mt-8 text-xl font-semibold text-white">
          Optional: NAC alongside your yoghurt
        </h3>
        <p className="mt-2 text-white text-sm leading-relaxed">
          <strong>N-acetylcysteine (NAC)</strong> is a mucolytic antioxidant that can help
          <em> disrupt microbial biofilms</em> in the stomach — including those formed by
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
          For example, many individuals take <strong>600 mg twice daily</strong> — once in the morning and once
          in the late afternoon or evening — though exact routines can vary depending on tolerance
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
          It is advised to do the following:
        </p>

        <div className="mt-2 text-sm text-white leading-relaxed">
          <ul className="list-disc list-inside space-y-1">
            <li>Shake well before use.</li>
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
            <a href="tel:+447756231844" className="underline hover:text-white">
              07756 231 844
            </a>
          </p>
          <p className="text-xs text-white">We aim to respond within one working day.</p>
        </div>
      </div>
    </section>
  );
}

export default function App(){
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<Record<string,number>>(()=>{ try{ return JSON.parse(localStorage.getItem("yoy_cart") || "{}"); }catch{ return {}; }});
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [reserveOpen, setReserveOpen] = useState(false);
  useEffect(()=>{ localStorage.setItem("yoy_cart", JSON.stringify(cart)); }, [cart]);

  const results = useMemo(()=>{
    if(!query) return PRODUCTS;
    const q = query.toLowerCase();
    return PRODUCTS.filter(p => p.name.toLowerCase().includes(q) || p.desc.toLowerCase().includes(q) || p.tags.join(" ").toLowerCase().includes(q));
  }, [query]);

  const {
    items,
    qtyTotal,
    bundles,
    remainder,
    total,
    savings,
    plainSubtotal,
    plainQty,
    flavQty,
    plainBundles,
    flavBundles,
    plainRemainder,
    flavRemainder,
  } = computeTotals(cart);
  const add = (id:string)=> setCart(c=>({ ...c, [id]: (c[id]||0)+1 }));
  const sub = (id:string)=> setCart(c=>{ const n={...c}; if(!n[id]) return n; n[id]--; if(n[id]<=0) delete n[id]; return n; });
  const remove = (id:string)=> setCart(c=>{ const n={...c}; delete n[id]; return n; });
  const clear = ()=> setCart({});

  return (
    <div className="scroll-smooth min-h-screen bg-gradient-to-b from-white to-slate-50 text-slate-800">
      <Header brand={BRAND} query={query} setQuery={setQuery} itemsCount={qtyTotal} openCart={()=>setDrawerOpen(true)} />

      {/* Hero Section */}
      <section
        id="hero"
        className="relative w-full overflow-hidden bg-black"
        style={{ aspectRatio: "16 / 9" }} // keeps proportions clean during load
      >
        {/* Video background */}
        <video
          className="absolute inset-0 w-full h-full object-cover"
          src="/breaking.mp4"
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
            It isn't hard to tell.
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
      
      {/* SHOP */}
      <section id="shop" className="scroll-mt-32 md:scroll-mt-24 w-full">
        {/* MOBILE STACKED LAYOUT: hero + flavours per yoghurt */}
        <div className="grid grid-cols-1 gap-0 w-full md:hidden">
          {GROUPED
            .filter((g) => {
              const q = (query || "").toLowerCase();
              return (
                !q ||
                g.title.toLowerCase().includes(q) ||
                g.variants.some((v) => v.label.toLowerCase().includes(q))
              );
            })
            .map((g, idx) => {
              const isPRCXN = g.key === "prcxn";
        
              const flavourBg = isPRCXN
                ? "/prcxn_flavour_bg.PNG"
                : g.key === "spctrl"
                ? "/spctrl_flavour_bg.PNG"
                : g.img;
        
              const ids = isPRCXN
                ? {
                    baseLabel: "PRCXN",
                    lfLabel: "PRCXN LF (lactose free)",
                    PLN_STD: "PRCXN_PLN",
                    STR_STD: "PRCXN_STR",
                    MNG_STD: "PRCXN_MNG",
                    BFC_STD: "PRCXN_BFC",
                    PLN_LF: "PRCXN_LF_PLN",
                    STR_LF: "PRCXN_LF_STR",
                    MNG_LF: "PRCXN_LF_MNG",
                    BFC_LF: "PRCXN_LF_BFC",
                  }
                : {
                    baseLabel: "SPCTRL",
                    lfLabel: "SPCTRL LF (lactose free)",
                    PLN_STD: "SPCTRL_PLN",
                    STR_STD: "SPCTRL_STR",
                    MNG_STD: "SPCTRL_MNG",
                    BFC_STD: "SPCTRL_BFC",
                    PLN_LF: "SPCTRL_LF_PLN",
                    STR_LF: "SPCTRL_LF_STR",
                    MNG_LF: "SPCTRL_LF_MNG",
                    BFC_LF: "SPCTRL_LF_BFC",
                  };
        
              const qty = (id: string) => cart[id] || 0;
        
              const totalPlain = qty(ids.PLN_STD) + qty(ids.PLN_LF);
        
              const totalFlavoured =
                qty(ids.STR_STD) +
                qty(ids.STR_LF) +
                qty(ids.MNG_STD) +
                qty(ids.MNG_LF) +
                qty(ids.BFC_STD) +
                qty(ids.BFC_LF);

              const plainOnBundle = totalPlain >= 7;
              const flavOnBundle = totalFlavoured >= 7;
              const freeDeliveryUnlocked = total >= 20; // total from computeTotals(cart)
              
              return (
                <div key={g.key + "-mobile"} className="w-full">
                  {/* HERO PANEL (same content as desktop, but mobile only) */}
                  <article className="relative aspect-[3/2] w-full overflow-hidden">
                    <img
                      src={g.img}
                      alt={g.title}
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/40" />
                    <div className="relative z-10 h-full flex flex-col justify-between p-6">
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-white mb-1">
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
        
                        <p className="mt-2 text-xs text-white max-w-md leading-relaxed">
                          {g.blurb}
                        </p>
                      </div>
                    </div>
                  </article>
        
                  {/* FLAVOUR PANEL (same logic as desktop, but uses mobile text sizes) */}
                  <article className="relative aspect-[3/2] w-full overflow-hidden">
                    <img
                      src={flavourBg}
                      alt={g.title + " flavours"}
                      className="absolute inset-0 w-full h-full object-cover"
                    />
        
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/55 to-black/30" />
        
                    <div className="relative z-10 h-full flex flex-col justify-between p-6">
                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-white mb-2">
                          Flavour selection
                        </p>
                      </div>
        
                      {/* flavour table */}
                      <div className="bg-black/35 rounded-xl p-2 backdrop-blur-sm">
                        <div className="grid grid-cols-[minmax(0,1.1fr)_repeat(2,minmax(0,1.4fr))] gap-px text-xs md:text-sm text-white">
                          {/* header row */}
                          <div className="bg-black/60 px-2 py-1.5 font-semibold uppercase tracking-wide">
                            Flavour
                          </div>
                          <div className="bg-black/60 px-2 py-1.5 text-center font-semibold">
                            {ids.baseLabel}
                          </div>
                          <div className="bg-black/60 px-2 py-1.5 text-center font-semibold">
                            {ids.lfLabel}
                          </div>
        
                          {/* PLN row */}
                          <div className="bg-white/25 px-2 py-1.5 font-semibold text-xs md:text-sm">
                            PLN (plain)
                          </div>
                          <div className="bg-white/25 px-2 py-1.5">
                            <div className="flex items-center justify-center gap-2">
                                <button
                                  onClick={() => sub(ids.PLN_STD)}
                                  className="w-4 h-4 grid place-items-center rounded-lg bg-white/10 text-white hover:bg-white/20 transition leading-none"
                                  aria-label="Remove one plain"
                                >
                                  <span className="translate-y-[-1px] text-xs sm:text-sm font-semibold">
                                    −
                                  </span>
                                </button>
                                <span className="w-6 text-center text-[11px] sm:text-xs font-semibold qty-flash">
                                  {qty(ids.PLN_STD)}
                                </span>
                                <button
                                  onClick={() => add(ids.PLN_STD)}
                                  className="w-4 h-4 grid place-items-center rounded-lg bg-white text-slate-900 hover:bg-slate-200 transition leading-none"
                                  aria-label="Add one plain"
                                >
                                  <span className="translate-y-[-1px] text-xs sm:text-sm font-semibold">
                                    +
                                  </span>
                                </button>
                            </div>
                          </div>
                          <div className="bg-white/25 px-2 py-1.5">
                            <div className="flex items-center justify-center gap-2">
                                <button
                                  onClick={() => sub(ids.PLN_LF)}
                                  className="w-4 h-4 grid place-items-center rounded-lg bg-white/10 text-white hover:bg-white/20 transition leading-none"
                                  aria-label="Remove one plain LF"
                                >
                                  <span className="translate-y-[-1px] text-xs sm:text-sm font-semibold">
                                    −
                                  </span>
                                </button>
                                <span className="w-6 text-center text-[11px] sm:text-xs font-semibold qty-flash">
                                  {qty(ids.PLN_LF)}
                                </span>
                                <button
                                  onClick={() => add(ids.PLN_LF)}
                                  className="w-4 h-4 grid place-items-center rounded-lg bg-white text-slate-900 hover:bg-slate-200 transition leading-none"
                                  aria-label="Add one plain LF"
                                >
                                  <span className="translate-y-[-1px] text-xs sm:text-sm font-semibold">
                                    +
                                  </span>
                                </button>
                            </div>
                          </div>

                          {/* BFC row */}
                          <div className="bg-rose-900/40 px-2 py-1.5 font-semibold text-xs md:text-sm">
                            BFC (black forest chocolate)
                          </div>
                          <div className="bg-rose-900/40 px-2 py-1.5">
                            <div className="flex items-center justify-center gap-2">
                                <button
                                  onClick={() => sub(ids.BFC_STD)}
                                  className="w-4 h-4 grid place-items-center rounded-lg bg-black/20 text-white hover:bg-black/30 transition leading-none"
                                  aria-label="Remove one black forest chocolate"
                                >
                                  <span className="translate-y-[-1px] text-xs sm:text-sm font-semibold">
                                    −
                                  </span>
                                </button>
                                <span className="w-6 text-center text-[11px] sm:text-xs font-semibold qty-flash">
                                  {qty(ids.BFC_STD)}
                                </span>
                                <button
                                  onClick={() => add(ids.BFC_STD)}
                                  className="w-4 h-4 grid place-items-center rounded-lg bg-white text-slate-900 hover:bg-slate-200 transition leading-none"
                                  aria-label="Add one black forest chocolate"
                                >
                                  <span className="translate-y-[-1px] text-xs sm:text-sm font-semibold">
                                    +
                                  </span>
                                </button>
                            </div>
                          </div>
                          <div className="bg-rose-900/40 px-2 py-1.5">
                            <div className="flex items-center justify-center gap-2">
                                <button
                                  onClick={() => sub(ids.BFC_LF)}
                                  className="w-4 h-4 grid place-items-center rounded-lg bg-black/20 text-white hover:bg-black/30 transition leading-none"
                                  aria-label="Remove one black forest chocolate LF"
                                >
                                  <span className="translate-y-[-1px] text-xs sm:text-sm font-semibold">
                                    −
                                  </span>
                                </button>
                                <span className="w-6 text-center text-[11px] sm:text-xs font-semibold qty-flash">
                                  {qty(ids.BFC_LF)}
                                </span>
                                <button
                                  onClick={() => add(ids.BFC_LF)}
                                  className="w-4 h-4 grid place-items-center rounded-lg bg-white text-slate-900 hover:bg-slate-200 transition leading-none"
                                  aria-label="Add one black forest chocolate LF"
                                >
                                  <span className="translate-y-[-1px] text-xs sm:text-sm font-semibold">
                                    +
                                  </span>
                                </button>
                            </div>
                          </div>
        
                          {/* STR row */}
                          <div className="bg-pink-500/35 px-2 py-1.5 font-semibold text-xs md:text-sm">
                            STR (strawberry)
                          </div>
                          <div className="bg-pink-500/35 px-2 py-1.5">
                            <div className="flex items-center justify-center gap-2">
                                <button
                                  onClick={() => sub(ids.STR_STD)}
                                  className="w-4 h-4 grid place-items-center rounded-lg bg-black/20 text-white hover:bg-black/30 transition leading-none"
                                  aria-label="Remove one strawberry"
                                >
                                  <span className="translate-y-[-1px] text-xs sm:text-sm font-semibold">
                                    −
                                  </span>
                                </button>
                                <span className="w-6 text-center text-[11px] sm:text-xs font-semibold qty-flash">
                                  {qty(ids.STR_STD)}
                                </span>
                                <button
                                  onClick={() => add(ids.STR_STD)}
                                  className="w-4 h-4 grid place-items-center rounded-lg bg-white text-slate-900 hover:bg-slate-200 transition leading-none"
                                  aria-label="Add one strawberry"
                                >
                                  <span className="translate-y-[-1px] text-xs sm:text-sm font-semibold">
                                    +
                                  </span>
                                </button>
                            </div>
                          </div>
                          <div className="bg-pink-500/35 px-2 py-1.5">
                            <div className="flex items-center justify-center gap-2">
                                <button
                                  onClick={() => sub(ids.STR_LF)}
                                  className="w-4 h-4 grid place-items-center rounded-lg bg-black/20 text-white hover:bg-black/30 transition leading-none"
                                  aria-label="Remove one strawberry LF"
                                >
                                  <span className="translate-y-[-1px] text-xs sm:text-sm font-semibold">
                                    −
                                  </span>
                                </button>
                                <span className="w-6 text-center text-[11px] sm:text-xs font-semibold qty-flash">
                                  {qty(ids.STR_LF)}
                                </span>
                                <button
                                  onClick={() => add(ids.STR_LF)}
                                  className="w-4 h-4 grid place-items-center rounded-lg bg-white text-slate-900 hover:bg-slate-200 transition leading-none"
                                  aria-label="Add one strawberry LF"
                                >
                                  <span className="translate-y-[-1px] text-xs sm:text-sm font-semibold">
                                    +
                                  </span>
                                </button>
                            </div>
                          </div>
        
                          {/* MNG row */}
                          <div className="bg-amber-300/45 px-2 py-1.5 font-semibold text-xs md:text-sm">
                            MNG (mango)
                          </div>
                          <div className="bg-amber-300/45 px-2 py-1.5">
                            <div className="flex items-center justify-center gap-2">
                                <button
                                  onClick={() => sub(ids.MNG_STD)}
                                  className="w-4 h-4 grid place-items-center rounded-lg bg-black/20 text-white hover:bg-black/30 transition leading-none"
                                  aria-label="Remove one mango"
                                >
                                  <span className="translate-y-[-1px] text-xs sm:text-sm font-semibold">
                                    −
                                  </span>
                                </button>
                                <span className="w-6 text-center text-[11px] sm:text-xs font-semibold qty-flash">
                                  {qty(ids.MNG_STD)}
                                </span>
                                <button
                                  onClick={() => add(ids.MNG_STD)}
                                  className="w-4 h-4 grid place-items-center rounded-lg bg-white text-slate-900 hover:bg-slate-200 transition leading-none"
                                  aria-label="Add one mango"
                                >
                                  <span className="translate-y-[-1px] text-xs sm:text-sm font-semibold">
                                    +
                                  </span>
                                </button>
                            </div>
                          </div>
                          <div className="bg-amber-300/45 px-2 py-1.5">
                            <div className="flex items-center justify-center gap-2">
                                <button
                                  onClick={() => sub(ids.MNG_LF)}
                                  className="w-4 h-4 grid place-items-center rounded-lg bg-black/20 text-white hover:bg-black/30 transition leading-none"
                                  aria-label="Remove one mango LF"
                                >
                                  <span className="translate-y-[-1px] text-xs sm:text-sm font-semibold">
                                    −
                                  </span>
                                </button>
                                <span className="w-6 text-center text-[11px] sm:text-xs font-semibold qty-flash">
                                  {qty(ids.MNG_LF)}
                                </span>
                                <button
                                  onClick={() => add(ids.MNG_LF)}
                                  className="w-4 h-4 grid place-items-center rounded-lg bg-white text-slate-900 hover:bg-slate-200 transition leading-none"
                                  aria-label="Add one mango LF"
                                >
                                  <span className="translate-y-[-1px] text-xs sm:text-sm font-semibold">
                                    +
                                  </span>
                                </button>
                            </div>
                          </div>
        
                        </div>
                      </div>
        
                      {/* pricing + note with per-offer "in basket" badges */}
                      <div className="mt-3 text-sm text-white space-y-1.5">
                        <p className="flex flex-wrap items-center gap-2">
                          <span>
                            PLN: <strong>£2</strong> per bottle ·{" "}
                            <strong>Buy 7 get one FREE</strong>
                          </span>
                           {totalPlain > 0 ? (
                            <span
                              className={cn(
                                "inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] sm:text-xs shadow-md backdrop-blur-md",
                                plainOnBundle
                                  ? "bg-emerald-500/80 text-slate-900"
                                  : "bg-black/60 text-white"
                              )}
                            >
                              In basket:&nbsp;
                              <strong>{totalPlain}</strong>
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-black/60 px-2.5 py-0.5 text-[10px] sm:text-xs shadow-md backdrop-blur-md invisible">
                              In basket:&nbsp;
                              <strong>0</strong>
                            </span>
                          )}
                        </p>
        
                        <p className="flex flex-wrap items-center gap-2">
                          <span>
                            BFC, STR &amp; MNG: <strong>£3.00</strong> per bottle ·{" "}
                            <strong>Buy 7 get one FREE</strong>
                          </span>
                          {totalFlavoured > 0 ? (
                            <span
                              className={cn(
                                "inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] sm:text-xs shadow-md backdrop-blur-md",
                                flavOnBundle
                                  ? "bg-emerald-500/80 text-slate-900"
                                  : "bg-black/60 text-white"
                              )}
                            >
                              In basket:&nbsp;
                              <strong>{totalFlavoured}</strong>
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-black/60 px-2.5 py-0.5 text-[10px] sm:text-xs shadow-md backdrop-blur-md invisible">
                              In basket:&nbsp;
                              <strong>0</strong>
                            </span>
                          )}
                        </p>

                        {/* Delivery info + "Spent" badge */}
                        <p className="flex flex-wrap items-center gap-2">
                          <span>
                            Delivery £2 · <strong>FREE delivery on orders over £20</strong>
                          </span>

                          {total > 0 ? (
                            <span
                              className={cn(
                                "inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] sm:text-xs shadow-md backdrop-blur-md",
                                freeDeliveryUnlocked
                                  ? "bg-emerald-500/80 text-slate-900"
                                  : "bg-black/60 text-white"
                              )}
                            >
                              Spentt:&nbsp;
                              <strong>{gbp(total)}</strong>
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-black/60 px-2.5 py-0.5 text-[10px] sm:text-xs shadow-md backdrop-blur-md invisible">
                              Spent:&nbsp;
                              <strong>0</strong>
                            </span>
                          )}
                        </p>
                      </div>

                    </div>
                  </article>
                </div>
              );
            })}
        </div>

        
        {/* DESKTOP 2×2 LAYOUT (unchanged) */}
        <div className="hidden md:grid md:grid-cols-2 gap-0 w-full">
          {/* ───── TOP ROW: existing hero-style panels (no buttons) ───── */}
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
                key={g.key + "-hero"}
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
                <div className="relative z-10 h-full flex flex-col justify-between p-6 md:p-8">
                  <div>
                    <p className="text-xs sm:text-sm md:text-base uppercase tracking-[0.2em] text-white mb-1">
                      {idx === 0 ? "Targeted" : "Broad-acting"}
                    </p>
        
                    {/* logo / title */}
                    {g.key === "prcxn" ? (
                      <img
                        src="/prcxn_logo.png"
                        alt="PRCXN"
                        className="w-[60%] sm:w-[55%] md:w-[45%] object-contain drop-shadow-lg"
                      />
                    ) : g.key === "spctrl" ? (
                      <img
                        src="/spctrl_logo.png"
                        alt="SPCTRL"
                        className="w-[60%] sm:w-[55%] md:w-[45%] object-contain drop-shadow-lg"
                      />
                    ) : (
                      <h3 className="text-3xl font-bold text-white drop-shadow-md">
                        {g.title}
                      </h3>
                    )}
        
                    <p className="mt-2 text-xs sm:text-sm md:text-base text-white max-w-md leading-relaxed">
                      {g.blurb}
                    </p>
                  </div>
                </div>
              </article>
            ))}
        
          {/* ───── BOTTOM ROW: flavour tables for each panel ───── */}
          {GROUPED
            .filter((g) => {
              const q = (query || "").toLowerCase();
              return (
                !q ||
                g.title.toLowerCase().includes(q) ||
                g.variants.some((v) => v.label.toLowerCase().includes(q))
              );
            })
            .map((g) => {
              const isPRCXN = g.key === "prcxn";
  
              // flavour panel background (different from hero row)
              const flavourBg = isPRCXN
                ? "/prcxn_flavour_bg.PNG"
                : g.key === "spctrl"
                ? "/spctrl_flavour_bg.PNG"
                : g.img;
        
              // map strains to flavour IDs
              const ids = isPRCXN
                ? {
                    baseLabel: "PRCXN",
                    lfLabel: "PRCXN LF (lactose free)",
                    PLN_STD: "PRCXN_PLN",
                    STR_STD: "PRCXN_STR",
                    MNG_STD: "PRCXN_MNG",
                    BFC_STD: "PRCXN_BFC",
                    PLN_LF: "PRCXN_LF_PLN",
                    STR_LF: "PRCXN_LF_STR",
                    MNG_LF: "PRCXN_LF_MNG",
                    BFC_LF: "PRCXN_LF_BFC",
                  }
                : {
                    baseLabel: "SPCTRL",
                    lfLabel: "SPCTRL LF (lactose free)",
                    PLN_STD: "SPCTRL_PLN",
                    STR_STD: "SPCTRL_STR",
                    MNG_STD: "SPCTRL_MNG",
                    BFC_STD: "SPCTRL_BFC",
                    PLN_LF: "SPCTRL_LF_PLN",
                    STR_LF: "SPCTRL_LF_STR",
                    MNG_LF: "SPCTRL_LF_MNG",
                    BFC_LF: "SPCTRL_LF_BFC",
                  };
        
              const qty = (id: string) => cart[id] || 0;
  
              // total bottles in basket for this panel (all flavours)
              const totalPlain =
                qty(ids.PLN_STD) +
                qty(ids.PLN_LF);
              
              const totalFlavoured =
                qty(ids.STR_STD) +
                qty(ids.STR_LF) +
                qty(ids.MNG_STD) +
                qty(ids.MNG_LF) +
                qty(ids.BFC_STD) +
                qty(ids.BFC_LF);

              const plainOnBundle = totalPlain >= 7;
              const flavOnBundle = totalFlavoured >= 7;
              const freeDeliveryUnlocked = total >= 20; // total from computeTotals(cart)
              
              return (
                <article
                  key={g.key + "-flavours"}
                  className="relative aspect-[3/2] w-full overflow-hidden"
                >
                  {/* dedicated flavour background image */}
                  <img
                    src={flavourBg}
                    alt={g.title + " flavours"}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
        
                  {/* darker gradient for readability */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/55 to-black/30" />
        
                  <div className="relative z-10 h-full flex flex-col justify-between p-6">
                    {/* heading for flavour grid */}
                    <div>
                      <p className="text-xs sm:text-sm uppercase tracking-[0.18em] text-white mb-2">
                        Flavour selection
                      </p>
                    </div>
        
                    {/* flavour table */}
                    <div className="bg-black/35 rounded-xl p-2 sm:p-3 backdrop-blur-sm">
                      <div className="grid grid-cols-[minmax(0,1.1fr)_repeat(2,minmax(0,1.4fr))] gap-px text-xs md:text-sm text-white">
                        {/* header row */}
                        <div className="bg-black/60 px-2 py-1.5 font-semibold uppercase tracking-wide">
                          Flavour
                        </div>
                        <div className="bg-black/60 px-2 py-1.5 text-center font-semibold">
                          {ids.baseLabel}
                        </div>
                        <div className="bg-black/60 px-2 py-1.5 text-center font-semibold">
                          {ids.lfLabel}
                        </div>
        
                        {/* PLN row */}
                        <div className="bg-white/25 px-2 py-1.5 font-semibold text-xs md:text-sm">
                          PLN (plain)
                        </div>
                        <div className="bg-white/25 px-2 py-1.5">
                          <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => sub(ids.PLN_STD)}
                                className="w-7 h-7 grid place-items-center rounded-lg bg-white/10 text-white hover:bg-white/20 transition leading-none"
                                aria-label="Remove one PRCXN plain"
                              >
                                <span className="translate-y-[-1px] text-xs sm:text-sm font-semibold">
                                  −
                                </span>
                              </button>
                              <span
                                className="w-6 text-center text-[11px] sm:text-xs font-semibold qty-flash"
                              >
                                {qty(ids.PLN_STD)}
                              </span>
                              <button
                                onClick={() => add(ids.PLN_STD)}
                                className="w-7 h-7 grid place-items-center rounded-lg bg-white text-slate-900 hover:bg-slate-200 transition leading-none"
                                aria-label="Add one PRCXN plain"
                              >
                                <span className="translate-y-[-1px] text-xs sm:text-sm font-semibold">
                                  +
                                </span>
                              </button>
                          </div>
                        </div>
                        <div className="bg-white/25 px-2 py-1.5">
                          <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => sub(ids.PLN_LF)}
                                className="w-7 h-7 grid place-items-center rounded-lg bg-white/10 text-white hover:bg-white/20 transition leading-none"
                                aria-label="Remove one plain LF"
                              >
                                <span className="translate-y-[-1px] text-xs sm:text-sm font-semibold">
                                  −
                                </span>
                              </button>
                              <span className="w-6 text-center text-[11px] sm:text-xs font-semibold qty-flash">
                                {qty(ids.PLN_LF)}
                              </span>
                              <button
                                onClick={() => add(ids.PLN_LF)}
                                className="w-7 h-7 grid place-items-center rounded-lg bg-white text-slate-900 hover:bg-slate-200 transition leading-none"
                                aria-label="Add one plain LF"
                              >
                                <span className="translate-y-[-1px] text-xs sm:text-sm font-semibold">
                                  +
                                </span>
                              </button>
                          </div>
                        </div>

                        {/* BFC row */}
                        <div className="bg-rose-900/40 px-2 py-1.5 font-semibold text-xs md:text-sm">
                          BFC (black forest chocolate)
                        </div>
                        <div className="bg-rose-900/40 px-2 py-1.5">
                          <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => sub(ids.BFC_STD)}
                                className="w-7 h-7 grid place-items-center rounded-lg bg-black/20 text-white hover:bg-black/30 transition leading-none"
                                aria-label="Remove one black forest chocolate"
                              >
                                <span className="translate-y-[-1px] text-xs sm:text-sm font-semibold">
                                  −
                                </span>
                              </button>
                              <span className="w-6 text-center text-[11px] sm:text-xs font-semibold qty-flash">
                                {qty(ids.BFC_STD)}
                              </span>
                              <button
                                onClick={() => add(ids.BFC_STD)}
                                className="w-7 h-7 grid place-items-center rounded-lg bg-white text-slate-900 hover:bg-slate-200 transition leading-none"
                                aria-label="Add one black forest chocolate"
                              >
                                <span className="translate-y-[-1px] text-xs sm:text-sm font-semibold">
                                  +
                                </span>
                              </button>
                          </div>
                        </div>
                        <div className="bg-rose-900/40 px-2 py-1.5">
                          <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => sub(ids.BFC_LF)}
                                className="w-7 h-7 grid place-items-center rounded-lg bg-black/20 text-white hover:bg-black/30 transition leading-none"
                                aria-label="Remove one black forest chocolate LF"
                              >
                                <span className="translate-y-[-1px] text-xs sm:text-sm font-semibold">
                                  −
                                </span>
                              </button>
                              <span className="w-6 text-center text-[11px] sm:text-xs font-semibold qty-flash">
                                {qty(ids.BFC_LF)}
                              </span>
                              <button
                                onClick={() => add(ids.BFC_LF)}
                                className="w-7 h-7 grid place-items-center rounded-lg bg-white text-slate-900 hover:bg-slate-200 transition leading-none"
                                aria-label="Add one black forest chocolate LF"
                              >
                                <span className="translate-y-[-1px] text-xs sm:text-sm font-semibold">
                                  +
                                </span>
                              </button>
                          </div>
                        </div>
        
                        {/* STR row */}
                        <div className="bg-pink-500/35 px-2 py-1.5 font-semibold text-xs md:text-sm">
                          STR (strawberry)
                        </div>
                        <div className="bg-pink-500/35 px-2 py-1.5">
                          <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => sub(ids.STR_STD)}
                                className="w-7 h-7 grid place-items-center rounded-lg bg-black/20 text-white hover:bg-black/30 transition leading-none"
                                aria-label="Remove one strawberry"
                              >
                                <span className="translate-y-[-1px] text-xs sm:text-sm font-semibold">
                                  −
                                </span>
                              </button>
                              <span className="w-6 text-center text-[11px] sm:text-xs font-semibold qty-flash">
                                {qty(ids.STR_STD)}
                              </span>
                              <button
                                onClick={() => add(ids.STR_STD)}
                                className="w-7 h-7 grid place-items-center rounded-lg bg-white text-slate-900 hover:bg-slate-200 transition leading-none"
                                aria-label="Add one strawberry"
                              >
                                <span className="translate-y-[-1px] text-xs sm:text-sm font-semibold">
                                  +
                                </span>
                              </button>
                          </div>
                        </div>
                        <div className="bg-pink-500/35 px-2 py-1.5">
                          <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => sub(ids.STR_LF)}
                                className="w-7 h-7 grid place-items-center rounded-lg bg-black/20 text-white hover:bg-black/30 transition leading-none"
                                aria-label="Remove one strawberry LF"
                              >
                                <span className="translate-y-[-1px] text-xs sm:text-sm font-semibold">
                                  −
                                </span>
                              </button>
                              <span className="w-6 text-center text-[11px] sm:text-xs font-semibold qty-flash">
                                {qty(ids.STR_LF)}
                              </span>
                              <button
                                onClick={() => add(ids.STR_LF)}
                                className="w-7 h-7 grid place-items-center rounded-lg bg-white text-slate-900 hover:bg-slate-200 transition leading-none"
                                aria-label="Add one strawberry LF"
                              >
                                <span className="translate-y-[-1px] text-xs sm:text-sm font-semibold">
                                  +
                                </span>
                              </button>
                          </div>
                        </div>
        
                        {/* MNG row */}
                        <div className="bg-amber-300/45 px-2 py-1.5 font-semibold text-xs md:text-sm">
                          MNG (mango)
                        </div>
                        <div className="bg-amber-300/45 px-2 py-1.5">
                          <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => sub(ids.MNG_STD)}
                                className="w-7 h-7 grid place-items-center rounded-lg bg-black/20 text-white hover:bg-black/30 transition leading-none"
                                aria-label="Remove one mango"
                              >
                                <span className="translate-y-[-1px] text-xs sm:text-sm font-semibold">
                                  −
                                </span>
                              </button>
                              <span className="w-6 text-center text-[11px] sm:text-xs font-semibold qty-flash">
                                {qty(ids.MNG_STD)}
                              </span>
                              <button
                                onClick={() => add(ids.MNG_STD)}
                                className="w-7 h-7 grid place-items-center rounded-lg bg-white text-slate-900 hover:bg-slate-200 transition leading-none"
                                aria-label="Add one mango"
                              >
                                <span className="translate-y-[-1px] text-xs sm:text-sm font-semibold">
                                  +
                                </span>
                              </button>
                          </div>
                        </div>
                        <div className="bg-amber-300/45 px-2 py-1.5">
                          <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => sub(ids.MNG_LF)}
                                className="w-7 h-7 grid place-items-center rounded-lg bg-black/20 text-white hover:bg-black/30 transition leading-none"
                                aria-label="Remove one mango LF"
                              >
                                <span className="translate-y-[-1px] text-xs sm:text-sm font-semibold">
                                  −
                                </span>
                              </button>
                              <span className="w-6 text-center text-[11px] sm:text-xs font-semibold qty-flash">
                                {qty(ids.MNG_LF)}
                              </span>
                              <button
                                onClick={() => add(ids.MNG_LF)}
                                className="w-7 h-7 grid place-items-center rounded-lg bg-white text-slate-900 hover:bg-slate-200 transition leading-none"
                                aria-label="Add one mango LF"
                              >
                                <span className="translate-y-[-1px] text-xs sm:text-sm font-semibold">
                                  +
                                </span>
                              </button>
                          </div>
                        </div>
        
                      </div>
                    </div>
        
                    {/* pricing + note with per-offer "in basket" badges */}
                    <div className="mt-3 text-sm text-white space-y-1.5">
                      <p className="flex flex-wrap items-center gap-2">
                        <span>
                          PLN: <strong>£2</strong> per bottle ·{" "}
                          <strong>Buy 7 get one FREE</strong>
                        </span>
                         {totalPlain > 0 ? (
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] sm:text-xs shadow-md backdrop-blur-md",
                              plainOnBundle
                                ? "bg-emerald-500/80 text-slate-900"
                                : "bg-black/60 text-white"
                            )}
                          >
                            In basket:&nbsp;
                            <strong>{totalPlain}</strong>
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-black/60 px-2.5 py-0.5 text-[10px] sm:text-xs shadow-md backdrop-blur-md invisible">
                            In basket:&nbsp;
                            <strong>0</strong>
                          </span>
                        )}
                      </p>
      
                      <p className="flex flex-wrap items-center gap-2">
                        <span>
                          BFC, STR &amp; MNG: <strong>£3.00</strong> per bottle ·{" "}
                          <strong>Buy 7 get one FREE</strong>
                        </span>
                        {totalFlavoured > 0 ? (
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] sm:text-xs shadow-md backdrop-blur-md",
                              flavOnBundle
                                ? "bg-emerald-500/80 text-slate-900"
                                : "bg-black/60 text-white"
                            )}
                          >
                            In basket:&nbsp;
                            <strong>{totalFlavoured}</strong>
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-black/60 px-2.5 py-0.5 text-[10px] sm:text-xs shadow-md backdrop-blur-md invisible">
                            In basket:&nbsp;
                            <strong>0</strong>
                          </span>
                        )}
                      </p>

                      {/* Delivery info + "Spent" badge */}
                      <p className="flex flex-wrap items-center gap-2">
                        <span>
                          Delivery £2 · <strong>FREE delivery on orders over £20</strong>
                        </span>

                        {total > 0 ? (
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] sm:text-xs shadow-md backdrop-blur-md",
                              freeDeliveryUnlocked
                                ? "bg-emerald-500/80 text-slate-900"
                                : "bg-black/60 text-white"
                            )}
                          >
                            Spentt:&nbsp;
                            <strong>{gbp(total)}</strong>
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-black/60 px-2.5 py-0.5 text-[10px] sm:text-xs shadow-md backdrop-blur-md invisible">
                            Spent:&nbsp;
                            <strong>0</strong>
                          </span>
                        )}
                      </p>
                      
                    </div>
                    
                  </div>
                </article>
              );
            })}
        </div>
      </section>


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
          add={add}
          sub={sub}
          remove={remove}
          clear={clear}
          onReserve={() => {
            setDrawerOpen(false);
            setReserveOpen(true);
          }}
        />
      </Drawer>

      {reserveOpen && (
        <ReserveModal
          onClose={() => setReserveOpen(false)}
          cart={cart}
          totals={{
            qtyTotal,
            bundles,
            remainder,
            total,
            savings,
            plainSubtotal,
            plainQty,
            flavQty,
            plainBundles,
            flavBundles,
            plainRemainder,
            flavRemainder,
          }}
          onConfirmed={() => {
            // clear the basket after a successful reservation
            setCart({});
          }}
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
          backgroundImage: "url('skyline.png')",
          backgroundSize: "cover",
          backgroundPosition: `center ${scrolled ? "50%" : "50%"}`, // tweak for horizon
          backgroundRepeat: "no-repeat",
        }}
      >
        {/* Darken bottom for readability */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/30 to-black/55 pointer-events-none" />

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
                <a href="#visit" className="hover:text-amber-300 transition-colors">Collect</a>
              </div>

              {/* Basket button perfectly aligned */}
              <button
                onClick={openCart}
                className="flex items-center gap-1 border border-white/70 px-4 py-2 rounded-xl hover:bg-white/10 transition-all leading-none"
              >
                <span role="img" aria-label="basket">🧺</span>
                <span>Basket</span>
                {itemsCount > 0 && <span>({itemsCount})</span>}
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

function Basket({
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
  total: number;
  savings: number;
  plainBundles: number;
  flavBundles: number;
  plainRemainder: number;
  flavRemainder: number;
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
          <img
            src={i.img}
            alt=""
            className="w-16 h-12 rounded-lg ring-1 ring-white/20 object-cover"
          />
          <div className="flex-1">
            <div className="flex justify-between text-sm">
              <div>
                <div className="font-medium text-white">{i.name}</div>
                <div className="text-white/60">{i.size}</div>
              </div>
              {/* use real product price instead of hard-coded 2 */}
              <div className="font-medium text-white/90">
                £{(i.qty * i.price).toFixed(2)}
              </div>
            </div>

            <div className="mt-2 flex items-center gap-2">
              <button
                onClick={() => sub(i.id)}
                className="w-7 h-7 rounded-lg bg-white/10 text-white hover:bg-white/20 transition"
              >
                −
              </button>
              <span className="w-8 text-center text-sm">{i.qty}</span>
              <button
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
              </button>
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

        <div className="flex justify-between">
          <span>PLN</span>
          <span>{plainRemainder} × £2</span>
        </div>

        <div className="flex justify-between">
          <span>PLN bundles</span>
          <span>{plainBundles}</span>
        </div>

        <div className="flex justify-between">
          <span>Flavoured</span>
          <span>{flavRemainder} × £2.50</span>
        </div>

        <div className="flex justify-between">
          <span>Flavoured bundles</span>
          <span>{flavBundles}</span>
        </div>

        <div className="flex justify-between text-emerald-400">
          <span>You save</span>
          <span>−{gbp(savings)}</span>
        </div>
        <div className="flex justify-between font-semibold text-white">
          <span>Total due at collection</span>
          <span>{gbp(total)}</span>
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
          Reserve & choose collection time
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


// ---- helper functions ----
function earliestPickupISO() {
  const d = new Date();
  d.setDate(d.getDate() + 2);  // push date forward by 2 days
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDateUK(iso: string) {
  // iso expected like "2025-03-07"
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso || "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`; // dd/mm/yyyy
}

// Round current time up to next 30-minute boundary
function roundUpToNextSlot(date: Date) {
  const d = new Date(date);
  d.setSeconds(0, 0);
  const minutes = d.getMinutes();
  const remainder = minutes % PICKUP_INTERVAL_MIN;
  if (remainder !== 0) d.setMinutes(minutes + (PICKUP_INTERVAL_MIN - remainder));
  return d;
}

// Build list of valid time slots (today excludes past/too-soon)
function timeSlotsForDate(dateISO: string) {
  const slots: string[] = [];
  for (let h = PICKUP_START_HOUR; h <= PICKUP_END_HOUR; h++) {
    for (let m = 0; m < 60; m += PICKUP_INTERVAL_MIN) {
      slots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }

  const now = new Date();
  const selected = new Date(`${dateISO}T00:00:00`);
  const isToday =
    now.getFullYear() === selected.getFullYear() &&
    now.getMonth() === selected.getMonth() &&
    now.getDate() === selected.getDate();

  if (!isToday) return slots;

  const cutoff = roundUpToNextSlot(now);
  return slots.filter((hhmm) => {
    const [h, m] = hhmm.split(":").map((x) => parseInt(x, 10));
    const slot = new Date(selected);
    slot.setHours(h, m, 0, 0);
    return slot >= cutoff;
  });
}

// ---- main component ----
function ReserveModal({
  onClose,
  cart,
  totals,
  onConfirmed,
}: {
  onClose: () => void;
  cart: Record<string, number>;
  totals: any;
  onConfirmed: () => void;
}) {
  const {
    qtyTotal,
    bundles,
    remainder,
    total,
    plainQty,
    flavQty,
    plainBundles,
    flavBundles,
    plainRemainder,
    flavRemainder,
  } = totals;


  // mode: "form" for booking, "confirmed" after success
  const [mode, setMode] = useState<"form" | "confirmed">("form");

  // form state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [date, setDate] = useState(earliestPickupISO());
  const formattedDate = formatDateUK(date);

  const initialTime = (() => {
    const opts = timeSlotsForDate(earliestPickupISO());
    return opts[0] || "09:00";
  })();
  const [time, setTime] = useState(initialTime);
  const [note, setNote] = useState("");

  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  // for showing confirmation details inside the same modal
  const [orderInfo, setOrderInfo] = useState<null | {
    orderId: string;
    formattedDate: string;
    time: string;
    lines: string[];
    qtyTotal: number;
    bundles: number;
    remainder: number;
    totalText: string;
    address: string[];
    name: string;
  }>(null);

  const lines = Object.entries(cart).map(([id, qty]) => {
    const p = PRODUCTS.find((p) => p.id === id);
    return `${p?.name} × ${qty}`;
  });

  const subjectBase = `${BRAND} reservation – ${formattedDate} ${time} – ${name}`;
  const valid = name && email && phone && qtyTotal > 0 && date && time;

  async function sendEmail() {
    if (!valid) {
      alert("Please complete the form first.");
      return;
    }

    // extra validation: prevent yesterday / past times
    const [hh, mm] = (time || "00:00").split(":").map(Number);
    const pickupAt = new Date(`${date}T00:00:00`);
    pickupAt.setHours(hh || 0, mm || 0, 0, 0);

    const earliest = new Date(earliestPickupISO());
    earliest.setHours(0,0,0,0);
    if (pickupAt < earliest) {
      setError("Please choose a date at least 2 days from today.");
      return;
    }

    const now = new Date();
    const isSameDay =
      now.getFullYear() === pickupAt.getFullYear() &&
      now.getMonth() === pickupAt.getMonth() &&
      now.getDate() === pickupAt.getDate();

    if (isSameDay && pickupAt < roundUpToNextSlot(now)) {
      setError("Please choose the next available half-hour slot or later.");
      return;
    }

    setSending(true);
    setError("");

    try {
      const { default: emailjs } = await import("@emailjs/browser");
      const orderId = `YOY-${Date.now().toString().slice(-6)}`;
      const subjectWithId = `${subjectBase} – ${orderId}`;
      const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${MAPS_QUERY}`;

      await emailjs.send(
        EMAILJS_SERVICE_ID,
        EMAILJS_TEMPLATE_ID,
        {
          brand: BRAND,
          owner_email: OWNER_EMAIL,
          customer_name: name,
          customer_email: email,
          customer_phone: phone,
          pickup_date: formattedDate,      // UK format in email
          pickup_time: time,
          order_lines: lines.join("\n"),   // real newlines
          bottles: qtyTotal,
          bundles,
          remainder,
          total: gbp(total),
          address: ADDRESS_LINES.join(", "),
          note,
          order_id: orderId,
          maps_url: mapsUrl,
          subject: subjectWithId,
        },
        { publicKey: EMAILJS_PUBLIC_KEY }
      );

      // Save info for inline confirmation view
      setOrderInfo({
        orderId,
        formattedDate,
        time,
        lines,
        qtyTotal,
        bundles,
        remainder,
        totalText: gbp(total),
        address: [...ADDRESS_LINES],
        name,
      });

      // tell App to clear the basket
      onConfirmed();

      setMode("confirmed");
    } catch (e) {
      console.error(e);
      setError(
        "Email send failed. Please check your details or try again in a moment."
      );
    } finally {
      setSending(false);
    }
  }

  // -------- RENDER --------

  if (mode === "confirmed" && orderInfo) {
    const {
      orderId,
      formattedDate,
      time,
      lines,
      qtyTotal,
      bundles,
      remainder,
      totalText,
      address,
      name,
    } = orderInfo;

    return (
      <Modal onClose={onClose} title="Reservation confirmed">
        <p className="text-sm text-white/80">
          Thanks, <span className="font-semibold">{name}</span>. Your reservation
          has been received and a confirmation email has been sent.
        </p>

        <div className="mt-4 space-y-2 text-sm text-white/90">
          <div className="flex justify-between">
            <span className="text-white/60">Order ID</span>
            <span className="font-semibold">{orderId}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/60">Pickup</span>
            <span className="font-semibold">
              {time} on {formattedDate}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/60">Bottles</span>
            <span>
              {qtyTotal} (PLN {plainQty}, flavoured {flavQty})
            </span>
          </div>
          <div className="flex justify-between border-t border-white/20 pt-2 mt-2">
            <span className="font-semibold">Total due at collection</span>
            <span className="font-semibold">{totalText}</span>
          </div>
        </div>

        <div className="mt-4">
          <div className="font-semibold text-sm mb-1">Items</div>
          <ul className="list-disc pl-5 text-sm text-white/80 space-y-1">
            {lines.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
        </div>

        <div className="mt-4 text-sm text-white/80">
          <div className="font-semibold">Collect at</div>
          <address className="not-italic">
            {address.map((l, i) => (
              <div key={i}>{l}</div>
            ))}
          </address>
          <p className="mt-2 text-white/70">
            Payment on collection (<strong>cash or card</strong>).
          </p>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <button
            onClick={onClose}
            className="inline-flex rounded-2xl bg-white text-slate-900 px-5 py-3 text-sm font-semibold hover:bg-amber-300 transition"
          >
            Continue shopping
          </button>

          <a
            href={`https://www.google.com/maps/search/?api=1&query=${MAPS_QUERY}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex rounded-2xl border border-white/30 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10 transition"
          >
            Open in Google Maps
          </a>
        </div>

        <p className="mt-4 text-xs text-white/50">
          If you need to change your slot, please reply to the confirmation
          email and we’ll do our best to adjust.
        </p>
      </Modal>
    );
  }

  // -------- FORM MODE --------
  return (
    <Modal onClose={onClose} title="Reserve & Collect">
      <p className="text-sm text-white/80">
        Fill in your details and choose a collection slot. You’ll receive an
        email confirmation, and you pay on collection (cash or card).
      </p>

      <div className="mt-4 grid md:grid-cols-2 gap-4">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          placeholder="Full name"
          className="rounded-xl border border-white/30 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:ring-2 focus:ring-white/40"
        />
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          type="email"
          placeholder="Email"
          className="rounded-xl border border-white/30 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:ring-2 focus:ring-white/40"
        />
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          required
          type="tel"
          placeholder="Mobile number"
          className="rounded-xl border border-white/30 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:ring-2 focus:ring-white/40"
        />
        <input
          value={date}
          onChange={(e) => {
            const newDate = e.target.value;
            setDate(newDate);
            const opts = timeSlotsForDate(newDate);
            setTime(opts[0] || "");
          }}
          required
          type="date"
          min={earliestPickupISO()}
          className="rounded-xl border border-white/30 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-white/40"
        />
        <select
          value={time}
          onChange={(e) => setTime(e.target.value)}
          className="rounded-xl border border-white/30 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-white/40"
        >
          {timeSlotsForDate(date).map((t) => (
            <option key={t} value={t} className="bg-slate-900 text-white">
              {t}
            </option>
          ))}
        </select>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Order note (optional)"
          className="rounded-xl border border-white/30 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:ring-2 focus:ring-white/40"
        />
      </div>

      <div className="mt-5 rounded-2xl bg-black/40 border border-white/15 p-4 text-sm text-white/85">
        <div className="font-semibold mb-2">Summary</div>
        <div className="grid sm:grid-cols-2 gap-2">
          <div>
            {lines.map((l, i) => (
              <div key={i}>• {l}</div>
            ))}
          </div>
          <div>
            <div>Bottles: {qtyTotal}</div>
            <div>PLN bundles: {plainBundles} × £10</div>
            <div>PLN remainder: {plainRemainder} × £2</div>
            <div>Flavoured bundles: {flavBundles} × £10</div>
            <div>Flavoured remainder: {flavRemainder} × £2.50</div>
            <div className="font-semibold mt-1">
              Total due: {gbp(total)}
            </div>
          </div>
        </div>
      </div>

      {error && (
        <p className="mt-3 text-sm text-rose-300">
          {error}
        </p>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          onClick={sendEmail}
          className={cn(
            "inline-flex rounded-2xl px-5 py-3 text-sm font-semibold transition",
            valid
              ? "bg-white text-slate-900 hover:bg-amber-300"
              : "bg-white/10 text-white/40 cursor-not-allowed"
          )}
          disabled={!valid || sending}
        >
          {sending ? "Sending…" : "Confirm reservation"}
        </button>
        <button
          onClick={onClose}
          className="inline-flex rounded-2xl border border-white/30 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10 transition"
        >
          Close
        </button>
      </div>

      <p className="mt-4 text-xs text-white/50">
        By reserving you agree to collect at the chosen time and pay on
        collection (cash or card). If you need to change your slot, please
        reply to the confirmation email.
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
          className="w-full max-w-lg rounded-2xl border border-white/20 shadow-2xl p-6 text-white backdrop-blur-sm"
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

function Footer() {
  return (
    <footer
      className="relative bg-cover bg-center text-white flex items-center"
      style={{
        backgroundImage: "url('skyline_reflected.png')",
        backgroundPosition: "center 75%",
        height: "8rem", // same height as header (adjust if you like)
      }}
    >
      {/* Dark overlay for contrast */}
      <div className="absolute inset-0 bg-black/35" />

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
            href="https://www.instagram.com/yoghurtofyouth?igsh=MW1pdzg3amU4NGtvcQ=="
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
