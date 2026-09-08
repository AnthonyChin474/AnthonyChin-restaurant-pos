export default function Home() {
  return (
    <main className="min-h-screen bg-slate-100 p-10">
      <h1 className="text-4xl font-bold">
        Anthony Restaurant POS
      </h1>

      <p className="mt-3 text-gray-600">
        Genius POS Style Restaurant System
      </p>

      <div className="grid grid-cols-2 gap-4 mt-10">
        <a
          href="/admin"
          className="bg-white p-6 rounded-xl shadow"
        >
          Admin Dashboard
        </a>

        <a
          href="/kitchen"
          className="bg-white p-6 rounded-xl shadow"
        >
          Kitchen Screen
        </a>

        <a
          href="/cashier"
          className="bg-white p-6 rounded-xl shadow"
        >
          Cashier Screen
        </a>

        <a
          href="/menu/1"
          className="bg-white p-6 rounded-xl shadow"
        >
          Customer Menu
        </a>
      </div>
    </main>
  );
}