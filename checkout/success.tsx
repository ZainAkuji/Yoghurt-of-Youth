import { useEffect, useState } from "react";
import Modal from "../../components/Modal"; // adjust path if needed

export default function SuccessPage() {
  const [order, setOrder] = useState<any>(null);
  const [error, setError] = useState("");

  // Parse Stripe session_id or PayPal order_id from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const stripeSession = params.get("session_id");
    const paypalOrder = params.get("order_id");

    async function fetchOrder() {
      try {
        const res = await fetch("/api/payment/resolve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stripeSession, paypalOrder }),
        });

        const data = await res.json();
        if (data.error) {
          setError(data.error);
        } else {
          setOrder(data);
        }
      } catch (e) {
        setError("Could not retrieve order.");
      }
    }

    fetchOrder();
  }, []);

  if (error) return <div className="p-10">{error}</div>;
  if (!order) return <div className="p-10 text-white">Loading…</div>;

  return (
    <Modal onClose={() => (window.location.href = "/")} title="Order received">
      <p className="text-sm text-white/80">
        Thanks, <span className="font-semibold">{order.name}</span>. Your payment was successful —
        your confirmation email has been sent.
      </p>

      <div className="mt-4 space-y-2 text-sm text-white/90">
        <div className="flex justify-between">
          <span className="text-white/60">Order ID</span>
          <span className="font-semibold">{order.orderId}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-white/60">Delivery</span>
          <span className="font-semibold">
            {order.delivery_date} · {order.delivery_window}
          </span>
        </div>

        <div className="flex justify-between">
          <span className="text-white/60">Bottles</span>
          <span>{order.qtyTotal}</span>
        </div>

        <div className="flex justify-between border-t border-white/20 pt-2 mt-2">
          <span className="font-semibold">Total paid</span>
          <span className="font-semibold">{order.totalText}</span>
        </div>
      </div>

      <div className="mt-4">
        <div className="font-semibold text-sm mb-1">Items</div>
        <ul className="list-disc pl-5 text-sm text-white/80 space-y-1">
          {order.lines.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>
      </div>

      <div className="mt-4 text-sm text-white/80">
        <div className="font-semibold">Delivery address</div>
        <p>{order.address}</p>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <button
          onClick={() => (window.location.href = "/")}
          className="inline-flex rounded-2xl bg-white text-slate-900 px-5 py-3 text-sm font-semibold hover:bg-amber-300 transition"
        >
          Continue shopping
        </button>
      </div>
    </Modal>
  );
}
