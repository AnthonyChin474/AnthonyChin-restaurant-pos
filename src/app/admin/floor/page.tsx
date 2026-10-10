"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { isAdmin } from "@/lib/auth";

interface TableInfo {
    table_id: number;
    session_id: number | null;
    total: number;
    orders: number;
    status: "Available" | "Occupied" | "Waiting Payment";
}

const TABLE_IDS = Array.from({ length: 10 }, (_, index) => index + 1);

export default function FloorPage() {
    const router = useRouter();

    const [tables, setTables] = useState<TableInfo[]>([]);
    const [selectedTableId, setSelectedTableId] = useState<number>(1);
    const [loading, setLoading] = useState(true);

    // Load the status of all tables
    const loadTables = useCallback(async () => {
        try {
            // 1. Get all active table sessions
            const { data: sessions, error: sessionError } = await supabase
                .from("table_sessions")
                .select("id, table_id, status")
                .eq("status", "active");

            if (sessionError) {
                console.error("SESSION ERROR:", sessionError);
                return;
            }

            const activeSessions = sessions || [];

            const activeSessionIds = activeSessions.map((session) => session.id);

            // 2. Get unpaid orders belonging to active sessions
            let orderData: any[] = [];

            if (activeSessionIds.length > 0) {
                const { data, error } = await supabase
                    .from("orders")
                    .select("id, session_id, table_id, total, status")
                    .in("session_id", activeSessionIds)
                    .neq("status", "paid");

                if (error) {
                    console.error("ORDER ERROR:", error);
                    return;
                }

                orderData = data || [];
            }

            // 3. Build a card for every table, including empty tables
            const updatedTables: TableInfo[] = TABLE_IDS.map((tableId) => {
                const session = activeSessions
                    .filter((item) => item.table_id === tableId)
                    .sort((a, b) => b.id - a.id)[0];

                const sessionOrders = session
                    ? orderData.filter((order) => order.session_id === session.id)
                    : [];

                const waitingPayment = sessionOrders.some(
                    (order) => order.status === "ready"
                );

                return {
                    table_id: tableId,
                    session_id: session?.id ?? null,
                    total: sessionOrders.reduce(
                        (sum, order) => sum + Number(order.total || 0),
                        0
                    ),
                    orders: sessionOrders.length,
                    status: !session
                        ? "Available"
                        : waitingPayment
                            ? "Waiting Payment"
                            : "Occupied",
                };
            });

            setTables(updatedTables);
        } catch (error) {
            console.error("FLOOR ERROR:", error);
        } finally {
            setLoading(false);
        }
    }, []);

    // Verify admin access and refresh table statuses automatically
    useEffect(() => {
        let cancelled = false;
        let interval: ReturnType<typeof setInterval> | undefined;

        async function initialize() {
            const {
                data: { user },
            } = await supabase.auth.getUser();

            if (cancelled) return;

            if (!user || !isAdmin(user.email)) {
                router.push("/login");
                return;
            }

            await loadTables();

            if (!cancelled) {
                interval = setInterval(() => {
                    void loadTables();
                }, 3000);
            }
        }

        void initialize();

        return () => {
            cancelled = true;

            if (interval) {
                clearInterval(interval);
            }
        };
    }, [router, loadTables]);

    const occupiedCount = tables.filter(
        (table) => table.status !== "Available"
    ).length;

    const availableCount = tables.filter(
        (table) => table.status === "Available"
    ).length;

    const waitingPaymentCount = tables.filter(
        (table) => table.status === "Waiting Payment"
    ).length;
    const selectedTable =
        tables.find((table) => table.table_id === selectedTableId) ??
        tables[0] ??
        null;

    return (
        <div className="min-h-screen bg-slate-100 p-4 md:p-8">
            <div className="mx-auto max-w-7xl">
                {/* Page header */}
                <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-black md:text-4xl">
                            Table Management
                        </h1>

                        <p className="mt-2 text-gray-500">
                            Live restaurant floor status
                        </p>
                    </div>


                    <div className="flex flex-wrap gap-3">
                        <button
                            type="button"
                            onClick={() => void loadTables()}
                            className="rounded-lg bg-slate-800 px-5 py-3 text-base font-semibold text-white hover:bg-slate-700"
                        >
                            Refresh
                        </button>
                    </div>

                </div>

                {/* Table status summary */}
                <div className="mb-6 flex flex-wrap gap-4 rounded-xl bg-white p-4 shadow-sm">
                    <div className="flex items-center gap-2">
                        <span className="h-4 w-4 rounded bg-cyan-500" />
                        <span className="text-sm text-gray-700">
                            Available ({availableCount})
                        </span>
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="h-4 w-4 rounded bg-red-500" />
                        <span className="text-sm text-gray-700">
                            Occupied ({occupiedCount})
                        </span>
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="h-4 w-4 rounded bg-amber-500" />
                        <span className="text-sm text-gray-700">
                            Waiting Payment ({waitingPaymentCount})
                        </span>
                    </div>
                </div>

                {/* Table grid */}

                {/* Table selection and actions */}
                {loading ? (
                    <div className="rounded-xl bg-white p-10 text-center text-gray-500">
                        Loading table status...
                    </div>
                ) : (
                    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[1.1fr_0.9fr]">
                        {/* Left: Select a table */}
                        <section className="rounded-xl bg-white p-4 shadow-sm md:p-6">
                            <h2 className="mb-4 text-2xl font-bold text-black">
                                Select Table
                            </h2>

                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                                {tables.map((table) => {
                                    const available = table.status === "Available";
                                    const waitingPayment =
                                        table.status === "Waiting Payment";
                                    const selected = table.table_id === selectedTableId;

                                    return (
                                        <button
                                            key={table.table_id}
                                            type="button"
                                            onClick={() => setSelectedTableId(table.table_id)}
                                            aria-pressed={selected}
                                            className={`min-h-32 rounded-xl border-2 p-4 text-left shadow-sm transition ${selected
                                                    ? "border-blue-800 ring-4 ring-blue-200"
                                                    : "border-transparent"
                                                } ${available
                                                    ? "bg-cyan-500 text-white hover:bg-cyan-600"
                                                    : waitingPayment
                                                        ? "bg-amber-500 text-white hover:bg-amber-600"
                                                        : "bg-red-500 text-white hover:bg-red-600"
                                                }`}
                                        >
                                            <div className="text-xs font-semibold">
                                                TABLE
                                            </div>

                                            <div className="mt-1 text-3xl font-bold">
                                                {table.table_id}
                                            </div>

                                            <div className="mt-2 text-sm font-semibold">
                                                {table.status}
                                            </div>

                                            {!available && (
                                                <div className="mt-1 text-xs">
                                                    {table.orders} unpaid order(s)
                                                </div>
                                            )}

                                            {selected && (
                                                <div className="mt-2 text-sm font-bold">
                                                    ✓ Selected
                                                </div>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>

                            <p className="mt-4 text-sm text-gray-500">
                                Tap a table to view its details and actions.
                            </p>
                        </section>

                        {/* Right: Actions for the selected table */}
                        <section className="rounded-xl bg-white p-5 shadow-sm md:p-6">
                            {selectedTable ? (
                                <>
                                    <div className="mb-5 border-b border-gray-200 pb-4">
                                        <p className="text-sm font-medium text-gray-500">
                                            SELECTED TABLE
                                        </p>

                                        <h2 className="mt-1 text-3xl font-bold text-black">
                                            Table {selectedTable.table_id}
                                        </h2>

                                        <span
                                            className={`mt-3 inline-block rounded-full px-4 py-2 text-sm font-bold ${selectedTable.status === "Available"
                                                    ? "bg-cyan-100 text-cyan-800"
                                                    : selectedTable.status === "Waiting Payment"
                                                        ? "bg-amber-100 text-amber-800"
                                                        : "bg-red-100 text-red-800"
                                                }`}
                                        >
                                            {selectedTable.status}
                                        </span>
                                    </div>

                                    {selectedTable.status === "Available" ? (
                                        <>
                                            <p className="mb-5 text-gray-600">
                                                This table is available. Start a new order
                                                for this table.
                                            </p>

                                            <button
                                                type="button"
                                                onClick={() =>
                                                    router.push(
                                                        `/admin/manual-order?table=${selectedTable.table_id}`
                                                    )
                                                }
                                                className="w-full rounded-xl bg-green-600 px-5 py-4 text-lg font-bold text-white hover:bg-green-700"
                                            >
                                                + Start Order
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <div className="mb-5 rounded-lg bg-slate-50 p-4">
                                                <p className="text-base text-gray-600">
                                                    Unpaid orders
                                                </p>

                                                <p className="mt-1 text-2xl font-bold text-black">
                                                    {selectedTable.orders}
                                                </p>

                                                <p className="mt-4 text-base text-gray-600">
                                                    Total amount
                                                </p>

                                                <p className="mt-1 text-3xl font-bold text-green-700">
                                                    RM {selectedTable.total.toFixed(2)}
                                                </p>
                                            </div>

                                            <div className="flex flex-col gap-3">
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        router.push(
                                                            `/admin/manual-order?table=${selectedTable.table_id}`
                                                        )
                                                    }
                                                    className="w-full rounded-xl bg-green-600 px-5 py-4 text-lg font-bold text-white hover:bg-green-700"
                                                >
                                                    + Add Items
                                                </button>

                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        router.push(
                                                            `/admin/cashier?table=${selectedTable.table_id}`
                                                        )
                                                    }
                                                    className="w-full rounded-xl bg-blue-600 px-5 py-4 text-lg font-bold text-white hover:bg-blue-700"
                                                >
                                                    View Orders / Payment
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </>
                            ) : (
                                <p className="text-gray-500">
                                    Select a table to view its details.
                                </p>
                            )}
                        </section>
                    </div>
                )}

            </div>
        </div>
    );
}