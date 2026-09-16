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

interface MenuDetailModalProps {
    menu: MenuItem | null;
    onClose: () => void;
    onAdd: (menu: MenuItem) => void;
}

export default function MenuDetailModal({
    menu,
    onClose,
    onAdd,
}: MenuDetailModalProps) {
    if (!menu) return null;

    return (
        <div
            className="
            fixed
            inset-0
            bg-black/50
            flex
            items-center
            justify-center
            z-[9999]
            p-4
            "
            onClick={onClose}
        >
            <div
                className="
                bg-white
                rounded-xl
                w-full
                max-w-md
                overflow-hidden
                "
                onClick={(e) =>
                    e.stopPropagation()
                }
            >
                {menu.image_url && (
                    <img
                        src={menu.image_url}
                        alt={menu.name}
                        className="
                        w-full
                        h-64
                        object-cover
                        "
                    />
                )}

                <div className="p-4">

                    <h2 className="text-xl font-bold text-black mb-2">
                        {menu.name}
                    </h2>

                    <p className="text-gray-600 mb-4">
                        {menu.description}
                    </p>

                    <div className="text-2xl font-bold text-green-600 mb-4">
                        RM {Number(menu.price).toFixed(2)}
                    </div>

                    <div className="flex gap-3">

                        <button
                            onClick={onClose}
                            className="
                            flex-1
                            bg-gray-300
                            py-3
                            rounded-lg
                            "
                        >
                            Close
                        </button>

                        <button
                            onClick={() => {
                                onAdd(menu);
                                onClose();
                            }}
                            className="
                            flex-1
                            bg-blue-600
                            text-white
                            py-3
                            rounded-lg
                            "
                        >
                            Add To Cart
                        </button>

                    </div>

                </div>
            </div>
        </div>
    );
}