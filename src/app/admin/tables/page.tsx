"use client";

import QRCode from "react-qr-code";

export default function TablesPage() {
    const tables = Array.from(
        { length: 10 },
        (_, i) => i + 1
    );

    return (
        <div className="min-h-screen bg-slate-100 p-8">

            <h1 className="text-4xl font-bold mb-8 text-black">
                QR Code Management
            </h1>

            <div className="grid md:grid-cols-4 gap-6">

                {tables.map((table) => {

                    const url =
                        `https://jikasei-pos.vercel.app/table/${table}`;

                    return (
                        <div
                            key={table}
                            className="bg-white rounded-xl shadow p-6 text-center"
                        >

                            <h2 className="text-2xl font-bold mb-4 text-black">
                                Table {table}
                            </h2>

                            <div className="bg-white p-4 inline-block">
                                <QRCode
                                    value={url}
                                    size={180}
                                />
                            </div>

                            <p className="mt-4 text-sm text-gray-500 break-all">
                                {url}
                            </p>

                        </div>
                    );
                })}
            </div>
        </div>
    );
}