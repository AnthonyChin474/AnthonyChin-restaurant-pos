"use client";

import { formatMalaysiaTime } from "@/lib/date";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { isAdmin, isCashier } from "@/lib/auth";

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
  table_id: number;
  session_id: number;
  total: number;
  status: string;
  created_at: string;
  order_items: OrderItem[];
}

interface SessionSummary {
  session_id: number;
  table_id: number;
  total: number;
  orders: Order[];
}

export default function CashierPage() {

  const router = useRouter();
  const [sessions, setSessions] = useState<SessionSummary[]>([]);

  const [discountPercent, setDiscountPercent] = useState<
    Record<number, number>
  >({});

  const [discountAmount, setDiscountAmount] = useState<Record<number, number>>(
    {},
  );

  const [cashReceived, setCashReceived] = useState<Record<number, number>>({});

  const [paymentMethod, setPaymentMethod] = useState<Record<number, string>>(
    {},
  );

  const [cardType, setCardType] =
    useState<Record<number, string>>({});

  const [moveTable, setMoveTable] =
    useState<Record<number, number>>({});

  async function loadOrders() {
    const { data, error } = await supabase
      .from("orders")
      .select(
        `
    id,
    order_number,
    table_id,
    session_id,
    total,
    status,
    created_at,
    order_items (
        quantity,
        price,
        menu_items (
            name
        )
    )
`,
      )
      .neq("status", "paid")
      .order("id", { ascending: false });

    if (error) {
      console.log("CASHIER ERROR:", error);
      return;
    }

    console.log("CASHIER ORDERS:", data);
    console.log("FIRST ORDER:", JSON.stringify(data?.[0], null, 2));

    const grouped: Record<number, SessionSummary> = {};

    (data || []).forEach((rawOrder) => {
      const order = rawOrder as unknown as Order;

      if (!grouped[order.session_id]) {
        grouped[order.session_id] = {
          session_id: order.session_id,
          table_id: order.table_id,
          total: 0,
          orders: [],
        };
      }

      grouped[order.session_id].total += Number(order.total);

      grouped[order.session_id].orders.push(order);
    });

    setSessions(Object.values(grouped));
  }

  async function completeTable(tableId: number) {

    await supabase
      .from("table_sessions")
      .update({
        status: "closed"
      })
      .eq("table_id", tableId)
      .eq("status", "active");

    await supabase
      .from("orders")
      .update({
        status: "paid"
      })
      .eq("table_id", tableId);

    alert("Table completed");
  }

  async function markSessionPaid(
    sessionId: number,
    tableId: number
  ) {

    if (!paymentMethod[sessionId]) {
      alert("Please select payment method");
      return;
    }

    if (
      paymentMethod[sessionId] === "Card" &&
      !cardType[sessionId]
    ) {
      alert("Please select card type");
      return;
    }

    const session = sessions.find(
      (s) => s.session_id === sessionId
    );

    if (!session) {
      alert("Session not found");
      return;
    }

    const discountP =
      discountPercent[sessionId] || 0;

    const discountRM =
      discountAmount[sessionId] || 0;

    const finalTotal =
      session.total
      - session.total * (discountP / 100)
      - discountRM;

    const confirmed = window.confirm(
      `Pay RM ${finalTotal.toFixed(2)} for Table ${tableId}?`
    );

    if (!confirmed) {
      return;
    }
    const { error } = await supabase
      .from("orders")
      .update({
        status: "paid",

        discount_percent: discountP,

        discount_amount: discountRM,

        final_total: finalTotal,

        payment_method:
          paymentMethod[sessionId] === "Card"
            ? cardType[sessionId]
            : paymentMethod[sessionId] || null,
      })
      .eq("session_id", sessionId)
      .neq("status", "paid");

    if (error) {
      console.log("PAYMENT ERROR:", error);
      alert(error.message);
      return;
    }

    await completeTable(tableId);

    alert(
      `Table ${tableId} paid successfully.`
    );

    await loadOrders();
  }


  async function changeTable(
    sessionId: number,
    currentTableId: number
  ) {

    const newTable =
      moveTable[sessionId];

    if (!newTable) {
      alert("Please select a table");
      return;
    }

    const { data: existing } =
      await supabase
        .from("table_sessions")
        .select("*")
        .eq("table_id", newTable)
        .eq("status", "active")
        .maybeSingle();

    if (existing) {
      alert("Table already occupied");
      return;
    }

    await supabase
      .from("table_sessions")
      .update({
        table_id: newTable,
      })
      .eq("table_id", currentTableId)
      .eq("status", "active");

    await supabase
      .from("orders")
      .update({
        table_id: newTable,
      })
      .eq("session_id", sessionId);

    alert("Table moved successfully");

    loadOrders();
  }

  function getSessionTotal(sessionId: number) {
    const session = sessions.find((item) => item.session_id === sessionId);

    return session ? session.total : 0;
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
        !isCashier(user.email)
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

  }, []);

  return (
    <div className="min-h-screen bg-slate-100 p-8">
      {/* ========================= */}
      {/* HEADER */}
      {/* ========================= */}

      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-4xl font-bold text-black">Cashier</h1>

          <p className="text-gray-500 mt-1">
            Active tables waiting for payment
          </p>
        </div>

        <div className="bg-white px-4 py-3 rounded-lg shadow">
          <p className="text-sm text-gray-500">Active Tables</p>

          <p className="text-2xl font-bold text-black">{sessions.length}</p>
        </div>
      </div>

      {/* ========================= */}
      {/* NO ORDERS */}
      {/* ========================= */}

      {sessions.length === 0 && (
        <div className="bg-white rounded-xl shadow p-10 text-center">
          <h2 className="text-2xl font-bold text-gray-700">
            No tables waiting for payment
          </h2>

          <p className="text-gray-500 mt-2">
            Completed orders will appear here.
          </p>
        </div>
      )}

      {/* ========================= */}
      {/* SESSION CARDS */}
      {/* ========================= */}

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
        {sessions.map((session) => (
          <div
            key={session.session_id}
            className="bg-white rounded-xl shadow-lg overflow-hidden"
          >
            {/* ========================= */}
            {/* TABLE HEADER */}
            {/* ========================= */}

            <div className="bg-slate-800 text-white p-5">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-slate-300">Table</p>

                  <h2 className="text-3xl font-bold">{session.table_id}</h2>
                </div>

                <div className="text-right">
                  <p className="text-sm text-slate-300">Orders</p>

                  <p className="text-2xl font-bold">{session.orders.length}</p>
                </div>
              </div>
            </div>

            {/* ========================= */}
            {/* ORDERS */}
            {/* ========================= */}

            <div className="p-5">
              {session.orders.map((order) => (
                <div key={order.id} className="border rounded-xl p-4 mb-4">
                  {/* ORDER HEADER */}

                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-bold text-lg text-black">
                        Order {order.order_number || order.id}
                      </h3>

                      <p className="text-xs text-gray-500 mt-1">
                        {formatMalaysiaTime(order.created_at)}
                      </p>
                    </div>

                    <span
                      className={`
                                                text-xs
                                                font-bold
                                                px-3
                                                py-1
                                                rounded-full
                                                ${order.status === "pending"
                          ? "bg-yellow-100 text-yellow-700"
                          : order.status ===
                            "preparing"
                            ? "bg-blue-100 text-blue-700"
                            : order.status === "ready"
                              ? "bg-green-100 text-green-700"
                              : "bg-gray-100 text-gray-700"
                        }
                                            `}
                    >
                      {order.status}
                    </span>
                  </div>

                  {/* ========================= */}
                  {/* ORDER ITEMS */}
                  {/* ========================= */}

                  <div className="border-t border-b py-3">
                    {order.order_items && order.order_items.length > 0 ? (
                      order.order_items.map((item, index) => {
                        const itemSubtotal =
                          Number(item.price) * Number(item.quantity);

                        return (
                          <div key={index} className="mb-3 last:mb-0">
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <p className="font-semibold text-black">
                                  {item.quantity}
                                  {" x "}
                                  {item.menu_items?.name || "Unknown item"}
                                </p>

                                <p className="text-xs text-gray-500 mt-1">
                                  RM {Number(item.price).toFixed(2)}
                                  {" each"}
                                </p>
                              </div>

                              <p className="font-semibold text-black">
                                RM {itemSubtotal.toFixed(2)}
                              </p>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-sm text-gray-500">
                        No items found for this order.
                      </p>
                    )}
                  </div>

                  {/* ORDER TOTAL */}

                  <div className="flex justify-between mt-3">
                    <span className="font-semibold text-gray-600">
                      Order Total
                    </span>

                    <span className="font-bold text-black">
                      RM {Number(order.total).toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
              {/* ========================= */}
              {/* SESSION TOTAL */}
              {/* ========================= */}
              <div className="border-t-2 border-slate-300 pt-4 mt-2">
                <div>
                  <div>
                    <p className="text-sm text-gray-500">Table Total</p>

                    <p className="text-3xl font-bold text-green-600">
                      RM{" "}
                      {(
                        session.total -
                        session.total *
                        ((discountPercent[session.session_id] || 0) / 100) -
                        (discountAmount[session.session_id] || 0)
                      ).toFixed(2)}
                    </p>

                    <div className="mt-4">
                      <label className="text-sm font-medium">Discount %</label>

                      <input
                        type="number"
                        value={discountPercent[session.session_id] || 0}
                        onChange={(e) =>
                          setDiscountPercent({
                            ...discountPercent,
                            [session.session_id]: Number(e.target.value),
                          })
                        }
                        className="border p-2 rounded w-full mt-1"
                      />
                    </div>

                    <div className="mt-3">
                      <label className="text-sm font-medium">Discount RM</label>

                      <input
                        type="number"
                        min="0"
                        value={
                          discountAmount[
                          session.session_id
                          ] || 0
                        }
                        onChange={(e) =>
                          setDiscountAmount({
                            ...discountAmount,
                            [session.session_id]:
                              Math.max(
                                0,
                                Number(e.target.value)
                              ),
                          })
                        }
                        className="border p-2 rounded w-full mt-1"
                      />
                    </div>

                    <div className="mt-3">

                      <label className="text-sm font-medium">
                        Move Table
                      </label>

                      <select
                        value={moveTable[session.session_id] || ""}
                        onChange={(e) =>
                          setMoveTable({
                            ...moveTable,
                            [session.session_id]:
                              Number(e.target.value),
                          })
                        }
                        className="border p-2 rounded w-full mt-1"
                      >
                        <option value="">
                          Select New Table
                        </option>

                        {Array.from(
                          { length: 10 },
                          (_, i) => (
                            <option
                              key={i + 1}
                              value={i + 1}
                            >
                              Table {i + 1}
                            </option>
                          )
                        )}
                      </select>

                      <button
                        onClick={() =>
                          changeTable(
                            session.session_id,
                            session.table_id
                          )
                        }
                        className="
      bg-blue-600
      hover:bg-blue-700
      text-white
      rounded
      px-3
      py-2
      mt-2
      w-full
    "
                      >
                        Move Table
                      </button>

                    </div>

                    <div className="mt-3">
                      <label className="text-sm font-medium">
                        Payment Method
                      </label>

                      <select
                        value={paymentMethod[session.session_id] || ""}
                        onChange={(e) =>
                          setPaymentMethod({
                            ...paymentMethod,
                            [session.session_id]: e.target.value,
                          })
                        }
                        className="border p-2 rounded w-full mt-1"
                      >
                        <option value="">Select Payment</option>

                        <option value="Cash">Cash</option>

                        <option value="Card">Card</option>

                        <option value="TNG">TNG</option>

                        <option value="DuitNow">DuitNow</option>
                      </select>
                      {paymentMethod[session.session_id] === "Card" && (
                        <div className="mt-3">
                          <label className="text-sm font-medium">
                            Card Type
                          </label>

                          <select
                            value={cardType[session.session_id] || ""}
                            onChange={(e) =>
                              setCardType({
                                ...cardType,
                                [session.session_id]: e.target.value,
                              })
                            }
                            className="border p-2 rounded w-full mt-1"
                          >
                            <option value="">Select Card Type</option>

                            <option value="Visa">Visa</option>

                            <option value="MasterCard">MasterCard</option>

                            <option value="UnionPay">UnionPay</option>
                          </select>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* CASH PAYMENT */}

                  {paymentMethod[session.session_id] === "Cash" && (

                    <div className="mt-3">

                      <label className="text-sm font-medium">
                        Cash Received
                      </label>

                      <input
                        type="number"
                        value={
                          cashReceived[session.session_id] || ""
                        }
                        onChange={(e) =>
                          setCashReceived({
                            ...cashReceived,
                            [session.session_id]:
                              Number(e.target.value),
                          })
                        }
                        className="border p-2 rounded w-full mt-1"
                      />

                      <p className="mt-3 text-green-600 font-bold">

                        Final Total:

                        RM {
                          (
                            session.total
                            -
                            (
                              session.total *
                              (
                                (discountPercent[
                                  session.session_id
                                ] || 0) / 100
                              )
                            )
                            -
                            (
                              discountAmount[
                              session.session_id
                              ] || 0
                            )
                          ).toFixed(2)
                        }

                      </p>

                      <p className="mt-2 font-bold text-blue-600">

                        Change:

                        RM {
                          Math.max(
                            0,
                            (
                              cashReceived[
                              session.session_id
                              ] || 0
                            )
                            -
                            (
                              session.total
                              -
                              (
                                session.total *
                                (
                                  (discountPercent[
                                    session.session_id
                                  ] || 0
                                  ) / 100
                                )
                              )
                              -
                              (
                                discountAmount[
                                session.session_id
                                ] || 0
                              )
                            )
                          ).toFixed(2)
                        }

                      </p>

                    </div>

                  )}

                  {paymentMethod[session.session_id] &&
                    paymentMethod[session.session_id] !== "Cash" && (

                      <div className="mt-3">

                        <p className="text-green-600 font-bold text-xl">

                          Amount To Pay:

                          RM {
                            (
                              session.total
                              -
                              (
                                session.total *
                                (
                                  (discountPercent[
                                    session.session_id
                                  ] || 0
                                  ) / 100
                                )
                              )
                              -
                              (
                                discountAmount[
                                session.session_id
                                ] || 0
                              )
                            ).toFixed(2)
                          }

                        </p>

                      </div>

                    )}
                </div>
                {/* ========================= */}
                {/* PAY BUTTON */}
                {/* ========================= */}
                <button
                  onClick={() => {

                    const finalTotal =
                      session.total
                      -
                      (
                        session.total *
                        (
                          (discountPercent[
                            session.session_id
                          ] || 0
                          ) / 100
                        )
                      )
                      -
                      (
                        discountAmount[
                        session.session_id
                        ] || 0
                      );

                    if (
                      paymentMethod[
                      session.session_id
                      ] === "Cash"
                    ) {

                      const received =
                        cashReceived[
                        session.session_id
                        ] || 0;

                      if (received < finalTotal) {

                        alert(
                          "Cash received is less than total."
                        );

                        return;
                      }
                    }

                    markSessionPaid(
                      session.session_id,
                      session.table_id
                    );

                  }}
                  className="
                                    w-full
                                    mt-5
                                    bg-green-600
                                    hover:bg-green-700
                                    text-white
                                    font-bold
                                    py-3
                                    rounded-lg
                                    transition
                                "
                >
                  Pay Table RM{" "}
                  {(
                    session.total
                    -
                    (
                      session.total *
                      (
                        (discountPercent[
                          session.session_id
                        ] || 0) / 100
                      )
                    )
                    -
                    (
                      discountAmount[
                      session.session_id
                      ] || 0
                    )
                  ).toFixed(2)}
                </button>

              </div>

            </div>

          </div>

        ))}

      </div>

    </div>

  );
}