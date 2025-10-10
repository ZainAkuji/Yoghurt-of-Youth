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

function todayISO() { const d = new Date(); d.setHours(0,0,0,0); return d.toISOString().slice(0,10); }

function timeSlotsArray(startHour: number, endHour: number, intervalMin: number) {
  const slots: string[] = [];
  const start = startHour * 60;
  const end = endHour * 60;
  for (let t = start; t <= end; t += intervalMin) {
    const h = Math.floor(t / 60); const m = t % 60;
    slots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
  }
  return slots;
}

function toHTMLFromSimpleMarkdown(s: string) {
  const escaped = s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\\"/g,"&quot;").replace(/'/g,"&#39;");
  return escaped.replace(/\*([^*]+)\*/g,"<em>$1</em>");
}

function placeholder(text: string, bg = "#f8fafc", fg = "#334155") {
  const svg = encodeURIComponent(`
    <svg xmlns='http://www.w3.org/2000/svg' width='900' height='600'>
      <rect width='100%' height='100%' fill='${bg}'/>
      <text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-family='Inter,Arial' font-size='36' fill='${fg}'>${text}</text>
    </svg>`);
  return `data:image/svg+xml;utf8,${svg}`;
}

/*const PRODUCTS = [
  { id:"PRCXN", name:"PRCXN", price:2.0, size:"250 mL",
    desc:"Classic dairy yoghurt cultured with *L. reuteri* DSM 17648. Targets *H. pylori*.", tags:["Classic","DSM 17648"], img: "/prcxn.png" },
  { id:"PRCXN LF", name:"PRCXN LF", price:2.0, size:"250 mL",
    desc:"Lactose‑free dairy yoghurt, fermented with *L. reuteri* DSM 17648. Targets *H. pylori*.", tags:["Lactose‑free","DSM 17648"], img: "/prcxn.png" },
  { id:"SPCTRL", name:"SPCTRL", price:2.0, size:"250 mL",
    desc:"Classic dairy yoghurt cultured with *L. reuteri* DSM 17938. Targets harmful microbes including *Candida*.", tags:["Classic","DSM 17938"], img: "/spctrl.png" },
  { id:"SPCTRL LF", name:"SPCTRL LF", price:2.0, size:"250 mL",
    desc:"Lactose‑free dairy yoghurt, fermented with *L. reuteri* DSM 17938. Targets harmful microbes including *Candida*.", tags:["Lactose‑free","DSM 17938"], img: "/spctrl.png" },
];*/

const GROUPED = [
  {
    key: "prcxn",
    title: "PRCXN",
    blurb: <>Yoghurt cultured with <em>L. reuteri</em> DSM 17648. Targets <em>H. pylori</em>.</>,
    img: "/prcxn.png",
    variants: [
      { id: "PRCXN", label: "PRCXN" },
      { id: "PRCXN LF", label: "PRCXN LF" },
    ],
  },
  {
    key: "spctrl",
    title: "SPCTRL",
    blurb: <>Yoghurt cultured with <em>L. reuteri</em> DSM 17938. Targets harmful microbes including <em>Candida</em>.</>,
    img: "spctrl.png",
    variants: [
      { id: "SPCTRL", label: "SPCTRL" },
      { id: "SPCTRL LF", label: "SPCTRL LF" },
    ],
  },
];

function computeTotals(cart: Record<string, number>) {
  const items = Object.entries(cart).map(([id, qty]) => ({ ...PRODUCTS.find(p=>p.id===id)!, qty }));
  const qtyTotal = items.reduce((s,i)=>s+i.qty,0);
  const bundles = Math.floor(qtyTotal/7);
  const remainder = qtyTotal%7;
  const total = bundles*10 + remainder*2;
  const plainSubtotal = qtyTotal * 2.0;
  const savings = Math.max(0, plainSubtotal - total);
  return { items, qtyTotal, bundles, remainder, total, savings, plainSubtotal };
}

function nextBundleHint(qtyTotal:number){
  if (qtyTotal===0) return "Bundle: 7 bottles for £10 (mix & match).";
  const need = (7 - (qtyTotal % 7)) % 7;
  if (need===0) return "You’re on a bundle – great value!";
  return `Add ${need} more to unlock the 7‑for‑£10 bundle.`;
}

function AboutSection() {
  return (
    <section id="about" className="mx-auto max-w-6xl px-4 py-10">
      <div className="rounded-3xl bg-white ring-1 ring-slate-200 shadow-sm p-6 md:p-10">
        <h2 className="text-2xl md:text-3xl font-bold text-slate-900">
          About Yoghurt of Youth
        </h2>
        <h3 className="mt-1 text-lg md:text-xl font-medium text-slate-700">
          Cultures with Purpose
        </h3>

        <p className="mt-4 text-slate-700">
          Each of our yoghurts is crafted with live{" "}
          <em>Lactobacillus reuteri</em> strains that have been studied for
          their unique, health-supporting properties.
        </p>

        <div className="mt-6 space-y-6">
          <div>
            <h4 className="font-semibold text-slate-900">
              PRCXN — DSM 17648
            </h4>
            <p className="mt-2 text-slate-700 text-sm leading-relaxed">
              A precision-targeted strain shown in clinical research to bind to
              and reduce populations of <em>Helicobacter pylori</em>, a
              bacterium linked to stomach discomfort and ulcers. By helping
              clear <em>H. pylori</em> from the stomach lining, this culture
              supports a calmer, more balanced digestive environment.
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-slate-900">
              SPCTRL — DSM 17938
            </h4>
            <p className="mt-2 text-slate-700 text-sm leading-relaxed">
              A broad-acting <em>L. reuteri</em> strain observed in studies to
              help limit unwanted microbes, including{" "}
              <em>Candida</em> species, while coexisting peacefully with
              beneficial flora. It contributes to microbial balance throughout
              the gut and is widely recognised for its excellent safety record.
            </p>
          </div>

          <p className="text-slate-700 text-sm leading-relaxed">
            Both cultures are fermented slowly at 37&nbsp;°C — body temperature
            — to preserve their vitality and activity.
          </p>
        </div>

        <h3 className="mt-8 text-xl font-semibold text-slate-900">
          Why Gut Health Matters
        </h3>
        <p className="mt-3 text-slate-700 text-sm leading-relaxed">
          Modern research consistently links gut balance to nearly every aspect
          of wellbeing. Scientific studies suggest that a well-functioning
          microbiome influences:
        </p>

        <div className="mt-4 text-sm text-slate-700 leading-relaxed">
          <ul className="list-disc list-inside space-y-2">
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

        <p className="mt-4 text-slate-700 text-sm leading-relaxed">
          Restoring microbial balance can therefore ripple through every system
          of the body.
        </p>

        <h3 className="mt-8 text-xl font-semibold text-slate-900">
          The Power of <em>Lactobacillus reuteri</em>
        </h3>
        <p className="mt-3 text-slate-700 text-sm leading-relaxed">
          When harmful microbes dominate the gut or stomach, inflammation and
          discomfort follow. Our two <em>L. reuteri</em> strains address this at
          the source:
        </p>
        <ul className="mt-2 list-disc list-inside text-sm text-slate-700 space-y-1">
          <li>
            <strong>DSM 17648 (“PRCXN”)</strong> selectively binds{" "}
            <em>H. pylori</em>, helping to remove it naturally from the stomach.
          </li>
          <li>
            <strong>DSM 17938 (“SPCTRL”)</strong> helps restrain a wide
            range of opportunistic species — including <em>Candida</em> —
            promoting equilibrium and resilience in the gut ecosystem.
          </li>
        </ul>
        <p className="mt-4 text-slate-700 text-sm leading-relaxed">
          Together they create a foundation for genuine digestive harmony and
          whole-body wellbeing.
        </p>

        <h3 className="mt-8 text-xl font-semibold text-slate-900">Disclaimer</h3>
        <p className="mt-3 text-slate-500 text-xs leading-relaxed">
          This information summarises findings from independent scientific
          research on the bacterial strains used. It is provided for educational
          purposes and is not medical advice. Our products are fermented foods
          intended to support natural gut balance as part of a healthy lifestyle.
        </p>
      </div>
    </section>
  );
}

function StudiesSection(){
  return (
    <section id="studies" className="mx-auto max-w-6xl px-4 py-10">
      <div className="rounded-3xl bg-white ring-1 ring-slate-200 shadow-sm p-6">
        <h2 className="text-2xl font-bold">Scientific studies</h2>
        <p className="mt-2 text-slate-700 text-sm">
          Independent research exploring the strains we use:
        </p>

        <ol className="list-decimal pl-5 mt-3 space-y-2 text-sm text-slate-700">
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
        </ol>
      </div>
    </section>
  );
}

export default function App(){
  const [confirmation, setConfirmation] = useState<null|any>(null);
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

  const { items, qtyTotal, bundles, remainder, total, savings, plainSubtotal } = computeTotals(cart);
  const add = (id:string)=> setCart(c=>({ ...c, [id]: (c[id]||0)+1 }));
  const sub = (id:string)=> setCart(c=>{ const n={...c}; if(!n[id]) return n; n[id]--; if(n[id]<=0) delete n[id]; return n; });
  const remove = (id:string)=> setCart(c=>{ const n={...c}; delete n[id]; return n; });
  const clear = ()=> setCart({});

  if (confirmation) {
    return <ConfirmationPage brand={BRAND} confirmation={confirmation} onReset={()=>{ setConfirmation(null); }} />;
  }

  return (
    <div className="scroll-smooth min-h-screen bg-gradient-to-b from-white to-slate-50 text-slate-800">
      <Header brand={BRAND} query={query} setQuery={setQuery} itemsCount={qtyTotal} openCart={()=>setDrawerOpen(true)} />

      <section className="mx-auto max-w-6xl px-4 pt-16 pb-10 grid md:grid-cols-2 gap-10 items-center">
        <div>
          <h1 className="text-4xl md:text-5xl font-extrabold leading-tight tracking-tight">
            It isn't hard to tell.
          </h1>
          <div className="mt-6 flex flex-wrap gap-3">
            <a href="#shop" className="rounded-2xl bg-slate-900 text-white px-5 py-3 text-sm font-semibold hover:bg-slate-800">Browse yoghurts</a>
            <a href="#visit" className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-semibold hover:bg-white">Find us</a>
          </div>
          <div className="mt-4 text-xs text-slate-500">Reserve online, pay on collection · Bundle deal available</div>
        </div>
        <div className="relative">
          <div className="aspect-[4/3] w-full rounded-3xl bg-white shadow-xl ring-1 ring-slate-200 overflow-hidden grid place-items-center">
            <div className="p-6 grid place-items-center">
              <img
                src="/logo.png?v=2"
                alt="Yoghurt of Youth"
                className="mx-auto w-[90%] max-w-[600px] h-auto object-contain"
                style={{ display: "block" }}
              />
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-6 px-4 max-w-6xl mx-auto justify-items-center">
          {GROUPED
            .filter(g => {
              const q = (query || "").toLowerCase();
              return !q || g.title.toLowerCase().includes(q) ||
                     g.variants.some(v => v.label.toLowerCase().includes(q));
            })
            .map(g => (
              <article
                key={g.key}
                className="group rounded-2xl bg-white ring-1 ring-slate-200 shadow-sm overflow-hidden flex flex-col"
              >
                <div className="relative">
                  <img
                    src={g.img}
                    alt={g.title}
                    className="w-full aspect-square object-contain bg-white"
                  />
                </div>
        
                <div className="p-4 flex-1 flex flex-col">
                  <h3 className="text-base font-semibold text-slate-900">{g.title}</h3>
                  <p className="text-sm text-slate-600 mt-1">{g.blurb}</p>
        
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {g.variants.map(v => (
                      <button
                        key={v.id}
                        onClick={() => add(v.id)}
                        className="rounded-lg bg-slate-900 text-white px-3 py-1.5 text-sm font-medium hover:bg-slate-800 transition"
                      >
                        + {v.label}
                      </button>
                    ))}
                  </div>
        
                  <div className="mt-3 text-xs text-slate-500">
                    £2 per bottle · <strong>7 for £10</strong> (mix &amp; match)
                  </div>
        
                  <div className="mt-2 rounded-xl bg-slate-50 p-2 text-xs text-slate-600">
                    {g.variants.map(v => (
                      <div key={v.id} className="flex justify-between">
                        <span>{v.label}</span>
                        <span>× {(cart[v.id] || 0)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </article>
          ))}
        </div>

      {/* About */}
      <AboutSection />
      
      {/* Scientific Studies */}
      <StudiesSection />

      <section id="visit" className="mx-auto max-w-6xl px-4 py-10">
        <div className="rounded-3xl bg-white ring-1 ring-slate-200 shadow-sm p-6 md:p-8 grid md:grid-cols-2 gap-6 items-center">
          <div>
            <h2 className="text-2xl font-bold">Collect your order</h2>
            <address className="not-italic mt-3 text-slate-700">
              <div className="font-semibold">{BRAND}</div>
              {ADDRESS_LINES.map((l,i)=> <div key={i}>{l}</div>)}
            </address>
            <a className="mt-3 inline-block text-sm text-slate-700 underline" href={`https://www.google.com/maps/search/?api=1&query=${MAPS_QUERY}`} target="_blank" rel="noreferrer">Open in Google Maps</a>
            <p className="mt-4 text-sm text-slate-600">Open daily. Collection slots available from 09:00 to 18:00 in 30‑minute intervals.</p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-5">
            <h3 className="font-semibold">Your basket</h3>
            <div className="mt-3 space-y-2 max-h-44 overflow-auto pr-1">
              {items.length === 0 && <div className="text-sm text-slate-500">No items yet.</div>}
              {items.map(i=>(
                <div key={i.id} className="flex items-center justify-between text-sm">
                  <span>{i.name} × {i.qty}</span>
                  <span>£{(i.qty * 2).toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 border-t pt-3 text-sm">
              <div className="flex justify-between"><span>Bottles</span><span>{qtyTotal}</span></div>
              <div className="flex justify-between"><span>Bundles</span><span>{bundles} × £10</span></div>
              <div className="flex justify-between"><span>Remainder</span><span>{remainder} × £2</span></div>
              <div className="flex justify-between"><span>Full price</span><span>{gbp(plainSubtotal)}</span></div>
              <div className="flex justify-between text-emerald-700"><span>You save</span><span>−{gbp(savings)}</span></div>
              <div className="flex justify-between font-semibold text-slate-900"><span>Total due at collection</span><span>{gbp(total)}</span></div>
            </div>
            <button onClick={()=> setReserveOpen(true)} disabled={qtyTotal===0} className={cn("mt-4 w-full rounded-xl px-4 py-2 text-sm font-semibold", qtyTotal? "bg-slate-900 text-white hover:bg-slate-800" : "bg-slate-200 text-slate-500 cursor-not-allowed")}>Reserve & choose collection time</button>
          </div>
        </div>
      </section>

      <ContactSection />

      <Footer brand={BRAND} />

      <Drawer open={drawerOpen} onClose={()=>setDrawerOpen(false)} title="Your Basket">
        <Basket items={items} qtyTotal={qtyTotal} bundles={bundles} remainder={remainder} total={total} savings={savings}
          add={add} sub={sub} remove={remove} clear={clear}
          onReserve={()=>{ setDrawerOpen(false); setReserveOpen(true); }} />
      </Drawer>

      {reserveOpen && (
        <ReserveModal onClose={()=>setReserveOpen(false)} cart={cart} totals={{ qtyTotal, bundles, remainder, total, savings }}
          onConfirmed={(payload)=>{ setReserveOpen(false); setConfirmation(payload); setCart({}); }} />
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
    <header className="sticky top-0 z-50 transition-all duration-500 ease-in-out">
      {/* Background */}
      <div
        className={`relative transition-all duration-500 ${scrolled ? "h-20" : "h-32"}`}
        style={{
          backgroundImage: "url('skyline.png')",
          backgroundSize: "cover",
          backgroundPosition: `center ${scrolled ? "38%" : "45%"}`, // tweak for horizon
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
                src="logo.png"
                alt="Yoghurt of Youth logo"
                className={`object-contain transition-all duration-500 ${
                  scrolled ? "h-10 md:h-12" : "h-14 md:h-16"
                }`}
              />
            </a>

            {/* NAVIGATION */}
            <nav className="flex items-center gap-6 text-white font-medium text-sm md:text-base">
              <div className="flex items-center gap-6 leading-none">
                <a href="#shop" className="hover:text-amber-300 transition-colors">Shop</a>
                <a href="#about" className="hover:text-amber-300 transition-colors">About</a>
                <a href="#studies" className="hover:text-amber-300 transition-colors">Scientific studies</a>
                <a href="#visit" className="hover:text-amber-300 transition-colors">Collect</a>
                <a href="#contact" className="hover:text-amber-300 transition-colors">Contact</a>
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

function Drawer({ open, onClose, title, children }:{ open:boolean; onClose:()=>void; title:string; children:React.ReactNode; }) {
  return (
    <div aria-hidden={!open} className={cn("fixed inset-0 z-50", open ? "" : "pointer-events-none")}>
      <div onClick={onClose} className={cn("absolute inset-0 bg-slate-900/40 transition-opacity", open ? "opacity-100" : "opacity-0")} />
      <aside className={cn("absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-xl ring-1 ring-slate-200 p-5 transition-transform", open ? "translate-x-0" : "translate-x-full")}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button onClick={onClose} aria-label="Close" className="rounded-full w-8 h-8 grid place-items-center hover:bg-slate-100">✕</button>
        </div>
        <div className="mt-4">{children}</div>
      </aside>
    </div>
  );
}

function Basket({ items, qtyTotal, bundles, remainder, total, savings, add, sub, remove, clear, onReserve }:{ items:any[]; qtyTotal:number; bundles:number; remainder:number; total:number; savings:number; add:(id:string)=>void; sub:(id:string)=>void; remove:(id:string)=>void; clear:()=>void; onReserve:()=>void; }) {
  return (
    <div className="space-y-4">
      {items.length === 0 && <p className="text-sm text-slate-500">Your basket is empty.</p>}
      {items.map(i => (
        <div key={i.id} className="flex gap-3">
          <img src={i.img} alt="" className="w-16 h-12 rounded-lg ring-1 ring-slate-200 object-cover"/>
          <div className="flex-1">
            <div className="flex justify-between text-sm">
              <div>
                <div className="font-medium text-slate-900">{i.name}</div>
                <div className="text-slate-500">{i.size}</div>
              </div>
              <div className="font-medium">£{(i.qty * 2).toFixed(2)}</div>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <button onClick={()=>sub(i.id)} className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700">−</button>
              <span className="w-8 text-center text-sm">{i.qty}</span>
              <button onClick={()=>add(i.id)} className="w-7 h-7 rounded-lg bg-slate-900 text-white">+</button>
              <button onClick={()=>remove(i.id)} className="ml-auto text-xs text-slate-500 hover:text-slate-700">Remove</button>
            </div>
          </div>
        </div>
      ))}

      <div className="border-t pt-4 space-y-2 text-sm">
        <div className="flex justify-between"><span>Bottles</span><span>{qtyTotal}</span></div>
        <div className="flex justify-between"><span>Bundles</span><span>{bundles} × £10</span></div>
        <div className="flex justify-between"><span>Remainder</span><span>{remainder} × £2</span></div>
        <div className="flex justify-between text-emerald-700"><span>You save</span><span>−{gbp(savings)}</span></div>
        <div className="flex justify-between font-semibold text-slate-900"><span>Total due at collection</span><span>{gbp(total)}</span></div>
      </div>

      <div className="flex gap-2">
        <button onClick={onReserve} disabled={qtyTotal===0} className={cn("flex-1 rounded-2xl px-5 py-3 text-sm font-semibold", qtyTotal? "bg-slate-900 text-white hover:bg-slate-800" : "bg-slate-200 text-slate-500 cursor-not-allowed")}>Reserve & choose collection time</button>
        <button onClick={clear} className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-semibold hover:bg-white">Clear</button>
      </div>
    </div>
  );
}

function ReserveModal({ onClose, cart, totals, onConfirmed }:{ onClose:()=>void; cart:Record<string, number>; totals:any; onConfirmed:(payload:any)=>void; }) {
  const { qtyTotal, bundles, remainder, total } = totals;
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [date, setDate] = useState(todayISO());
  const [time, setTime] = useState("09:00");
  const [note, setNote] = useState("");

  const lines = Object.entries(cart).map(([id, qty]) => {
    const p = PRODUCTS.find(p=>p.id===id);
    return `${p?.name} × ${qty}`;
  });

  const subjectBase = `${BRAND} reservation – ${date} ${time} – ${name}`;
  const valid = name && email && phone && qtyTotal > 0 && date && time;
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function sendEmail() {
    if (!valid) { alert("Please complete the form first."); return; }
    setSending(true); setError("");
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
          pickup_date: date,
          pickup_time: time,
          order_lines: lines.join("\\n"),
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

      const payload = { orderId, name, email, phone, date, time, lines, qtyTotal, bundles, remainder, total: gbp(total), address: [...ADDRESS_LINES] };
      setSent(true);
      onConfirmed && onConfirmed(payload);
    } catch (e) {
      console.error(e);
      setError("Email send failed. Check your EmailJS keys and that To is set to {{owner_email}} in the template.");
    } finally {
      setSending(false);
    }
  }

  return (
    <Modal onClose={onClose} title="Reserve & Collect">
      <p className="text-sm text-slate-600">Fill in your details and choose a collection slot. You’ll receive an email confirmation, and you pay on collection (cash or card).</p>

      <div className="mt-4 grid md:grid-cols-2 gap-4">
        <input value={name} onChange={e=>setName(e.target.value)} required placeholder="Full name" className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"/>
        <input value={email} onChange={e=>setEmail(e.target.value)} required type="email" placeholder="Email" className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"/>
        <input value={phone} onChange={e=>setPhone(e.target.value)} required type="tel" placeholder="Mobile number" className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"/>
        <input value={date} onChange={e=>setDate(e.target.value)} required type="date" min={todayISO()} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"/>
        <select value={time} onChange={e=>setTime(e.target.value)} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300">
          {timeSlotsArray(PICKUP_START_HOUR, PICKUP_END_HOUR, PICKUP_INTERVAL_MIN).map(t => (<option key={t} value={t}>{t}</option>))}
        </select>
        <input value={note} onChange={e=>setNote(e.target.value)} placeholder="Order note (optional)" className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"/>
      </div>

      <div className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm">
        <div className="font-semibold mb-2">Summary</div>
        <div className="grid sm:grid-cols-2 gap-2">
          <div>{lines.map((l,i)=><div key={i}>• {l}</div>)}</div>
          <div>
            <div>Bottles: {qtyTotal}</div>
            <div>Bundles: {bundles} × £10</div>
            <div>Remainder: {remainder} × £2</div>
            <div className="font-semibold mt-1">Total due: {gbp(total)}</div>
          </div>
        </div>
      </div>

      {error && <p className="mt-3 text-sm text-rose-700">{error}</p>}

      <div className="mt-5 flex flex-wrap gap-2">
        <button onClick={sendEmail} className={cn("inline-flex rounded-2xl px-5 py-3 text-sm font-semibold", valid? "bg-slate-900 text-white hover:bg-slate-800" : "bg-slate-200 text-slate-500 cursor-not-allowed")} disabled={!valid || sending}>{sending ? "Sending…" : sent ? "Sent ✓" : "Confirm reservation"}</button>
        <button onClick={onClose} className="inline-flex rounded-2xl border border-slate-300 px-5 py-3 text-sm font-semibold hover:bg-white">Close</button>
      </div>

      <p className="mt-4 text-xs text-slate-500">By reserving you agree to collect at the chosen time and pay on collection (cash or card). If you need to change your slot, please reply to the confirmation email.</p>
    </Modal>
  );
}

function Modal({ onClose, title, children }:{ onClose:()=>void; title:string; children:React.ReactNode; }) {
  return (
    <div className="fixed inset-0 z-50">
      <div onClick={onClose} className="absolute inset-0 bg-slate-900/40" />
      <div className="absolute inset-0 grid place-items-center p-4">
        <div className="w-full max-w-lg rounded-2xl bg-white ring-1 ring-slate-200 shadow-xl p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">{title}</h3>
            <button onClick={onClose} aria-label="Close" className="rounded-full w-8 h-8 grid place-items-center hover:bg-slate-100">✕</button>
          </div>
          <div className="mt-3">{children}</div>
        </div>
      </div>
    </div>
  );
}

function ConfirmationPage({ brand, confirmation, onReset }:{ brand:string; confirmation:any; onReset:()=>void; }) {
  const { orderId, name, date, time, lines, qtyTotal, bundles, remainder, total, address } = confirmation;
  return (
    <main className="min-h-screen bg-gradient-to-b from-white to-slate-50 text-slate-800">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between">
          <Logo brand={brand} />
          <a href="#shop" onClick={onReset} className="text-sm underline">Back to shop</a>
        </div>
      </header>

      <section className="mx-auto max-w-3xl px-4 py-10">
        <div className="rounded-3xl bg-white ring-1 ring-slate-200 shadow-sm p-6">
          <h1 className="text-2xl font-bold">Order confirmed</h1>
          <p className="mt-1 text-slate-600">Thanks, {name}! Your reservation has been received.</p>

          <div className="mt-4 grid gap-2 text-sm">
            <div><span className="font-semibold">Order ID:</span> {orderId}</div>
            <div><span className="font-semibold">Pickup:</span> {date} at {time}</div>
            <div><span className="font-semibold">Bottles:</span> {qtyTotal} (bundles {bundles} · remainder {remainder})</div>
            <div><span className="font-semibold">Total due at collection:</span> {total}</div>
          </div>

          <div className="mt-5">
            <div className="font-semibold mb-1">Items</div>
            <ul className="list-disc pl-5 text-sm text-slate-700">
              {lines.map((l: string, i: number) => <li key={i}>{l}</li>)}
            </ul>
          </div>

          <div className="mt-5 text-sm">
            <div className="font-semibold">Collect at</div>
            <address className="not-italic text-slate-700">
              {address.map((l: string, i: number) => <div key={i}>{l}</div>)}
            </address>
            <p className="mt-2 text-slate-600">Payment on collection (cash or card).</p>
          </div>

          <div className="mt-6 flex gap-2">
            <button onClick={onReset} className="rounded-2xl bg-slate-900 text-white px-5 py-3 text-sm font-semibold hover:bg-slate-800">Place another order</button>
            <a href={`https://www.google.com/maps/search/?api=1&query=${MAPS_QUERY}`} target="_blank" rel="noreferrer" className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-semibold hover:bg-white">Open in Google Maps</a>
          </div>
        </div>
      </section>

      <Footer brand={brand} />
    </main>
  );
}

function ContactSection() {
  return (
    <section id="contact" className="mx-auto max-w-6xl px-4 py-10">
      <div className="rounded-3xl bg-white ring-1 ring-slate-200 shadow-sm p-6 md:p-10">
        <h2 className="text-2xl font-bold text-slate-900">Contact Us</h2>
        <p className="mt-3 text-slate-700 text-sm leading-relaxed">
          For personalised support or product advice, get in touch below.
        </p>
        <div className="mt-5 space-y-3 text-slate-700 text-sm">
          <p>
            📧 Email:{" "}
            <a href="mailto:support@yoghurtofyouth.co.uk" className="underline hover:text-slate-900">
              support@yoghurtofyouth.co.uk
            </a>
          </p>
          <p>
            📞 Phone:{" "}
            <a href="tel:+447756231844" className="underline hover:text-slate-900">
              07756 231 844
            </a>
          </p>
          <p className="text-xs text-slate-500">We aim to respond within one working day.</p>
        </div>
      </div>
    </section>
  );
}

/*function Footer({ brand }:{ brand:string }) {
  return (
    <footer className="border-t border-slate-200 mt-12 py-10">
      <div className="mx-auto max-w-6xl px-4 grid md:grid-cols-3 gap-6 text-sm">
        
        <div className="mx-auto max-w-6xl px-4 mt-6 text-xs text-slate-500">© {new Date().getFullYear()} {brand}. All rights reserved.</div>

        <div>
          <h4 className="font-semibold text-slate-900">Visit us</h4>
          <address className="not-italic mt-2 text-slate-600">
            {ADDRESS_LINES.map((l,i)=> <div key={i}>{l}</div>)}
          </address>
          <a className="mt-1 inline-block text-slate-600 underline" href={`https://www.google.com/maps/search/?api=1&query=${MAPS_QUERY}`} target="_blank" rel="noreferrer">Open in Google Maps</a>
        </div>
      </div>
    </footer>
  );
}*/
