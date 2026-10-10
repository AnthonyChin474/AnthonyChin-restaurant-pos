
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { isAdmin, isCashier } from "@/lib/auth";

interface MenuItem {
  id: number;
  category_id: number;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  available: boolean;
  menu_code?: string | null;
}

interface Category {
  id: number;
  name: string;
}

interface CartItem extends MenuItem {
  quantity: number;
}

const TABLE_IDS = Array.from({ length: 10 }, (_, index) => index + 1);

function getMalaysiaDatePart() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kuala_Lumpur",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const values: Record<string, string> = {};

  parts.forEach((part) => {
    values[part.type] = part.value;
  });

  return `${values.year}${values.month}${values.day}`;
}

export default function ManualOrderPage() {
  const router = useRouter();

  const [menus, setMenus] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [tableId, setTableId] = useState("1");
  const [selectedCategory, setSelectedCategory] = useState<number | null>(
    null
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const loadData = useCallback(async () => {
    setErrorMessage("");

    try {
      const [menuResult, categoryResult] = await Promise.all([
        supabase
          .from("menu_items")
          .select(
            "id, category_id, name, description, price, image_url, available, menu_code"
          )
          .order("id"),
        supabase.from("categories").select("id, name").order("id"),
      ]);

      if (menuResult.error) {
        console.error("MANUAL ORDER MENU ERROR:", menuResult.error);
        setErrorMessage(`Unable to load menu: ${menuResult.error.message}`);
        return;
      }

      if (categoryResult.error) {
        console.error(
          "MANUAL ORDER CATEGORY ERROR:",
          categoryResult.error
        );
        setErrorMessage(
          `Unable to load categories: ${categoryResult.error.message}`
        );
        return;
      }

      setMenus((menuResult.data || []) as MenuItem[]);
      setCategories((categoryResult.data || []) as Category[]);
    } catch (error) {
      console.error("MANUAL ORDER LOAD ERROR:", error);
      setErrorMessage("Unable to load the menu. Please refresh and try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function initialize() {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (cancelled) return;

      if (
        error ||
        !user ||
        (!isAdmin(user.email) && !isCashier(user.email))
      ) {
        router.replace("/login");
        return;
      }

      await loadData();
    }

    void initialize();

    return () => {
      cancelled = true;
    };
  }, [router, loadData]);

  const filteredMenus = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();

    return menus.filter((menu) => {
      const matchesCategory =
        selectedCategory === null ||
        menu.category_id === selectedCategory;

      const matchesSearch =
        menu.name.toLowerCase().includes(keyword) ||
        (menu.description || "").toLowerCase().includes(keyword) ||
        (menu.menu_code || "").toLowerCase().includes(keyword);

      return matchesCategory && matchesSearch;
    });
  }, [menus, selectedCategory, searchTerm]);

  const cartTotal = useMemo(
    () =>
      cart.reduce(
        (sum, item) => sum + Number(item.price) * item.quantity,
        0
      ),
    [cart]
  );

  const cartQuantity = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity, 0),
    [cart]
  );

  function addToCart(menu: MenuItem) {
    if (!menu.available) return;

    setSuccessMessage("");
    setCart((previous) => {
      const existing = previous.find((item) => item.id === menu.id);

      if (existing) {
        return previous.map((item) =>
          item.id === menu.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }

      return [...previous, { ...menu, quantity: 1 }];
    });
  }

  function changeQuantity(menuId: number, change: number) {
    setCart((previous) =>
      previous
        .map((item) =>
          item.id === menuId
            ? { ...item, quantity: item.quantity + change }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  }

  async function submitOrder() {
    if (submitting) return;

    if (cart.length === 0) {
      alert("Please add at least one menu item.");
      return;
    }

    const selectedTableId = Number(tableId);

    if (!TABLE_IDS.includes(selectedTableId)) {
      alert("Please select a valid table.");
      return;
    }

    const unavailableItems = cart.filter((item) => !item.available);

    if (unavailableItems.length > 0) {
      alert(
        `These items are unavailable: ${unavailableItems
          .map((item) => item.name)
          .join(", ")}. Please remove them from the cart.`
      );
      return;
    }

    const confirmed = window.confirm(
      `Confirm manual order for Table ${selectedTableId}?\n\n` +
        `Items: ${cartQuantity}\n` +
        `Total: RM ${cartTotal.toFixed(2)}`
    );

    if (!confirmed) return;

    setSubmitting(true);
    setErrorMessage("");
    setSuccessMessage("");

    let sessionId: number | null = null;
    let createdNewSession = false;
    let createdOrderId: number | null = null;

    try {
      // 1. Find the latest active session for the selected table.
      const { data: existingSession, error: sessionLookupError } =
        await supabase
          .from("table_sessions")
          .select("id, table_id, status")
          .eq("table_id", selectedTableId)
          .eq("status", "active")
          .order("id", { ascending: false })
          .limit(1)
          .maybeSingle();

      if (sessionLookupError) {
        throw new Error(
          `Unable to check table session: ${sessionLookupError.message}`
        );
      }

      if (existingSession) {
        sessionId = existingSession.id;
      } else {
        // 2. Create a session only when the staff submits the order.
        const { data: newSession, error: createSessionError } =
          await supabase
            .from("table_sessions")
            .insert({
              table_id: selectedTableId,
              status: "active",
            })
            .select("id")
            .single();

        if (createSessionError || !newSession) {
          throw new Error(
            createSessionError?.message ||
              "Unable to create a table session."
          );
        }

        sessionId = newSession.id;
        createdNewSession = true;
      }

      // 3. Generate the daily order number using Malaysia's date.
      const datePart = getMalaysiaDatePart();

      const { data: todayOrders, error: numberLookupError } =
        await supabase
          .from("orders")
          .select("order_number")
          .like("order_number", `${datePart}-%`);

      if (numberLookupError) {
        throw new Error(
          `Unable to generate order number: ${numberLookupError.message}`
        );
      }

      const runningNumber = String(
        (todayOrders?.length || 0) + 1
      ).padStart(3, "0");

      const orderNumber = `${datePart}-${runningNumber}`;

      // 4. Create a pending order for the kitchen.
      const orderTotal = cart.reduce(
        (sum, item) => sum + Number(item.price) * item.quantity,
        0
      );

      const { data: newOrder, error: orderError } = await supabase
        .from("orders")
        .insert({
          table_id: selectedTableId,
          session_id: sessionId,
          total: orderTotal,
          status: "pending",
          order_number: orderNumber,
        })
        .select("id")
        .single();

      if (orderError || !newOrder) {
        throw new Error(
          orderError?.message || "Unable to create the order."
        );
      }

      createdOrderId = newOrder.id;

      // 5. Save the items with their order-time prices.
      const orderItems = cart.map((item) => ({
        order_id: newOrder.id,
        menu_item_id: item.id,
        quantity: item.quantity,
        price: Number(item.price),
      }));

      const { error: itemsError } = await supabase
        .from("order_items")
        .insert(orderItems);

      if (itemsError) {
        // Avoid leaving a partial order if saving its items fails.
        const { error: deleteOrderError } = await supabase
          .from("orders")
          .delete()
          .eq("id", newOrder.id);

        if (deleteOrderError) {
          console.error("PARTIAL ORDER CLEANUP ERROR:", deleteOrderError);
        } else {
          createdOrderId = null;
        }

        throw new Error(
          `Unable to save order items: ${itemsError.message}`
        );
      }

      setCart([]);
      setSuccessMessage(
        `Order ${orderNumber} submitted successfully for Table ${selectedTableId}.`
      );

      alert(
        `Order placed successfully!\n\n` +
          `Order: ${orderNumber}\n` +
          `Table: ${selectedTableId}\n` +
          `Total: RM ${orderTotal.toFixed(2)}\n\n` +
          `The order is now pending in the kitchen.`
      );
    } catch (error) {
      console.error("MANUAL ORDER SUBMISSION ERROR:", error);

      const message =
        error instanceof Error
          ? error.message
          : "Unable to submit the order. Please try again.";

      setErrorMessage(message);

      // If this submission created a new session but did not leave
      // a successfully saved order, try to close that empty session.
      if (
        createdNewSession &&
        sessionId !== null &&
        createdOrderId === null
      ) {
        const { error: closeError } = await supabase
          .from("table_sessions")
          .update({ status: "closed" })
          .eq("id", sessionId)
          .eq("status", "active");

        if (closeError) {
          console.error("EMPTY SESSION CLEANUP ERROR:", closeError);
        }
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-8">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 md:text-4xl">
              Manual Ordering
            </h1>
            <p className="mt-2 text-gray-600">
              Place an order on behalf of a customer.
            </p>
          </div>

          <button
            type="button"
            onClick={() => router.push("/admin/floor")}
            className="rounded-lg bg-slate-800 px-4 py-3 font-semibold text-white hover:bg-slate-700"
          >
            ← Table Management
          </button>
        </div>

        {/* Table selection */}
        <div className="mb-6 rounded-xl bg-white p-5 shadow-sm">
          <label
            htmlFor="manual-order-table"
            className="mb-2 block text-lg font-bold text-slate-900"
          >
            Select Table
          </label>

          <select
            id="manual-order-table"
            value={tableId}
            onChange={(event) => setTableId(event.target.value)}
            disabled={submitting}
            className="w-full rounded-lg border border-gray-300 bg-white p-3 text-lg text-slate-900 md:max-w-sm"
          >
            {TABLE_IDS.map((id) => (
              <option key={id} value={id}>
                Table {id}
              </option>
            ))}
          </select>

          <p className="mt-2 text-sm text-gray-500">
            An active session will be reused if this table already has one.
            A new session is created only when an order is submitted.
          </p>
        </div>

        {/* Search */}
        <div className="mb-4 rounded-xl bg-white p-4 shadow-sm">
          <label
            htmlFor="manual-order-search"
            className="mb-2 block font-semibold text-slate-900"
          >
            Search Menu
          </label>

          <input
            id="manual-order-search"
            type="search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search by item name, description or code..."
            className="w-full rounded-lg border border-gray-300 p-3 text-slate-900"
          />
        </div>

        {/* Category filters */}
        <div className="mb-6 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSelectedCategory(null)}
            className={`rounded-lg px-4 py-2 font-semibold ${
              selectedCategory === null
                ? "bg-blue-600 text-white"
                : "bg-white text-slate-800 shadow-sm"
            }`}
          >
            All Items
          </button>

          {categories.map((category) => (
            <button
              type="button"
              key={category.id}
              onClick={() => setSelectedCategory(category.id)}
              className={`rounded-lg px-4 py-2 font-semibold ${
                selectedCategory === category.id
                  ? "bg-blue-600 text-white"
                  : "bg-white text-slate-800 shadow-sm"
              }`}
            >
              {category.name}
            </button>
          ))}
        </div>

        {/* Status messages */}
        {errorMessage && (
          <div
            role="alert"
            className="mb-5 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700"
          >
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div
            role="status"
            className="mb-5 rounded-lg border border-green-200 bg-green-50 p-4 text-green-800"
          >
            {successMessage}
          </div>
        )}

        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
          {/* Menu */}
          <section className="lg:col-span-2">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-slate-900">
                Menu Items
              </h2>
              <button
                type="button"
                onClick={() => void loadData()}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-gray-50"
              >
                Refresh Menu
              </button>
            </div>

            {loading ? (
              <div className="rounded-xl bg-white p-10 text-center text-gray-500">
                Loading menu...
              </div>
            ) : filteredMenus.length === 0 ? (
              <div className="rounded-xl bg-white p-10 text-center text-gray-500">
                No menu items found.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {filteredMenus.map((menu) => (
                  <article
                    key={menu.id}
                    className="overflow-hidden rounded-xl bg-white shadow-sm"
                  >
                    {menu.image_url ? (
                      <img
                        src={menu.image_url}
                        alt={menu.name}
                        className="h-44 w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-28 items-center justify-center bg-slate-100 text-sm text-gray-400">
                        No Image
                      </div>
                    )}

                    <div className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="font-bold text-slate-900">
                          {menu.name}
                        </h3>
                        <span className="shrink-0 font-bold text-green-700">
                          RM {Number(menu.price).toFixed(2)}
                        </span>
                      </div>

                      {menu.description && (
                        <p className="mt-2 text-sm text-gray-600">
                          {menu.description}
                        </p>
                      )}

                      {!menu.available && (
                        <p className="mt-3 font-bold text-red-600">
                          SOLD OUT
                        </p>
                      )}

                      <button
                        type="button"
                        disabled={!menu.available || submitting}
                        onClick={() => addToCart(menu)}
                        className={`mt-4 w-full rounded-lg px-4 py-3 font-bold text-white ${
                          menu.available && !submitting
                            ? "bg-blue-600 hover:bg-blue-700"
                            : "cursor-not-allowed bg-gray-400"
                        }`}
                      >
                        {menu.available ? "＋ Add to Order" : "Sold Out"}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          {/* Cart */}
          <aside className="rounded-xl bg-white p-5 shadow-sm lg:sticky lg:top-4">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-slate-900">
                Current Order
              </h2>
              <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-bold text-blue-800">
                {cartQuantity} item(s)
              </span>
            </div>

            <p className="mb-4 text-sm text-gray-600">
              Table {tableId}
            </p>

            {cart.length === 0 ? (
              <div className="rounded-lg bg-slate-50 p-6 text-center text-gray-500">
                No items added yet. Select items from the menu.
              </div>
            ) : (
              <div className="space-y-4">
                {cart.map((item) => (
                  <div
                    key={item.id}
                    className="border-b border-gray-200 pb-4 last:border-b-0"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900">
                          {item.name}
                        </p>
                        <p className="mt-1 text-sm text-gray-500">
                          RM {Number(item.price).toFixed(2)} each
                        </p>
                      </div>

                      <p className="shrink-0 font-bold text-slate-900">
                        RM{" "}
                        {(Number(item.price) * item.quantity).toFixed(2)}
                      </p>
                    </div>

                    <div className="mt-3 flex items-center gap-3">
                      <button
                        type="button"
                        aria-label={`Remove one ${item.name}`}
                        onClick={() => changeQuantity(item.id, -1)}
                        disabled={submitting}
                        className="h-9 w-9 rounded-lg border border-gray-300 font-bold text-slate-900 hover:bg-gray-100"
                      >
                        −
                      </button>

                      <span className="min-w-6 text-center font-bold text-slate-900">
                        {item.quantity}
                      </span>

                      <button
                        type="button"
                        aria-label={`Add one ${item.name}`}
                        onClick={() => changeQuantity(item.id, 1)}
                        disabled={submitting}
                        className="h-9 w-9 rounded-lg border border-gray-300 font-bold text-slate-900 hover:bg-gray-100"
                      >
                        +
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setCart((previous) =>
                            previous.filter(
                              (cartItem) => cartItem.id !== item.id
                            )
                          )
                        }
                        disabled={submitting}
                        className="ml-auto text-sm font-semibold text-red-600 hover:text-red-700"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-5 border-t border-gray-200 pt-4">
              <div className="flex items-center justify-between">
                <span className="text-lg font-bold text-slate-900">
                  Total
                </span>
                <span className="text-2xl font-bold text-green-700">
                  RM {cartTotal.toFixed(2)}
                </span>
              </div>

              <button
                type="button"
                onClick={() => void submitOrder()}
                disabled={submitting || loading || cart.length === 0}
                className={`mt-5 w-full rounded-lg px-4 py-4 font-bold text-white ${
                  submitting || loading || cart.length === 0
                    ? "cursor-not-allowed bg-gray-400"
                    : "bg-green-600 hover:bg-green-700"
                }`}
              >
                {submitting ? "Submitting Order..." : "Confirm & Send Order"}
              </button>

              <button
                type="button"
                onClick={() => {
                  if (cart.length === 0) return;

                  if (window.confirm("Clear all items from this order?")) {
                    setCart([]);
                    setErrorMessage("");
                    setSuccessMessage("");
                  }
                }}
                disabled={submitting || cart.length === 0}
                className="mt-2 w-full rounded-lg border border-gray-300 px-4 py-3 font-semibold text-slate-800 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Clear Order
              </button>

              <p className="mt-3 text-xs text-gray-500">
                Confirming sends this order to the kitchen. Payment is handled
                separately in Cashier.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
