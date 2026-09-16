"use client";
import OrderHistory from "./OrderHistory";
interface CartItem {
    id: number;
    name: string;
    price: number;
    quantity?: number;
}

interface CartModalProps {
    show: boolean;
    cart: CartItem[];
    total: number;

    orders: any[];
    formatMalaysiaTime: (
        date: string
    ) => string;

    increaseQuantity: (
        id: number
    ) => void;

    decreaseQuantity: (
        id: number
    ) => void;

    onClose: () => void;
    onPlaceOrder: () => void;
}

export default function CartModal({
    show,
    cart,
    total,

    orders,
    formatMalaysiaTime,

    increaseQuantity,
    decreaseQuantity,
    onClose,
    onPlaceOrder,
}: CartModalProps) {

    if (!show) return null;

    return (
        <div
            className="
            fixed
            inset-0
            bg-black/50
            z-[9999]
            flex
            items-end
            md:items-center
            justify-center
            "
            onClick={onClose}
        >
            <div
                className="
                bg-white
                w-full
                md:max-w-md
                rounded-t-3xl
                md:rounded-2xl
                p-5
                max-h-[80vh]
                overflow-y-auto
                "
                onClick={(e) => e.stopPropagation()}
            >
                <h2 className="text-2xl font-bold mb-4 text-black">
                    Your Cart
                </h2>
                <OrderHistory
                    orders={orders}
                    formatMalaysiaTime={
                        formatMalaysiaTime
                    }
                />

                {cart.length === 0 ? (
                    <p className="text-gray-500">
                        Cart is empty
                    </p>
                ) : (
                    <>
                        {cart.map((item) => (
                            <div
                                key={item.id}
                                className="border-b py-3"
                            >
                                <div className="flex justify-between items-center">

                                    <div>
                                        <p className="font-medium text-black">
                                            {item.name}
                                        </p>

                                        <p className="text-sm text-gray-500">
                                            RM {item.price}
                                        </p>
                                    </div>

                                    <div className="flex items-center gap-2">

                                        <button
                                            onClick={() =>
                                                decreaseQuantity(
                                                    item.id
                                                )
                                            }
                                            className="
                                            w-8
                                            h-8
                                            bg-red-500
                                            text-white
                                            rounded
                                            "
                                        >
                                            -
                                        </button>

                                        <span className="w-6 text-center text-black">
                                            {item.quantity}
                                        </span>

                                        <button
                                            onClick={() =>
                                                increaseQuantity(
                                                    item.id
                                                )
                                            }
                                            className="
                                            w-8
                                            h-8
                                            bg-green-500
                                            text-white
                                            rounded
                                            "
                                        >
                                            +
                                        </button>

                                    </div>
                                </div>
                            </div>
                        ))}

                        <div className="mt-4 text-xl font-bold text-black">
                            Total: RM {total.toFixed(2)}
                        </div>

                        <button
                            onClick={onPlaceOrder}
                            className="
                            w-full
                            mt-4
                            bg-green-600
                            text-white
                            py-3
                            rounded-lg
                            font-bold
                            "
                        >
                            Place Order
                        </button>
                    </>
                )}

                <button
                    onClick={onClose}
                    className="
                    w-full
                    mt-3
                    bg-gray-300
                    py-3
                    rounded-lg
                    "
                >
                    Close
                </button>
            </div>
        </div>
    );
}