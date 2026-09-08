"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { isAdmin } from "@/lib/auth";

interface TableInfo {
    table_id: number;
    total: number;
    orders: number;
    status: string;
}


export default function FloorPage() {

    const router = useRouter();

    const [tables, setTables] = useState<TableInfo[]>([]);

    const [targetTable, setTargetTable] =
        useState<Record<number, number>>({});

    async function loadTables() {
        const { data } = await supabase
            .from("orders")
            .select("*")
            .neq("status", "paid");

        const grouped: Record<number, TableInfo> = {};

        (data || []).forEach((order: any) => {
            if (!grouped[order.table_id]) {
                grouped[order.table_id] = {
                    table_id: order.table_id,
                    total: 0,
                    orders: 0,
                    status: order.status,
                };
            }

            grouped[order.table_id].total += Number(order.total);
            grouped[order.table_id].orders += 1;

            if (order.status === "ready") {
                grouped[order.table_id].status = "Waiting Payment";
            }
        });

        setTables(Object.values(grouped));
    }

    async function transferTable(
        fromTable: number,
        toTable: number
    ) {
        if (!toTable) {
            alert("Select target table");
            return;
        }

        // 检查目标桌是否有 active session
        const { data: occupied } =
            await supabase
                .from("table_sessions")
                .select("id")
                .eq("table_id", toTable)
                .eq("status", "active");

        if (
            occupied &&
            occupied.length > 0
        ) {
            alert(`Table ${toTable} is occupied`);
            return;
        }

        // 找来源桌 active session
        const { data: session } =
            await supabase
                .from("table_sessions")
                .select("*")
                .eq("table_id", fromTable)
                .eq("status", "active")
                .order("id", { ascending: false })
                .limit(1)
                .maybeSingle();

        if (!session) {
            alert("No active session");
            return;
        }

        // 更新 session
        await supabase
            .from("table_sessions")
            .update({
                table_id: toTable,
            })
            .eq("id", session.id);

        // 更新订单
        await supabase
            .from("orders")
            .update({
                table_id: toTable,
            })
            .eq("session_id", session.id);

        alert(
            `Table ${fromTable} moved to Table ${toTable}`
        );

        loadTables();
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

            loadTables();
        }

        checkAccess();

        const interval = setInterval(() => {
            loadTables();
        }, 3000);

        return () => clearInterval(interval);

    }, []);
    return (
        <div className="min-h-screen bg-slate-100 p-8">

            <h1 className="text-4xl font-bold mb-8 text-black">
                Table Management
            </h1>

            <div className="grid md:grid-cols-4 gap-6">

                {tables.map((table) => (

                    <div
                        key={table.table_id}
                        className="bg-white rounded-xl shadow p-6"
                    >

                        <h2 className="text-2xl font-bold mb-3">
                            Table {table.table_id}
                        </h2>

                        <p className="mb-2">
                            Status:
                            <span className="font-bold ml-2">
                                {table.status}
                            </span>
                        </p>

                        <p className="mb-2">
                            Orders: {table.orders}
                        </p>

                        <p className="text-green-600 font-bold text-xl mb-4">
                            RM {table.total.toFixed(2)}
                        </p>
                        <div className="space-y-2">

                            <button
                                onClick={() =>
                                    window.location.href =
                                    `/admin/history`
                                }
                                className="w-full bg-slate-600 text-white py-2 rounded"
                            >
                                View Orders
                            </button>

                            <select
                                value={
                                    targetTable[
                                    table.table_id
                                    ] || ""
                                }
                                onChange={(e) =>
                                    setTargetTable({
                                        ...targetTable,
                                        [table.table_id]:
                                            Number(
                                                e.target.value
                                            ),
                                    })
                                }
                                className="w-full border rounded p-2"
                            >
                                <option value="">
                                    Move To Table
                                </option>

                                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
                                    .filter((t) => t !== table.table_id)
                                    .map((t) => (
                                        <option
                                            key={t}
                                            value={t}
                                        >
                                            Table {t}
                                        </option>
                                    ))}
                            </select>

                            <button
                                onClick={() =>
                                    transferTable(
                                        table.table_id,
                                        targetTable[
                                        table.table_id
                                        ]
                                    )
                                }
                                className="w-full bg-blue-600 text-white py-2 rounded"
                            >
                                Transfer Table
                            </button>

                        </div>

                    </div>

                ))}

            </div>
        </div>
    );
}