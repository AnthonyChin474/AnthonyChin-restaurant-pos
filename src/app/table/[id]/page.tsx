
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ShoppingCart } from "lucide-react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

interface MenuItem {
  id: number;
  category_id: number;
  name: string;
  description: string;
  price: number;
  image_url: string | null;
  quantity?: number;
}

interface OrderItem {
  quantity: number;
  price: number;
  menu_items: {
    name: string;
  } | null;
}

interface Order {
  id: number;
  order_number: string | null;
  status: string;
  total: number;
  created_at: string;
  order_items: OrderItem[];
}

export default function CustomerMenuPage() {
  const params = useParams();
  const tableId = Number(params.id);

  const [menus, setMenus] = useState<MenuItem[]>([]);
  const [cart, setCart] = useState<MenuItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

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

  const total = useMemo(
    () =>
      cart.reduce(
        (sum, item) =>
          sum + Number(item.price) * (item.quantity || 1),
        0
      ),
    [cart]
  );

  // Load available menu items.
  async function loadMenus() {
    const { data, error } = await supabase
      .from("menu_items")
      .select("*")
      .eq("available", true)
      .order("id");

    if (error) {
      console.error("LOAD MENUS ERROR:", error);
      return;
    }

    setMenus((data || []) as MenuItem[]);
  }

  // Load existing orders only.
  // IMPORTANT: This function must never create a table session.
  const loadOrders = useCallback(async () => {
    if (!Number.isInteger(tableId) || tableId <= 0) {
      return;
    }

    const { data: sessionData, error: sessionError } =
      await supabase
        .from("table_sessions")
        .select("id")
        .eq("table_id", tableId)
        .eq("status", "active")
        .order("id", { ascending: false })
        .limit(1)
        .maybeSingle();

    if (sessionError) {
      console.error("LOAD SESSION ERROR:", sessionError);
      return;
    }

    // No active session means no orders to display.
    // Do not insert a session here.
    if (!sessionData) {
      setOrders([]);
      return;
    }

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
      .eq("session_id", sessionData.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("LOAD ORDERS ERROR:", error);
      return;
    }

    setOrders((data || []) as Order[]);
  }, [tableId]);

  // Initialize the page and refresh existing orders every 3 seconds.
  useEffect(() => {
    if (!Number.isInteger(tableId) || tableId <= 0) {
      return;
    }

    void loadMenus();
    void loadOrders();

    const interval = window.setInterval(() => {
      void loadOrders();
    }, 3000);

    return () => window.clearInterval(interval);
  }, [tableId, loadOrders]);

  // Add a menu item to the cart.
  function addToCart(menu: MenuItem) {
    setCart((currentCart) => {
      const existing = currentCart.find(
        (item) => item.id === menu.id
      );

      if (existing) {
        return currentCart.map((item) =>
          item.id === menu.id
            ? {
                ...item,
                quantity: (item.quantity || 1) + 1,
              }
            : item
        );
      }

      return [
        ...currentCart,
        {
          ...menu,
          quantity: 1,
        },
      ];
    });
  }

  function increaseQuantity(menuId: number) {
    setCart((currentCart) =>
      currentCart.map((item) =>
        item.id === menuId
          ? {
              ...item,
              quantity: (item.quantity || 1) + 1,
            }
          : item
      )
    );
  }

  function decreaseQuantity(menuId: number) {
    setCart((currentCart) =>
      currentCart
        .map((item) =>
          item.id === menuId
            ? {
                ...item,
                quantity: (item.quantity || 1) - 1,
              }
            : item
        )
        .filter((item) => (item.quantity || 0) > 0)
    );
  }

  // Create or reuse a session ONLY when the customer confirms an order.
  async function placeOrder() {
    if (submitting) return;

    if (!Number.isInteger(tableId) || tableId <= 0) {
      alert("Invalid table number.");
      return;
    }

    if (cart.length === 0) {
      alert("Your cart is empty.");
      return;
    }

    setSubmitting(true);

    try {
      let sessionId: number;

      // 1. Find the latest active session for this table.
      const { data: sessionData, error: sessionError } =
        await supabase
          .from("table_sessions")
          .select("id")
          .eq("table_id", tableId)
          .eq("status", "active")
          .order("id", { ascending: false })
          .limit(1)
          .maybeSingle();

      if (sessionError) {
        console.error("SESSION LOOKUP ERROR:", sessionError);
        alert("Unable to check table status. Please try again.");
        return;
      }

      if (sessionData) {
        sessionId = sessionData.id;
      } else {
        // 2. No active session exists: create one now.
        // This code runs only after Confirm is clicked.
        const { data: newSession, error: createSessionError } =
          await supabase
            .from("table_sessions")
            .insert([
              {
                table_id: tableId,
                status: "active",
              },
            ])
            .select("id")
            .single();

        if (createSessionError || !newSession) {
          console.error(
            "CREATE SESSION ERROR:",
            createSessionError
          );

          alert(
            createSessionError?.message ||
              "Unable to start this table session."
          );
          return;
        }

        sessionId = newSession.id;
      }

      const orderTotal = cart.reduce(
        (sum, item) =>
          sum + Number(item.price) * (item.quantity || 1),
        0
      );

      // 3. Check for an existing pending/preparing order.
      const { data: existingOrder, error: existingOrderError } =
        await supabase
          .from("orders")
          .select("*")
          .eq("session_id", sessionId)
          .in("status", ["pending", "preparing"])
          .order("id", { ascending: false })
          .limit(1)
          .maybeSingle();

      if (existingOrderError) {
        console.error(
          "EXISTING ORDER LOOKUP ERROR:",
          existingOrderError
        );
        alert("Unable to check existing orders. Please try again.");
        return;
      }

      let orderId: number;

      if (existingOrder) {
        // 4. Add the new items to the existing active order.
        orderId = existingOrder.id;

        const { error: updateOrderError } = await supabase
          .from("orders")
          .update({
            total: Number(existingOrder.total) + orderTotal,
          })
          .eq("id", existingOrder.id);

        if (updateOrderError) {
          console.error(
            "UPDATE ORDER ERROR:",
            updateOrderError
          );
          alert("Unable to update the order total. Please try again.");
          return;
        }
      } else {
        // 5. Create a new order.
        const now = new Date();

        const datePart =
          now.getFullYear().toString() +
          String(now.getMonth() + 1).padStart(2, "0") +
          String(now.getDate()).padStart(2, "0");

        const { data: todayOrders, error: todayOrdersError } =
          await supabase
            .from("orders")
            .select("order_number")
            .like("order_number", `${datePart}-%`);

        if (todayOrdersError) {
          console.error(
            "TODAY ORDERS LOOKUP ERROR:",
            todayOrdersError
          );
          alert("Unable to generate an order number. Please try again.");
          return;
        }

        const runningNumber = String(
          (todayOrders?.length || 0) + 1
        ).padStart(3, "0");

        const orderNumber = `${datePart}-${runningNumber}`;

        const { data: orderData, error: orderError } =
          await supabase
            .from("orders")
            .insert([
              {
                table_id: tableId,
                session_id: sessionId,
                total: orderTotal,
                status: "pending",
                order_number: orderNumber,
              },
            ])
            .select()
            .single();

        if (orderError || !orderData) {
          console.error("CREATE ORDER ERROR:", orderError);
          alert(orderError?.message || "Unable to create the order.");
          return;
        }

        orderId = orderData.id;
      }

      // 6. Insert order items.
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
        console.error("INSERT ORDER ITEMS ERROR:", itemError);
        alert(
          "The order could not finish saving its items. Please contact staff before submitting again."
        );
        return;
      }

      alert(`Order placed successfully! Table ${tableId}`);

      setCart([]);
      setShowConfirm(false);

      await loadOrders();
    } catch (error) {
      console.error("PLACE ORDER ERROR:", error);
      alert("Something went wrong while placing your order.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!Number.isInteger(tableId) || tableId <= 0) {
    return (
      <div className="min-h-screen bg-gray-100 p-6">
        <p className="text-red-600 font-semibold">
          Invalid table number.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-6xl mx-auto p-4 md:p-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-black">
            Table {tableId}
          </h1>

          <div className="relative" aria-label={`Cart with ${cart.length} items`}>
            <ShoppingCart size={32} className="text-black" />

            {cart.length > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full min-w-5 h-5 px-1 flex items-center justify-center">
                {cart.length}
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Menu */}
          <div className="md:col-span-2">
            {menus.length === 0 ? (
              <div className="bg-white rounded-xl shadow p-6 text-gray-500">
                No menu items available.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

                    <p className="text-gray-600 text-sm mb-3">
                      {menu.description}
                    </p>

                    <div className="flex justify-between items-center gap-3">
                      <span className="font-bold text-green-600">
                        RM {Number(menu.price).toFixed(2)}
                      </span>

                      <button
                        type="button"
                        onClick={() => addToCart(menu)}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Cart and order history */}
          <div className="bg-white rounded-xl shadow p-4 h-fit md:sticky md:top-4">
            <h2 className="text-2xl font-bold mb-4 text-black">
              Cart
            </h2>

            {orders.length > 0 && (
              <div className="mb-6">
                <h3 className="font-bold text-lg mb-3 text-black">
                  Your Orders
                </h3>

                {orders.map((order) => (
                  <div
                    key={order.id}
                    className="border rounded-lg p-3 mb-3"
                  >
                    <div className="font-bold text-black">
                      Order {order.order_number || order.id}
                    </div>

                    <div className="text-sm text-gray-500 mb-2">
                      {formatMalaysiaTime(order.created_at)}
                    </div>

                    {(order.order_items || []).map(
                      (item, index) => (
                        <div
                          key={`${order.id}-${index}`}
                          className="text-sm text-black"
                        >
                          {item.menu_items?.name || "Menu item"} x
                          {item.quantity}
                        </div>
                      )
                    )}

                    <div className="mt-2">
                      <span
                        className={`px-2 py-1 rounded text-xs ${
                          order.status === "pending"
                            ? "bg-yellow-100 text-yellow-700"
                            : order.status === "preparing"
                              ? "bg-blue-100 text-blue-700"
                              : order.status === "paid"
                                ? "bg-gray-100 text-gray-700"
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
              <p className="text-gray-500">
                No items selected.
              </p>
            ) : (
              <>
                {cart.map((item) => (
                  <div key={item.id} className="border-b py-3">
                    <div className="flex justify-between items-start gap-3">
                      <div>
                        <p className="font-medium text-black">
                          {item.name}
                        </p>

                        <p className="text-sm text-gray-500">
                          RM {Number(item.price).toFixed(2)}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => decreaseQuantity(item.id)}
                          aria-label={`Decrease ${item.name} quantity`}
                          className="w-8 h-8 bg-red-500 hover:bg-red-600 text-white rounded"
                        >
                          -
                        </button>

                        <span className="font-bold text-black w-6 text-center">
                          {item.quantity || 1}
                        </span>

                        <button
                          type="button"
                          onClick={() => increaseQuantity(item.id)}
                          aria-label={`Increase ${item.name} quantity`}
                          className="w-8 h-8 bg-green-500 hover:bg-green-600 text-white rounded"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    <div className="text-right text-sm text-gray-700 mt-1">
                      RM{" "}
                      {(
                        Number(item.price) * (item.quantity || 1)
                      ).toFixed(2)}
                    </div>
                  </div>
                ))}

                <div className="mt-4 font-bold text-xl text-black">
                  Total: RM {total.toFixed(2)}
                </div>

                <button
                  type="button"
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

      {/* Order confirmation modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
            <h2 className="text-xl font-bold mb-4 text-black">
              Confirm Order
            </h2>

            <div className="space-y-3 mb-4">
              {cart.map((item) => (
                <div
                  key={item.id}
                  className="flex justify-between gap-3 text-black"
                >
                  <span>
                    {item.quantity || 1}x {item.name}
                  </span>

                  <span className="whitespace-nowrap">
                    RM{" "}
                    {(
                      Number(item.price) * (item.quantity || 1)
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
                type="button"
                disabled={submitting}
                onClick={() => setShowConfirm(false)}
                className="flex-1 bg-gray-500 hover:bg-gray-600 disabled:opacity-50 text-white py-2 rounded"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={submitting || cart.length === 0}
                onClick={() => void placeOrder()}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white py-2 rounded"
              >
                {submitting ? "Submitting..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
