"use client";

import { useEffect, useState } from "react";
import { ShoppingCart, Table } from "lucide-react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import CategoryTabs from "@/components/customer/CategoryTabs";
import MenuGrid from "@/components/customer/MenuGrid";
import OrderHistory from "@/components/customer/OrderHistory";
import CartPanel from "@/components/customer/CartPanel";
import ConfirmModal from "@/components/customer/ConfirmModal";

interface MenuItem {
    id: number;
    category_id: number;
    name: string;
    description: string;
    price: number;
    image_url: string | null;
    available: boolean;
    quantity?: number;
    menu_code?: string;
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
    const [searchTerm, setSearchTerm] = useState("");

    const [selectedCategory, setSelectedCategory] =
        useState<number | null>(1);
    const [categories, setCategories] =
        useState<any[]>([]);
    const [lastOrder, setLastOrder] = useState<any>(null);

    const [showConfirm, setShowConfirm] =
        useState(false);

    const [addedMessage, setAddedMessage] =
        useState("");
    const [lastAdded, setLastAdded] =
        useState("");

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

        const filteredMenus = menus.filter((menu) => {

            const matchCategory =
                selectedCategory === null
                    ? true
                    : menu.category_id === selectedCategory;

            const search = searchTerm.toLowerCase();

            const matchSearch =
                menu.name.toLowerCase().includes(search) ||
                (menu.description || "")
                    .toLowerCase().includes(search);

            return matchCategory && matchSearch;
        });

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

    async function loadCategories() {

        const { data, error } =
            await supabase
                .from("categories")
                .select("*")
                .order("id");

        if (error) {
            console.log(error);
            return;
        }

        setCategories(data || []);
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

        setAddedMessage(
            `${menu.name} added to cart`
        );
        setLastAdded(menu.name);
        setTimeout(() => {
            setAddedMessage("");
        }, 1500);

        const existing = cart.find(
            (item) => item.id === menu.id
        );

        if (existing) {
            setCart(
                cart.map((item) =>
                    item.id === menu.id
                        ? {
                            ...item,
                            quantity:
                                (item.quantity || 1) + 1,
                        }
                        : item
                )
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

    const filteredMenus = menus.filter((menu) => {
        const matchCategory =
            selectedCategory === null ||
            menu.category_id === selectedCategory;

        const keyword = searchTerm.toLowerCase();

        const matchSearch =
            menu.name.toLowerCase().includes(keyword) ||
            menu.description.toLowerCase().includes(keyword) ||
            (menu.menu_code || "")
                .toLowerCase()
                .includes(keyword);

        return matchCategory && matchSearch;
    });
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
            await loadCategories();
            
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
        <div className="min-h-screen bg-gray-100 overflow-x-hidden">
            <div className="max-w-6xl mx-auto p-4 md:p-6">
                <div className="flex items-center justify-between mb-6">
                    <h1 className="text-2xl md:text-3xl font-bold truncate">
                        Table {tableId}
                    </h1>

                    <div
                        className="
    relative
    shrink-0
    cursor-pointer
    hidden md:block
    "
                        onClick={() =>
                            document
                                .getElementById("cart-section")
                                ?.scrollIntoView({
                                    behavior: "smooth",
                                })
                        }
                    >
                        <div className="hidden md:block">
                            <ShoppingCart size={32} />
                        </div>

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
                {
                    addedMessage && (
                        <div
                            className="
            fixed
            bottom-20
            left-1/2
            -translate-x-1/2
            bg-green-600
            text-white
            px-4
            py-3
            rounded-lg
            z-50
            shadow-lg
            "
                        >
                            ✅ {lastAdded} added
                        </div>
                    )
                }
                <div
                    className="
    md:hidden
    fixed
    bottom-4
    right-4
    z-50
    "
                >
                    <button
                        onClick={() =>
                            document
                                .getElementById("cart-section")
                                ?.scrollIntoView({
                                    behavior: "smooth",
                                })
                        }
                        className="
        bg-green-600
        text-white
        px-5
        py-3
        rounded-full
        shadow-lg
        font-bold
        "
                    >
                        🛒 {cart.length}
                    </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Menu */}

                    <div className="md:col-span-2 min-w-0">

                        {/* Search */}
                        <div id="menu-top">
                            <div className="mb-4">
                                <input
                                    type="text"
                                    placeholder="Search menu (R1, Tonkotsu, Udon...)"
                                    value={searchTerm}
                                    onChange={(e) =>
                                        setSearchTerm(e.target.value)
                                    }
                                    className="w-full border rounded-lg p-3 text-black"
                                />
                            </div>
                        </div>

                        {/* Category Tabs */}
                        <CategoryTabs
                            categories={categories}
                            selectedCategory={selectedCategory}
                            setSelectedCategory={setSelectedCategory}
                        />

                        {/* Menu Grid */}
                        <MenuGrid
                            menus={filteredMenus}
                            addToCart={addToCart}
                        />

                    </div>

                    {/* Cart */}

                    <div
                        id="cart-section"
                        className="
    bg-white
    rounded-xl
    shadow
    p-4
    h-fit
    md:sticky
    md:top-4
    "
                    >
                        <h2 className="text-2xl font-bold mb-4 text-black">
                            Cart
                        </h2>

                        <OrderHistory
                            orders={orders}
                            formatMalaysiaTime={
                                formatMalaysiaTime
                            }
                        />
                        <CartPanel
                            cart={cart}
                            total={total}
                            increaseQuantity={
                                increaseQuantity
                            }
                            decreaseQuantity={
                                decreaseQuantity
                            }
                            onPlaceOrder={() =>
                                setShowConfirm(true)
                            }
                        />
                    </div>
                </div>
            </div>
            <ConfirmModal
                show={showConfirm}
                cart={cart}
                total={total}
                onCancel={() =>
                    setShowConfirm(false)
                }
                onConfirm={async () => {
                    setShowConfirm(false);
                    await placeOrder();
                }}
            />

        </div>


    );


}

