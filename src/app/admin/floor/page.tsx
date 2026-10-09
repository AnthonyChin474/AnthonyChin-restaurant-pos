
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

const TABLE_IDS = Array.from(
    { length: 10 },
    (_, index) => index + 1
);

export default function FloorPage() {
    const router = useRouter();

    const [tables, setTables] = useState<TableInfo[]>([]);
    const [targetTable, setTargetTable] =
        useState<Record<number, number>>({});
    const [loading, setLoading] = useState(true);
    const [movingTable, setMovingTable] =
        useState<number | null>(null);

    const loadTables = useCallback(async () => {
        try {
            // 1. Get all active table sessions
            const { data: sessions, error: sessionError } =
                await supabase
                    .from("table_sessions")
                    .select("id, table_id, status")
                    .eq("status", "active");

            if (sessionError) {
                console.error("SESSION ERROR:", sessionError);
                return;
            }

            const activeSessions = sessions || [];

            const activeSessionIds = activeSessions.map(
                (session) => session.id
            );

            // 2. Get unpaid orders belonging to active sessions
            let orderData: any[] = [];

            if (activeSessionIds.length > 0) {
                const { data, error } = await supabase
                    .from("orders")
                    .select(
                        "id, session_id, table_id, total, status"
                    )
                    .in("session_id", activeSessionIds)
                    .neq("status", "paid");

                if (error) {
                    console.error("ORDER ERROR:", error);
                    return;
                }

                orderData = data || [];
            }

            // 3. Build a card for every table, including empty tables
            const updatedTables: TableInfo[] = TABLE_IDS.map(
                (tableId) => {
                    const session = activeSessions
                        .filter(
                            (item) => item.table_id === tableId
                        )
                        .sort((a, b) => b.id - a.id)[0];

                    const sessionOrders = session
                        ? orderData.filter(
                            (order) =>
                                order.session_id === session.id
                        )
                        : [];

                    const waitingPayment = sessionOrders.some(
                        (order) => order.status === "ready"
                    );

                    return {
                        table_id: tableId,
                        session_id: session?.id ?? null,
                        total: sessionOrders.reduce(
                            (sum, order) =>
                                sum + Number(order.total || 0),
                            0
                        ),
                        orders: sessionOrders.length,
                        status: !session
                            ? "Available"
                            : waitingPayment
                                ? "Waiting Payment"
                                : "Occupied",
                    };
                }
            );

            setTables(updatedTables);
        } catch (error) {
            console.error("FLOOR ERROR:", error);
        } finally {
            setLoading(false);
        }
    }, []);

    async function transferTable(
        fromTable: number,
        toTable: number
    ) {
        if (!toTable || fromTable === toTable) {
            alert("Please select a valid target table.");
            return;
        }

        setMovingTable(fromTable);

        try {
            // Check that the destination table is available
            const { data: occupied, error: occupiedError } =
                await supabase
                    .from("table_sessions")
                    .select("id")
                    .eq("table_id", toTable)
                    .eq("status", "active")
                    .limit(1);

            if (occupiedError) {
                alert(occupiedError.message);
                return;
            }

            if (occupied && occupied.length > 0) {
                alert(`Table ${toTable} is occupied.`);
                return;
            }

            // Find the source table's active session
            const { data: session, error: findError } =
                await supabase
                    .from("table_sessions")
                    .select("id")
                    .eq("table_id", fromTable)
                    .eq("status", "active")
                    .order("id", { ascending: false })
                    .limit(1)
                    .maybeSingle();

            if (findError) {
                alert(findError.message);
                return;
            }

            if (!session) {
                alert("No active session found.");
                return;
            }

            // Move the session to the destination table
            const { error: moveError } = await supabase
                .from("table_sessions")
                .update({ table_id: toTable })
                .eq("id", session.id);

            if (moveError) {
                alert(moveError.message);
                return;
            }

            // Update the related orders
            const { error: orderError } = await supabase
                .from("orders")
                .update({ table_id: toTable })
                .eq("session_id", session.id);

            if (orderError) {
                console.error("ORDER TRANSFER ERROR:", orderError);
                alert(
                    "The session moved, but updating its orders failed. Please check the database."
                );
                await loadTables();
                return;
            }

            setTargetTable((previous) => ({
                ...previous,
                [fromTable]: 0,
            }));

            alert(
                `Table ${fromTable} moved to Table ${toTable}.`
            );

            await loadTables();
        } catch (error) {
            console.error("TRANSFER ERROR:", error);
            alert("Unable to transfer table.");
        } finally {
            setMovingTable(null);
        }
    }

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
                    loadTables();
                }, 3000);
            }
        }

        initialize();

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

    return (
        <div className="min-h-screen bg-slate-100 p-4 md:p-8">
            <div className="mx-auto max-w-7xl">
                <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl md:text-4xl font-bold text-black">
                            Table Management
                        </h1>
                        <p className="mt-2 text-gray-500">
                            Live restaurant floor status
                        </p>
                    </div>

                    <button
                        onClick={() => loadTables()}
                        className="rounded-lg bg-slate-800 px-4 py-2 font-semibold text-white hover:bg-slate-700"
                    >
                        Refresh
                    </button>
                </div>

                {/* Table status legend */}
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
                </div>

                {loading ? (
                    <div className="rounded-xl bg-white p-10 text-center text-gray-500">
                        Loading table status...
                    </div>
                ) : (
                    <>
                        {/* Floor plan */}
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                            {tables.map((table) => {
                                const available =
                                    table.status === "Available";

                                return (
                                    <button
                                        key={table.table_id}
                                        onClick={() => {
                                            if (available) {
                                                alert(
                                                    `Table ${table.table_id} is available.`
                                                );
                                            }
                                        }}
                                        className={`
min - h - 32 rounded - xl border - 2 p - 4
text - left shadow - sm transition
                                            ${available
                                                ? "border-cyan-600 bg-cyan-500 text-white hover:bg-cyan-600"
                                                : "border-red-600 bg-red-500 text-white hover:bg-red-600"
                                            }
`}
                                    >
                                        <div className="text-xs font-semibold opacity-90">
                                            TABLE
                                        </div>

                                        <div className="mt-1 text-3xl font-bold">
                                            {table.table_id}
                                        </div>

                                        <div className="mt-2 text-sm font-semibold">
                                            {available
                                                ? "Available"
                                                : table.status}
                                        </div>

                                        {!available && (
                                            <div className="mt-1 text-xs">
                                                {table.orders} unpaid order(s)
                                            </div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Active table details */}
                        <h2 className="mb-4 mt-8 text-2xl font-bold text-black">
                            Table Details
                        </h2>

                        {occupiedCount === 0 ? (
                            <div className="rounded-xl bg-white p-8 text-center text-gray-500 shadow-sm">
                                All tables are available.
                            </div>
                        ) : (
                            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                                {tables
                                    .filter(
                                        (table) =>
                                            table.status !== "Available"
                                    )
                                    .map((table) => (
                                        <div
                                            key={table.table_id}
                                            className="overflow-hidden rounded-xl bg-white shadow"
                                        >
                                            <div className="flex items-center justify-between bg-slate-800 p-4 text-white">
                                                <h3 className="text-xl font-bold">
                                                    Table {table.table_id}
                                                </h3>

                                                <span
                                                    className={`rounded - full px - 3 py - 1 text - xs font - bold ${table.status ===
                                                            "Waiting Payment"
                                                            ? "bg-amber-400 text-black"
                                                            : "bg-red-500 text-white"
                                                        } `}
                                                >
                                                    {table.status}
                                                </span>
                                            </div>

                                            <div className="p-5">
                                                <p className="mb-2 text-gray-600">
                                                    Unpaid orders:{" "}
                                                    <strong>
                                                        {table.orders}
                                                    </strong>
                                                </p>

                                                <p className="mb-4 text-xl font-bold text-green-600">
                                                    RM{" "}
                                                    {table.total.toFixed(2)}
                                                </p>

                                                <button
                                                    onClick={() =>
                                                        router.push(
                                                            "/admin/history"
                                                        )
                                                    }
                                                    className="mb-3 w-full rounded-lg bg-slate-600 py-2 font-semibold text-white hover:bg-slate-700"
                                                >
                                                    View Orders
                                                </button>

                                                <label className="mb-1 block text-sm font-medium text-gray-700">
                                                    Transfer to
                                                </label>

                                                <select
                                                    value={
                                                        targetTable[
                                                        table.table_id
                                                        ] || ""
                                                    }
                                                    onChange={(event) =>
                                                        setTargetTable(
                                                            (previous) => ({
                                                                ...previous,
                                                                [table.table_id]:
                                                                    Number(
                                                                        event.target.value
                                                                    ),
                                                            })
                                                        )
                                                    }
                                                    className="w-full rounded-lg border p-3 text-black"
                                                >
                                                    <option value="">
                                                        Select available table
                                                    </option>

                                                    {tables
                                                        .filter(
                                                            (target) =>
                                                                target.status ===
                                                                "Available" &&
                                                                target.table_id !==
                                                                table.table_id
                                                        )
                                                        .map((target) => (
                                                            <option
                                                                key={
                                                                    target.table_id
                                                                }
                                                                value={
                                                                    target.table_id
                                                                }
                                                            >
                                                                Table{" "}
                                                                {target.table_id}
                                                            </option>
                                                        ))}
                                                </select>

                                                <button
                                                    disabled={
                                                        !targetTable[
                                                        table.table_id
                                                        ] ||
                                                        movingTable !== null
                                                    }
                                                    onClick={() =>
                                                        transferTable(
                                                            table.table_id,
                                                            targetTable[
                                                            table.table_id
                                                            ]
                                                        )
                                                    }
                                                    className="mt-3 w-full rounded-lg bg-blue-600 py-3 font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-400"
                                                >
                                                    {movingTable ===
                                                        table.table_id
                                                        ? "Transferring..."
                                                        : "Transfer Table"}
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
