"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { isAdmin } from "@/lib/auth";

export default function AdminDashboard() {

  async function logout() {

    await supabase.auth.signOut();

    router.push("/login");
  }

  const router = useRouter();
  const [revenue, setRevenue] = useState(0);
  const [todayRevenue, setTodayRevenue] =
    useState(0);

  const [todayOrders, setTodayOrders] =
    useState(0);
  const [orders, setOrders] = useState(0);
  const [pending, setPending] = useState(0);
  const [preparing, setPreparing] = useState(0);
  const [ready, setReady] = useState(0);
  const [paid, setPaid] = useState(0);
  const [activeTables, setActiveTables] = useState(0);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [topItems, setTopItems] =
    useState<any[]>([]);

  async function loadDashboard() {
    const { data: orderData, error } = await supabase
      .from("orders")
      .select("*")
      .order("id", { ascending: false });

    if (error) {
      console.log(error);
      return;
    }

    const orderList = orderData || [];

    const today = new Date(
      Date.now() +
      8 * 60 * 60 * 1000
    )
      .toISOString()
      .split("T")[0];

    const todayPaidOrders =
      orderList.filter((o) => {

        if (o.status !== "paid") {
          return false;
        }

        const malaysiaDate = new Date(
          new Date(o.created_at).getTime() +
          8 * 60 * 60 * 1000
        )
          .toISOString()
          .split("T")[0];

        return malaysiaDate === today;
      });

    console.log(
      "TODAY PAID ORDERS:",
      todayPaidOrders.length
    );

    setTodayOrders(
      todayPaidOrders.length
    );

    setTodayRevenue(
      todayPaidOrders.reduce(
        (sum, order) =>
          sum +
          Number(
            order.final_total ||
            order.total
          ),
        0
      )
    );

    setOrders(orderList.length);

    setPending(
      orderList.filter(
        (o) => o.status === "pending"
      ).length
    );

    setPreparing(
      orderList.filter(
        (o) => o.status === "preparing"
      ).length
    );

    setReady(
      orderList.filter(
        (o) => o.status === "ready"
      ).length
    );

    setPaid(
      orderList.filter(
        (o) => o.status === "paid"
      ).length
    );

    const totalRevenue = orderList
      .filter((o) => o.status === "paid")
      .reduce(
        (sum, order) =>
          sum +
          Number(
            order.final_total ||
            order.total
          ),
        0
      );
    setRevenue(totalRevenue);

    setRecentOrders(
      orderList.slice(0, 5)
    );

    const { data: sessions } =
      await supabase
        .from("table_sessions")
        .select("*")
        .eq("status", "active");

    setActiveTables(
      sessions?.length || 0
    );

    const { data: items } =
      await supabase
        .from("order_items")
        .select(`
      quantity,
      menu_items (
        name
      )
    `);

    const menuCount: Record<
      string,
      number
    > = {};

    (items || []).forEach(
      (item: any) => {

        const name =
          item.menu_items?.name ||
          item.menu_items?.[0]?.name;

        if (!name) return;

        menuCount[name] =
          (menuCount[name] || 0)
          +
          item.quantity;
      }
    );

    const sorted =
      Object.entries(menuCount)
        .sort(
          (a, b) =>
            b[1] - a[1]
        )
        .slice(0, 5);

    setTopItems(sorted);

  }

  async function checkAccess() {

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return false;
    }

    if (!isAdmin(user.email)) {
      router.push("/login");
      return false;
    }

    return true;
  }

  useEffect(() => {

    async function init() {

      const allowed = await checkAccess();

      if (!allowed) return;

      loadDashboard();
    }

    init();

    const interval = setInterval(() => {
      console.log("Refreshing dashboard...");
      loadDashboard();
    }, 5000);

    return () => clearInterval(interval);

  }, []);

  return (
    <div className="min-h-screen bg-slate-100 p-8">

      <div className="flex justify-between items-center mb-8">

        <h1 className="text-4xl font-bold text-black">
          JIKASEI Dashboard
        </h1>

        <button
          onClick={logout}
          className="bg-red-600 text-white px-4 py-2 rounded-lg"
        >
          Logout
        </button>

      </div>

      {/* Statistics */}

      <div className="grid md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="text-gray-500">
            Today Revenue
          </h2>

          <p className="text-3xl font-bold text-green-600">
            RM {todayRevenue.toFixed(2)}
          </p>
        </div>

        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="text-gray-500">
            Today Orders
          </h2>

          <p className="text-3xl font-bold text-blue-600">
            {todayOrders}
          </p>
        </div>

        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="text-gray-500">
            Revenue
          </h2>

          <p className="text-3xl font-bold text-green-600">
            RM {revenue.toFixed(2)}
          </p>
        </div>

        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="text-gray-500">
            Orders
          </h2>

          <p className="text-3xl font-bold">
            {orders}
          </p>
        </div>

        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="text-gray-500">
            Active Tables
          </h2>

          <p className="text-3xl font-bold text-red-500">
            {activeTables}
          </p>
        </div>

        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="text-gray-500">
            Paid Orders
          </h2>

          <p className="text-3xl font-bold text-green-500">
            {paid}
          </p>
        </div>

      </div>

      {/* Order Status */}

      <div className="grid md:grid-cols-3 gap-6 mt-6">

        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="text-orange-500 font-semibold">
            Pending
          </h2>

          <p className="text-4xl font-bold">
            {pending}
          </p>
        </div>

        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="text-purple-500 font-semibold">
            Preparing
          </h2>

          <p className="text-4xl font-bold">
            {preparing}
          </p>
        </div>

        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="text-blue-500 font-semibold">
            Ready
          </h2>

          <p className="text-4xl font-bold">
            {ready}
          </p>
        </div>

      </div>

      {/* Quick Access */}

      <h2 className="text-2xl font-bold mt-10 mb-4">
        Quick Access
      </h2>

      <div className="grid md:grid-cols-3 gap-6">

        <Link
          href="/admin/menu"
          className="bg-white rounded-xl shadow p-6 hover:shadow-xl"
        >
          <h3 className="font-bold text-xl">
            Menu Management
          </h3>

          <p className="text-gray-500">
            Add / Edit Menu Items
          </p>
        </Link>

        <Link
          href="/admin/kitchen"
          className="bg-white rounded-xl shadow p-6 hover:shadow-xl"
        >
          <h3 className="font-bold text-xl">
            Kitchen Display
          </h3>

          <p className="text-gray-500">
            Manage Orders
          </p>
        </Link>

        <Link
          href="/admin/cashier"
          className="bg-white rounded-xl shadow p-6 hover:shadow-xl"
        >
          <h3 className="font-bold text-xl">
            Cashier
          </h3>

          <p className="text-gray-500">
            Process Payments
          </p>
        </Link>

        <Link
          href="/admin/history"
          className="bg-white rounded-xl shadow p-6 hover:shadow-xl"
        >
          <h3 className="font-bold text-xl">
            Order History
          </h3>

          <p className="text-gray-500">
            View Past Orders
          </p>
        </Link>

        <Link
          href="/admin/floor"
          className="bg-white rounded-xl shadow p-6 hover:shadow-xl"
        >
          <h3 className="font-bold text-xl">
            Table Management
          </h3>

          <p className="text-gray-500">
            Transfer & Manage Tables
          </p>
        </Link>

        <Link
          href="/admin/qrcodes"
          className="bg-white rounded-xl shadow p-6 hover:shadow-xl"
        >
          <h3 className="font-bold text-xl">
            QR Code Management
          </h3>

          <p className="text-gray-500">
            Generate & Print QR Codes
          </p>
        </Link>
      </div>

      {/* ========================= */}
      {/* TOP SELLING ITEMS */}
      {/* ========================= */}

      <h2 className="text-2xl font-bold mt-10 mb-4">
        Top Selling Items
      </h2>

      <div className="bg-white rounded-xl shadow p-6">

        {topItems.length === 0 ? (

          <p className="text-gray-500">
            No sales data yet.
          </p>

        ) : (

          topItems.map(
            ([name, qty], index) => (

              <div
                key={name}
                className="
                  flex
                  justify-between
                  items-center
                  border-b
                  last:border-b-0
                  py-3
                "
              >

                <span className="font-medium">
                  #{index + 1} {name}
                </span>

                <span className="font-bold text-green-600">
                  {qty} sold
                </span>

              </div>

            )
          )

        )}

      </div>

      {/* ========================= */}
      {/* RECENT ORDERS */}
      {/* ========================= */}

      <h2 className="text-2xl font-bold mt-10 mb-4">
        Recent Orders
      </h2>

      <div className="bg-white rounded-xl shadow">

        {recentOrders.map((order) => (

          <div
            key={order.id}
            className="
              flex
              justify-between
              items-center
              p-4
              border-b
            "
          >

            <div>

              <p className="font-bold">
                {order.order_number || order.id}
              </p>

              <p className="text-sm text-gray-500">
                Table {order.table_id}
              </p>

            </div>

            <div className="text-right">

              <p className="font-bold">
                RM {
                  Number(
                    order.final_total ||
                    order.total
                  ).toFixed(2)
                }
              </p>

              <p className="text-xs text-gray-500">
                {order.payment_method || "-"}
              </p>

              <p className="text-sm">
                {order.status}
              </p>

            </div>

          </div>

        ))}

      </div>

    </div>
  );
}