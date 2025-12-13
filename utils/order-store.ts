import { kv } from "@vercel/kv";

export type StoredOrder = {
  orderId: string;
  createdAt: number;
  name: string;
  email: string;
  phone: string;
  address: string;
  formattedDate: string;
  deliveryWindow: string;
  lines: string[];
  qtyTotal: number;
  plainQty: number;
  flavQty: number;
  totalText: string;
  paymentMethod: string;
};

/**
 * Save an order temporarily (TTL = 24 hours)
 */
export async function saveOrder(order: StoredOrder) {
  await kv.set(`order:${order.orderId}`, order, {
    ex: 60 * 60 * 24, // 24 hours
  });
}

/**
 * Load and delete (consume) an order
 */
export async function consumeOrder(orderId: string): Promise<StoredOrder | null> {
  const key = `order:${orderId}`;
  const order = await kv.get<StoredOrder>(key);
  if (order) {
    await kv.del(key);
  }
  return order;
}
