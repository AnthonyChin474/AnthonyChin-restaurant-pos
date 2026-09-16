"use client";

interface CartItem {
    id: number;
    name: string;
    price: number;
    quantity?: number;
}

interface ConfirmModalProps {
    show: boolean;
    cart: CartItem[];
    total: number;
    onCancel: () => void;
    onConfirm: () => void;
}

export default function ConfirmModal({
    show,
    cart,
    total,
    onCancel,
    onConfirm,
}: ConfirmModalProps) {

    if (!show) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]">

            <div className="bg-white rounded-xl p-6 w-[400px] shadow-xl">

                <h2 className="text-xl font-bold mb-4 text-black">
                    Confirm Order
                </h2>

                <div className="space-y-2 mb-4">

                    {cart.map((item) => (
                        <div
                            key={item.id}
                            className="flex justify-between"
                        >
                            <span>
                                {item.quantity}x {item.name}
                            </span>

                            <span>
                                RM{" "}
                                {(
                                    item.price *
                                    (item.quantity || 1)
                                ).toFixed(2)}
                            </span>
                        </div>
                    ))}

                </div>

                <div className="font-bold text-lg mb-4 text-black">
                    Total: RM {total.toFixed(2)}
                </div>

                <div className="flex gap-3">

                    <button
                        onClick={onCancel}
                        className="flex-1 bg-gray-500 text-white py-2 rounded"
                    >
                        Cancel
                    </button>

                    <button
                        onClick={onConfirm}
                        className="flex-1 bg-green-600 text-white py-2 rounded"
                    >
                        Confirm
                    </button>

                </div>

            </div>

        </div>
    );
}