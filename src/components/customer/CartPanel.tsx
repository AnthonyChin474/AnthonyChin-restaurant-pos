"use client";

interface CartItem {
    id: number;
    name: string;
    price: number;
    quantity?: number;
}

interface CartPanelProps {
    cart: CartItem[];
    total: number;
    increaseQuantity: (id: number) => void;
    decreaseQuantity: (id: number) => void;
    onPlaceOrder: () => void;
}

export default function CartPanel({
    cart,
    total,
    increaseQuantity,
    decreaseQuantity,
    onPlaceOrder,
}: CartPanelProps) {
    return (
        <>
            {cart.length === 0 ? (
                <p className="text-gray-500">
                    Your cart is empty.
                    Add some delicious food 🍜
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
w-10
h-10
bg-red-500
text-white
rounded
font-bold
"
                                    >
                                        -
                                    </button>

                                    <span className="font-bold text-black w-6 text-center">
                                        {item.quantity}
                                    </span>

                                    <button
                                        onClick={() =>
                                            increaseQuantity(
                                                item.id
                                            )
                                        }
                                        className="
w-10
h-10
bg-green-500
text-white
rounded
font-bold
"
                                    >
                                        +
                                    </button>

                                </div>
                            </div>

                            <div className="text-right text-sm text-gray-700 mt-1">
                                RM{" "}
                                {(
                                    item.price *
                                    (item.quantity || 1)
                                ).toFixed(2)}
                            </div>
                        </div>
                    ))}

                    <div className="mt-4 font-bold text-xl text-black">
                        Total: RM {total.toFixed(2)}
                    </div>

                    <button
                        onClick={onPlaceOrder}
                        className="w-full mt-4 bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg"
                    >
                        Place Order
                    </button>
                </>
            )}
        </>
    );
}