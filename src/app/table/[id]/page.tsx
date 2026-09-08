"use client";

import { useEffect, useState } from "react";
import { ShoppingCart, Table } from "lucide-react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

interface MenuItem {
    id: number;
    category_id: number;
    name: string;
    description: string;
    price: number;
    image_url: string | null;
    available: boolean;
    quantity?: number;
}

interface Order {
    id: number;
    order_number: string | null;
    status: string;
    total: number;
    created_at: string;
}

export default function CustomerMenuPage() {
    function formatMalaysiaTime(dateString: string) {
        return new Date(dateString).toLocaleString("en-MY", {
            timeZone: "Asia/Kuala_Lumpur",
            year: "numeric",
            month: "short",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
        });
    }
    const params = useParams();

    const tableId = Number(params.id);

    const [menus, setMenus] = useState<MenuItem[]>([]);
    const [cart, setCart] = useState<MenuItem[]>([]);
    const [orders, setOrders] = useState<any[]>([]);
    const [lastOrder, setLastOrder] = useState<any>(null);

    const [showConfirm, setShowConfirm] =
        useState(false);
    async function placeOrder() {
        const { data: sessionData, error: sessionError } =
            await supabase
                .from("table_sessions")
                .select("*")
                .eq("table_id", tableId)
                .eq("status", "active")
                .maybeSingle();

        if (!sessionData) {
            alert(`No active session found for table ${tableId}`);
            return;
        }

        const total = cart.reduce(
            (sum, item) =>
                sum + Number(item.price) * (item.quantity || 1),
            0
        );

        // ==========================
        // Check existing active order
        // ==========================

        const { data: existingOrder } = await supabase
            .from("orders")
            .select("*")
            .eq("session_id", sessionData.id)
            .in("status", [
                "pending",
                "preparing",
            ])
            .order("id", { ascending: false })
            .limit(1)
            .maybeSingle();

        let orderId: number;

        // ==========================
        // Existing order found
        // ==========================

        if (existingOrder) {
            orderId = existingOrder.id;

            await supabase
                .from("orders")
                .update({
                    total:
                        Number(existingOrder.total) +
                        total,
                })
                .eq("id", existingOrder.id);
        }

        // ==========================
        // Create new order
        // ==========================

        else {
            const today = new Date();

            const datePart =
                today.getFullYear().toString() +
                String(today.getMonth() + 1).padStart(2, "0") +
                String(today.getDate()).padStart(2, "0");

            const { data: todayOrders } = await supabase
                .from("orders")
                .select("order_number")
                .like("order_number", `${datePart}-%`);

            const runningNumber = String(
                (todayOrders?.length || 0) + 1
            ).padStart(3, "0");

            const orderNumber =
                `${datePart}-${runningNumber}`;

            const { data: orderData, error: orderError } =
                await supabase
                    .from("orders")
                    .insert([
                        {
                            table_id: tableId,
                            session_id: sessionData.id,
                            total,
                            status: "pending",
                            order_number: orderNumber,
                        },
                    ])
                    .select()
                    .single();

            if (orderError) {
                console.log(orderError);
                alert(orderError.message);
                return;
            }

            orderId = orderData.id;
        }

        // ==========================
        // Insert order items
        // ==========================

        const orderItems = cart.map((item) => ({
            order_id: orderId,
            menu_item_id: item.id,
            quantity: item.quantity || 1,
            price: item.price,
        }));

        const { error: itemError } = await supabase
            .from("order_items")
            .insert(orderItems);

        if (itemError) {
            console.log(itemError);
            alert(itemError.message);
            return;
        }

        alert(
            `Order placed successfully! Table ${tableId}`
        );

        setCart([]);

        loadOrders();
    }

    async function loadMenus() {
        const { data, error } = await supabase
            .from("menu_items")
            .select("*")
            .order("id");

        console.log("MENU DATA:", data);
        console.log("MENU ERROR:", error);
        console.log("COUNT:", data?.length);

        if (error) {
            console.log(error);
            return;
        }

        setMenus(data || []);
    }

    async function loadOrders() {

        const { data: sessionData } =
            await supabase
                .from("table_sessions")
                .select("*")
                .eq("table_id", tableId)
                .eq("status", "active")
                .single();

        if (!sessionData) return;

        const { data, error } =
            await supabase
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
                .eq(
                    "session_id",
                    sessionData.id
                )
                .order(
                    "created_at",
                    {
                        ascending: false,
                    }
                );

        if (error) {
            console.log(error);
            return;
        }

        setOrders(data || []);
    }


    function addToCart(menu: MenuItem) {
        const existing = cart.find((item) => item.id === menu.id);

        if (existing) {
            setCart(
                cart.map((item) =>
                    item.id === menu.id
                        ? {
                            ...item,
                            quantity: (item.quantity || 1) + 1,
                        }
                        : item,
                ),
            );
        } else {
            setCart([
                ...cart,
                {
                    ...menu,
                    quantity: 1,
                },
            ]);
        }
    }

    function increaseQuantity(menuId: number) {
        setCart(
            cart.map((item) =>
                item.id === menuId
                    ? {
                        ...item,
                        quantity: (item.quantity || 1) + 1,
                    }
                    : item,
            ),
        );
    }

    function decreaseQuantity(menuId: number) {
        const updatedCart = cart
            .map((item) =>
                item.id === menuId
                    ? {
                        ...item,
                        quantity: (item.quantity || 1) - 1,
                    }
                    : item,
            )
            .filter((item) => (item.quantity || 0) > 0);

        setCart(updatedCart);
    }

    useEffect(() => {

        async function initializePage() {

            const { data } =
                await supabase
                    .from("table_sessions")
                    .select("*")
                    .eq("table_id", tableId)
                    .eq("status", "active")
                    .maybeSingle();

            if (!data) {

                await supabase
                    .from("table_sessions")
                    .insert([
                        {
                            table_id: tableId,
                            status: "active",
                        },
                    ]);
            }

            await loadMenus();
            await loadOrders();
        }

        initializePage();

        const interval = setInterval(() => {
            loadOrders();
        }, 3000);

        return () => clearInterval(interval);

    }, [tableId]);
    const total = cart.reduce(
        (sum, item) => sum + Number(item.price) * (item.quantity || 1),
        0,
    );

    return (
        <div className="min-h-screen bg-gray-100">
            <div className="max-w-6xl mx-auto p-6">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-3xl font-bold">Table {tableId}</h1>

                    <div className="relative">
                        <ShoppingCart size={32} />

                        {cart.length > 0 && (
                            <span
                                className="
          absolute
          -top-2
          -right-2
          bg-red-500
          text-white
          text-xs
          rounded-full
          w-5
          h-5
          flex
          items-center
          justify-center
        "
                            >
                                {cart.length}
                            </span>
                        )}
                    </div>
                </div>

                <div className="grid md:grid-cols-3 gap-6">
                    {/* Menu */}

                    <div className="md:col-span-2">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {menus.map((menu) => (
                                <div
                                    key={menu.id}
                                    className="bg-white rounded-xl shadow p-4"
                                >
                                    {menu.image_url && (
                                        <img
                                            src={menu.image_url}
                                            alt={menu.name}
                                            className="w-full h-48 object-cover rounded-lg mb-3"
                                        />
                                    )}

                                    <h2 className="text-lg font-bold text-black">
                                        {menu.name}
                                    </h2>

                                    {!menu.available && (
                                        <div className="text-red-600 font-bold mb-2">
                                            SOLD OUT
                                        </div>
                                    )}

                                    <p className="text-gray-600 text-sm mb-2">
                                        {menu.description}
                                    </p>

                                    <div className="flex justify-between items-center">
                                        <span className="font-bold text-green-600">
                                            RM {menu.price}
                                        </span>

                                        <button
                                            disabled={!menu.available}
                                            onClick={() => addToCart(menu)}
                                            className={
                                                menu.available
                                                    ? "bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
                                                    : "bg-gray-400 text-white px-4 py-2 rounded-lg cursor-not-allowed"
                                            }
                                        >
                                            {menu.available
                                                ? "Add"
                                                : "Sold Out"}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Cart */}

                    <div className="bg-white rounded-xl shadow p-4 h-fit sticky top-4">
                        <h2 className="text-2xl font-bold mb-4 text-black">
                            Cart
                        </h2>

                        {orders.length > 0 && (
                            <div className="mb-6">
                                <h3 className="font-bold text-lg mb-2 text-black">
                                    Your Orders
                                </h3>

                                {orders.map((order) => (
                                    <div key={order.id} className="border rounded-lg p-3 mb-3">
                                        <div className="font-bold text-black">
                                            Order {order.order_number || order.id}
                                        </div>

                                        <div className="text-sm text-gray-500 mb-2">
                                            {formatMalaysiaTime(order.created_at)}
                                        </div>

                                        {order.order_items.map((item: any, index: number) => (
                                            <div key={index} className="text-sm text-black">
                                                {item.menu_items?.name}
                                                {" x"}
                                                {item.quantity}
                                            </div>
                                        ))}

                                        <div className="mt-2">
                                            <span
                                                className={`px-2 py-1 rounded text-xs ${order.status === "pending"
                                                    ? "bg-yellow-100 text-yellow-700"
                                                    : order.status === "preparing"
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
                        )}

                        {cart.length === 0 ? (
                            <p className="text-gray-500">No items selected</p>
                        ) : (
                            <>
                                {cart.map((item) => (
                                    <div key={item.id} className="border-b py-3">
                                        <div className="flex justify-between items-center">
                                            <div>
                                                <p className="font-medium text-black">{item.name}</p>

                                                <p className="text-sm text-gray-500">RM {item.price}</p>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => decreaseQuantity(item.id)}
                                                    className="w-8 h-8 bg-red-500 text-white rounded"
                                                >
                                                    -
                                                </button>

                                                <span className="font-bold text-black w-6 text-center">
                                                    {item.quantity}
                                                </span>

                                                <button
                                                    onClick={() => increaseQuantity(item.id)}
                                                    className="w-8 h-8 bg-green-500 text-white rounded"
                                                >
                                                    +
                                                </button>
                                            </div>
                                        </div>

                                        <div className="text-right text-sm text-gray-700 mt-1">
                                            RM {(item.price * (item.quantity || 1)).toFixed(2)}
                                        </div>
                                    </div>
                                ))}

                                <div className="mt-4 font-bold text-xl text-black">
                                    Total: RM {total.toFixed(2)}
                                </div>

                                <button
                                    onClick={() => setShowConfirm(true)}
                                    className="w-full mt-4 bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg"
                                >
                                    Place Order
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>
            {showConfirm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]">

                    <div className="bg-white rounded-xl p-6 w-[400px] shadow-xl">

                        <h2 className="text-xl font-bold mb-4 text-black">
                            Confirm Order
                        </h2>

                        <div className="space-y-2 mb-4">

                            {cart.map((item) => (
                                <div
                                    key={item.id}
                                    className="flex justify-between"
                                >
                                    <span>
                                        {item.quantity}x {item.name}
                                    </span>

                                    <span>
                                        RM{" "}
                                        {(
                                            item.price *
                                            (item.quantity || 1)
                                        ).toFixed(2)}
                                    </span>
                                </div>
                            ))}

                        </div>

                        <div className="font-bold text-lg mb-4 text-black">
                            Total: RM {total.toFixed(2)}
                        </div>

                        <div className="flex gap-3">

                            <button
                                onClick={() =>
                                    setShowConfirm(false)
                                }
                                className="flex-1 bg-gray-500 text-white py-2 rounded"
                            >
                                Cancel
                            </button>

                            <button
                                onClick={async () => {
                                    setShowConfirm(false);
                                    await placeOrder();
                                }}
                                className="flex-1 bg-green-600 text-white py-2 rounded"
                            >
                                Confirm
                            </button>

                        </div>

                    </div>

                </div>
            )}

        </div>
    );
}