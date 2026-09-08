"use client";
import { formatMalaysiaTime } from "@/lib/date";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { isAdmin, isKitchen } from "@/lib/auth";


interface OrderItem {
    quantity: number;
    price: number;
    menu_items: {
        name: string;
    };
}

interface Order {
    id: number;
    order_number: string | null;
    table_id: number;
    session_id: number;
    total: number;
    status: string;
    created_at: string;
    order_items: OrderItem[];
}

export default function KitchenPage() {

    const router = useRouter();

    const [orders, setOrders] = useState<Order[]>([]);

    async function loadOrders() {
        const { data, error } = await supabase
            .from("orders")
            .select(`
        *,
        order_items (
          quantity,
          price,
          menu_items (
            name
          )
        )
      `)
            .in("status", [
                "pending",
                "preparing",
                "ready"
            ])
            .order("id", { ascending: false });

        if (error) {
            console.log(error);
            return;
        }

        console.log("Kitchen Orders:", data);

        setOrders(data || []);
    }
    async function logout() {

        await supabase.auth.signOut();

        router.push("/login");
    }
    async function updateStatus(
        orderId: number,
        currentStatus: string
    ) {
        let nextStatus = currentStatus;

        if (currentStatus === "pending") {
            nextStatus = "preparing";
        } else if (currentStatus === "preparing") {
            nextStatus = "ready";
        } else {
            return;
        }

        await supabase
            .from("orders")
            .update({
                status: nextStatus,
            })
            .eq("id", orderId);

        loadOrders();
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

            if (
                !isAdmin(user.email) &&
                !isKitchen(user.email)
            ) {
                router.push("/login");
                return;
            }

            loadOrders();
        }

        checkAccess();

        const interval = setInterval(() => {
            loadOrders();
        }, 3000);

        return () => clearInterval(interval);

    }, [router]);

    return (
        <div className="min-h-screen bg-slate-100 p-8">
            <div className="flex justify-between items-center mb-8">

                <h1 className="text-4xl font-bold text-black">
                    Kitchen Display
                </h1>

                <button
                    onClick={logout}
                    className="bg-red-600 text-white px-4 py-2 rounded-lg"
                >
                    Logout
                </button>

            </div>

            <div className="grid md:grid-cols-3 gap-6">

                {orders.map((order) => (

                    <div
                        key={order.id}
                        className="bg-white rounded-xl shadow-lg p-6"
                    >

                        <div className="flex justify-between mb-4">

                            <h2 className="text-2xl font-bold text-black">
                                Order {order.order_number || order.id}
                            </h2>

                            <span className="font-semibold text-blue-600">
                                Table {order.table_id}
                            </span>

                        </div>

                        <div className="space-y-2 mb-4">

                            {order.order_items?.map(
                                (item, index) => (

                                    <div
                                        key={index}
                                        className="flex justify-between"
                                    >

                                        <span className="text-black">
                                            {item.menu_items?.name}
                                        </span>

                                        <span className="text-black">
                                            x{item.quantity}
                                        </span>

                                    </div>

                                )
                            )}

                        </div>

                        <div className="border-t pt-4">


                            <p className="text-sm text-gray-500 mb-3">
                                {formatMalaysiaTime(order.created_at)}
                            </p>

                            <p className="mb-3 text-black">
                                Status:
                                <span className="font-bold ml-2">
                                    {order.status}
                                </span>
                            </p>

                            <button
                                disabled={order.status === "ready"}
                                onClick={() =>
                                    updateStatus(order.id, order.status)
                                }
                                className={`w-full py-2 rounded-lg text-white ${order.status === "ready"
                                    ? "bg-gray-400 cursor-not-allowed"
                                    : "bg-orange-500 hover:bg-orange-600"
                                    }`}
                            >
                                {order.status === "ready"
                                    ? "Waiting for Payment"
                                    : "Next Status"}
                            </button>

                        </div>

                    </div>

                ))}

            </div>

        </div>
    );
}