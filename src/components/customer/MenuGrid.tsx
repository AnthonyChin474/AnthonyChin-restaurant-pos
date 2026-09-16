"use client";

import { useState } from "react";
import MenuDetailModal from "./MenuDetailModal";

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
    const [selectedMenu, setSelectedMenu] =
        useState<MenuItem | null>(null);

    const [addedId, setAddedId] =
        useState<number | null>(null);

    return (
        <>
            <div className="grid grid-cols-1 gap-3">

                {menus.map((menu) => (
                    <div
                        key={menu.id}
                        className="
                        bg-white
                        rounded-xl
                        shadow
                        p-3
                        flex
                        gap-3
                        "
                    >

                        {/* Image */}

                        <div className="shrink-0">

                            {menu.image_url && (
                                <img
                                    src={menu.image_url}
                                    alt={menu.name}
                                    onClick={() =>
                                        setSelectedMenu(menu)
                                    }
                                    className="
                                    w-24
                                    h-24
                                    object-cover
                                    rounded-lg
                                    cursor-pointer
                                    "
                                />
                            )}

                        </div>

                        {/* Content */}

                        <div className="flex-1 min-w-0">

                            {menu.is_popular && (
                                <div className="mb-1">
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

                                <h2 className="font-bold text-black text-sm break-words">
                                    {menu.name}
                                </h2>

                            </div>

                            <p className="text-gray-500 text-xs mb-3 line-clamp-2">
                                {menu.description}
                            </p>

                            {!menu.available && (
                                <div className="text-red-600 text-sm font-bold mb-2">
                                    SOLD OUT
                                </div>
                            )}

                            <div className="flex justify-between items-center">

                                <span className="font-bold text-green-600">
                                    RM {Number(menu.price).toFixed(2)}
                                </span>

                                <div className="flex gap-2">

                                    <button
                                        onClick={() =>
                                            setSelectedMenu(menu)
                                        }
                                        className="
                                        bg-gray-200
                                        text-black
                                        text-sm
                                        px-3
                                        py-2
                                        rounded-lg
                                        "
                                    >
                                        View
                                    </button>

                                    <button
                                        disabled={!menu.available}
                                        onClick={() => {

                                            addToCart(menu);

                                            setAddedId(menu.id);

                                            setTimeout(() => {
                                                setAddedId(null);
                                            }, 1000);

                                        }}
                                        className={
                                            menu.available
                                                ? addedId === menu.id
                                                    ? "bg-green-600 text-white text-sm px-3 py-2 rounded-lg"
                                                    : "bg-blue-600 hover:bg-blue-700 text-white text-sm px-3 py-2 rounded-lg"
                                                : "bg-gray-400 text-white text-sm px-3 py-2 rounded-lg cursor-not-allowed"
                                        }
                                    >
                                        {menu.available
                                            ? addedId === menu.id
                                                ? "✓ Added"
                                                : "Add"
                                            : "Sold Out"}
                                    </button>

                                </div>

                            </div>

                        </div>

                    </div>
                ))}

            </div>

            <MenuDetailModal
                menu={selectedMenu}
                onClose={() =>
                    setSelectedMenu(null)
                }
                onAdd={addToCart}
            />
        </>
    );
}