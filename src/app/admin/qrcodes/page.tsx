"use client";

import QRCode from "react-qr-code";

export default function QRPage() {
  const baseUrl =
    "https://jikasei-noodles.vercel.app";

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-8">
        Jikasei Noodles
      </h1>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-8">
        {Array.from({ length: 10 }, (_, i) => {
          const tableId = i + 1;

          return (
            <div
              key={tableId}
              className="border rounded-xl p-6 text-center bg-white"
            >
              <h2 className="text-2xl font-bold mb-4">
                Table {tableId}
              </h2>

              <QRCode
                value={`${baseUrl}/table/${tableId}`}
                size={180}
              />

              <p className="mt-4 font-semibold">
                Scan to Order
              </p>
              <p className="text-gray-500">
                Table {tableId}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}