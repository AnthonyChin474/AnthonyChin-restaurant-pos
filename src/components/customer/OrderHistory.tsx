"use client";

interface OrderHistoryProps {
    orders: any[];
    formatMalaysiaTime: (date: string) => string;
}

export default function OrderHistory({
    orders,
    formatMalaysiaTime,
}: OrderHistoryProps) {
    if (orders.length === 0) return null;

    return (
        <div className="mb-6">
            <h3 className="font-bold text-lg mb-2 text-black">
                Your Orders
            </h3>

            {orders.map((order) => (
                <div
                    key={order.id}
                    className="
border
rounded-lg
p-3
mb-3
bg-white
"
                >
                    <div className="font-bold text-black">
                        Order {order.order_number || order.id}
                    </div>

                    <div className="text-sm text-gray-500 mb-2">
                        {formatMalaysiaTime(
                            order.created_at
                        )}
                    </div>

                    {order.order_items.map(
                        (
                            item: any,
                            index: number
                        ) => (
                            <div
                                key={index}
                                className="text-sm text-black"
                            >
                                {item.menu_items?.name}
                                {" x"}
                                {item.quantity}
                            </div>
                        )
                    )}

                    <div className="mt-2">
                        <span
                            className={`px-2 py-1 rounded text-xs ${order.status ===
                                "pending"
                                ? "bg-yellow-100 text-yellow-700"
                                : order.status ===
                                    "preparing"
                                    ? "bg-blue-100 text-blue-700"
                                    : "bg-green-100 text-green-700"
                                }`}
                        >
                            {order.status}
                        </span>
                    </div>
                </div>
            ))}
        </div>
    );
}