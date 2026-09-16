"use client";

interface MenuItem {
    id: number;
    category_id: number;
    name: string;
    description: string;
    price: number;
    image_url: string | null;
    available: boolean;
    is_popular?: boolean;
}

interface MenuGridProps {
    menus: MenuItem[];
    addToCart: (menu: MenuItem) => void;
}

export default function MenuGrid({
    menus,
    addToCart,
}: MenuGridProps) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {menus.map((menu) => (
                <div
                    key={menu.id}
                    className="bg-white rounded-xl shadow p-4"
                >

                    {menu.image_url && (
                        <img
                            src={menu.image_url}
                            alt={menu.name}
                            className="
w-full
h-40
md:h-48
object-cover
rounded-lg
mb-3
"
                        />
                    )}

                    {menu.is_popular && (
                        <div className="mb-2">
                            <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                                🔥 Popular
                            </span>
                        </div>
                    )}

                    <div className="flex items-center gap-2 mb-1">

                        <span
                            className="
                            bg-blue-100
                            text-blue-700
                            text-xs
                            px-2
                            py-1
                            rounded
                            font-bold
                            "
                        >
                            {menu.name.split(" ")[0]}
                        </span>

                        <h2 className="text-base font-bold text-black break-words">
                            {menu.name}
                        </h2>

                    </div>

                    {!menu.available && (
                        <div className="text-red-600 font-bold mb-2">
                            SOLD OUT
                        </div>
                    )}

                    <p className="text-gray-600 text-sm mb-3">
                        {menu.description}
                    </p>

                    <div className="flex justify-between items-center gap-2">

                        <span className="font-bold text-green-600">
                            RM {Number(menu.price).toFixed(2)}
                        </span>

                        <button
                            disabled={!menu.available}
                            onClick={() => addToCart(menu)}
                            className={
                                menu.available
                                    ? "bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
                                    : "bg-gray-400 text-white px-4 py-2 rounded-lg cursor-not-allowed"
                            }
                        >
                            {menu.available
                                ? "Add"
                                : "Sold Out"}
                        </button>

                    </div>

                </div>
            ))}

        </div>
    );
}