"use client";

interface Category {
    id: number | null;
    name: string;
}

interface CategoryTabsProps {
    categories: Category[];
    selectedCategory: number | null;
    setSelectedCategory: (
        categoryId: number | null
    ) => void;
}

export default function CategoryTabs({
    categories,
    selectedCategory,
    setSelectedCategory,
}: CategoryTabsProps) {
    return (
        <div
            className="
sticky
top-0
z-40
            bg-gray-100
            py-2
            mb-4
            "
        >
            <div
                className="
                flex
                gap-2
                overflow-x-auto
                pb-2
                pl-1
                pr-4
                scrollbar-hide
                "
            >

                {/* Categories */}
                {categories.map((cat) => (
                    <button
                        key={cat.id}
                        onClick={() => {
                            setSelectedCategory(cat.id);
                            document
                                .getElementById("menu-top")
                                ?.scrollIntoView({
                                    behavior: "smooth",
                                    block: "start",
                                });
                        }}
                        className={
                            selectedCategory === cat.id
                                ? "bg-blue-600 text-white px-4 py-2 rounded-lg whitespace-nowrap shrink-0"
                                : "bg-gray-200 text-black px-4 py-2 rounded-lg whitespace-nowrap shrink-0"
                        }
                    >
                        {cat.name}
                    </button>
                ))}
            </div>
        </div>
    );
}