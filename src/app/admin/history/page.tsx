"use client";
import { formatMalaysiaTime } from "@/lib/date";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { isAdmin } from "@/lib/auth";

interface Order {
    id: number;
    order_number: string | null;
    table_id: number;
    session_id: number;

    total: number;

    discount_percent: number | null;

    discount_amount: number | null;

    final_total: number | null;

    payment_method: string | null;

    status: string;
    created_at: string;

    order_items: OrderItem[];
}

interface OrderItem {
    quantity: number;
    price: number;
    menu_items: any;
}

export default function HistoryPage() {
    const router = useRouter();
    const [orders, setOrders] = useState<Order[]>([]);
    const [selectedDate, setSelectedDate] = useState("");
    const [expandedOrder, setExpandedOrder] =
        useState<number | null>(null);

    const [orderItems, setOrderItems] = useState<
        Record<number, OrderItem[]>
    >({});

    async function loadOrders() {
        const { data, error } = await supabase
            .from("orders")
            .select("*")
            .order("id", { ascending: false });

        if (error) {
            console.log(error);
            return;
        }

        setOrders(data || []);
    }

    async function loadOrderItems(orderId: number) {
        if (orderItems[orderId]) return;

        const { data, error } = await supabase
            .from("order_items")
            .select(`
            quantity,
            price,
            menu_items (
            name
            )
        `)
            .eq("order_id", orderId);

        if (error) {
            console.log(error);
            return;
        }

        setOrderItems((prev) => ({
            ...prev,
            [orderId]: (data as OrderItem[]) || [],
        }));
    }

    async function toggleOrder(orderId: number) {
        if (expandedOrder === orderId) {
            setExpandedOrder(null);
            return;
        }

        await loadOrderItems(orderId);
        setExpandedOrder(orderId);
    }


    async function logout() {

        await supabase.auth.signOut();

        router.push("/login");
    }

    useEffect(() => {

        async function checkAccess() {

            const {
                data: { user },
            } = await supabase.auth.getUser();

            if (!user) {
                router.push("/login");
                return;
            }

            if (!isAdmin(user.email)) {
                router.push("/login");
                return;
            }

            loadOrders();
        }

        checkAccess();

    }, [router]);

    const filteredOrders = orders.filter((order) => {
        if (!selectedDate) return true;

        const malaysiaDate = new Date(
            new Date(order.created_at).getTime() +
            8 * 60 * 60 * 1000
        )
            .toISOString()
            .split("T")[0];

        return malaysiaDate === selectedDate;
    });

    return (
        <div className="min-h-screen bg-slate-100 p-8">
            <div className="flex justify-between items-center mb-6">

                <h1 className="text-4xl font-bold">
                    Order History
                </h1>

                <button
                    onClick={logout}
                    className="bg-red-600 text-white px-4 py-2 rounded-lg"
                >
                    Logout
                </button>

            </div>

            <div className="mb-6">
                <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) =>
                        setSelectedDate(e.target.value)
                    }
                    className="border rounded-lg p-2"
                />
            </div>

            <div className="space-y-4">
                {filteredOrders.map((order) => (

                    <div
                        key={order.id}
                        className="bg-white rounded-xl shadow"
                    >
                        <div
                            onClick={() => toggleOrder(order.id)}
                            className="p-6 cursor-pointer flex justify-between items-center"
                        >
                            <div>
                                <h2 className="font-bold text-xl">
                                    Order {order.order_number || order.id}
                                </h2>

                                <p>
                                    Table {order.table_id}
                                </p>

                                <p className="font-bold text-green-600">
                                    RM {
                                        Number(
                                            order.final_total || order.total
                                        ).toFixed(2)
                                    }
                                </p>
                            </div>

                            <div className="text-right">
                                <p>{order.status}</p>

                                <p className="text-sm text-gray-500">
                                    {formatMalaysiaTime(order.created_at)}
                                </p>
                            </div>
                        </div>

                        {expandedOrder === order.id && (
                            <div className="border-t p-6 bg-gray-50">
                                <h3 className="font-bold mb-3">
                                    Order Items
                                </h3>
                                <div className="mb-4 p-3 bg-white rounded">

                                    <p>
                                        Subtotal:
                                        RM {Number(order.total).toFixed(2)}
                                    </p>

                                    <p>
                                        Discount %:
                                        {order.discount_percent || 0}%
                                    </p>

                                    <p>
                                        Discount RM:
                                        RM {
                                            Number(
                                                order.discount_amount || 0
                                            ).toFixed(2)
                                        }
                                    </p>

                                    <p>
                                        Payment:
                                        {order.payment_method || "-"}
                                    </p>

                                    <p className="font-bold text-green-600">

                                        Final Total:

                                        RM {
                                            Number(
                                                order.final_total || order.total
                                            ).toFixed(2)
                                        }

                                    </p>

                                </div>

                                {orderItems[order.id]?.map(
                                    (item, index) => (
                                        <div
                                            key={index}
                                            className="flex justify-between mb-2"
                                        >
                                            <span>
                                                {item.quantity}x{" "}
                                                {item.menu_items?.name}
                                            </span>

                                            <span>
                                                RM{" "}
                                                {(
                                                    item.quantity *
                                                    Number(item.price)
                                                ).toFixed(2)}
                                            </span>
                                        </div>
                                    )
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}