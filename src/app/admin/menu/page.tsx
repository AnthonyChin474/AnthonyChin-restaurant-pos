"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface MenuItem {
  id: number;
  category_id: number;
  name: string;
  description: string;
  price: number;
  image_url: string | null;
  available: boolean;
}

export default function MenuPage() {
  const [menus, setMenus] = useState<MenuItem[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [categoryId, setCategoryId] = useState("1");
  const [editingMenu, setEditingMenu] = useState<MenuItem | null>(null);

  async function loadMenus() {
    const { data, error } = await supabase
      .from("menu_items")
      .select("*")
      .order("id");

    if (error) {
      console.log(error);
      return;
    }

    setMenus(data || []);
  }

  async function addMenu() {
    console.log("Button Clicked");

    const { data, error } = await supabase
      .from("menu_items")
      .insert([
        {
          category_id: Number(categoryId),
          name,
          description,
          price: Number(price),
        },
      ])
      .select();

    console.log("DATA:", data);
    console.log("ERROR:", error);

    if (!error) {
      setName("");
      setDescription("");
      setPrice("");
      loadMenus();
    }
  }
  async function toggleAvailable(
    id: number,
    current: boolean
  ) {
    const { error } = await supabase
      .from("menu_items")
      .update({
        available: !current,
      })
      .eq("id", id);

    if (error) {
      console.log(error);
      return;
    }

    loadMenus();
  }
  async function deleteMenu(id: number) {
    await supabase.from("menu_items").delete().eq("id", id);

    loadMenus();
  }

  async function uploadImage(
    event: React.ChangeEvent<HTMLInputElement>,
    menuId: number
  ) {
    const file = event.target.files?.[0];

    if (!file) return;

    const fileName = `${Date.now()}-${file.name}`;

    const { error: uploadError } = await supabase.storage
      .from("menu-images")
      .upload(fileName, file);

    if (uploadError) {
      console.log(uploadError);
      return;
    }

    const { data } = supabase.storage
      .from("menu-images")
      .getPublicUrl(fileName);

    await supabase
      .from("menu_items")
      .update({
        image_url: data.publicUrl,
      })
      .eq("id", menuId);

    loadMenus();
  }

  async function updateMenu() {
    if (!editingMenu) return;

    const { error } = await supabase
      .from("menu_items")
      .update({
        name: editingMenu.name,
        description: editingMenu.description,
        price: editingMenu.price,
        category_id: editingMenu.category_id,
      })
      .eq("id", editingMenu.id);

    if (error) {
      console.log(error);
      return;
    }

    setEditingMenu(null);
    loadMenus();
  }
  async function importFullMenu() {
    const fullMenu = [
      {
        category_id: 1,
        name: "R1 Tonkotsu Ramen",
        description: "Tonkotsu Ramen",
        price: 21.9,
        available: true,
      },
      {
        category_id: 1,
        name: "R2 Kotsumiso Ramen",
        description: "Kotsumiso Ramen",
        price: 21.9,
        available: true,
      },
      {
        category_id: 1,
        name: "R3 Kotsu Spicy Ramen",
        description: "Kotsu Spicy Ramen",
        price: 21.9,
        available: true,
      }
    ];

    const { error } = await supabase
      .from("menu_items")
      .insert(fullMenu);

    if (error) {
      console.log(error);
      alert(error.message);
      return;
    }

    alert("Menu Imported");
    loadMenus();
  }
  useEffect(() => {
    loadMenus();
  }, []);

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 bg-slate-900 text-white min-h-screen p-6">
          <h1 className="text-2xl font-bold mb-8">Restaurant POS</h1>

          <nav className="space-y-3">
            <a href="/admin" className="block p-3 rounded hover:bg-slate-700">
              Dashboard
            </a>

            <a href="/admin/menu" className="block p-3 rounded bg-slate-700">
              Menu Management
            </a>
          </nav>
        </aside>

        {/* Content */}
        <main className="flex-1 p-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-8">
            Menu Management
          </h1>

          {/* Add Menu */}

          <div className="bg-white p-6 rounded-xl shadow mb-8">
            <h2 className="text-xl font-semibold mb-4">Add Menu Item</h2>

            <select
              className="w-full border border-gray-300 rounded p-3 mb-3 text-black"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              <option value="1">Ramen</option>
              <option value="2">Udon</option>
              <option value="3">Teishoku</option>
              <option value="4">Donburi</option>
              <option value="5">Chahan</option>
              <option value="6">Yakimono</option>
              <option value="7">Agemono</option>
              <option value="8">Okonomiyaki</option>
              <option value="9">Okazu</option>
              <option value="10">Beverages</option>
              <option value="11">Add On</option>
            </select>

            <input
              className="w-full border border-gray-300 rounded p-3 mb-3 text-black"
              placeholder="Menu Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />

            <input
              className="w-full border border-gray-300 rounded p-3 mb-3 text-black"
              placeholder="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />

            <input
              className="w-full border border-gray-300 rounded p-3 mb-3 text-black"
              placeholder="Price"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />

            <div className="flex gap-3">
              <button
                onClick={addMenu}
                className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-lg"
              >
                Add Menu
              </button>

              <button
                onClick={importFullMenu}
                className="bg-green-600 hover:bg-green-700 text-white px-5 py-3 rounded-lg"
              >
                Import Full Menu
              </button>
            </div>
          </div>
          {editingMenu && (
            <div className="bg-yellow-50 border border-yellow-300 p-6 rounded-xl shadow mb-8">

              <h2 className="text-xl font-bold mb-4 text-black">
                Edit Menu
              </h2>

              <input
                className="w-full border rounded p-3 mb-3 text-black"
                value={editingMenu.name}
                onChange={(e) =>
                  setEditingMenu({
                    ...editingMenu,
                    name: e.target.value,
                  })
                }
              />

              <input
                className="w-full border rounded p-3 mb-3 text-black"
                value={editingMenu.description}
                onChange={(e) =>
                  setEditingMenu({
                    ...editingMenu,
                    description: e.target.value,
                  })
                }
              />

              <input
                type="number"
                className="w-full border rounded p-3 mb-3 text-black"
                value={editingMenu.price}
                onChange={(e) =>
                  setEditingMenu({
                    ...editingMenu,
                    price: Number(e.target.value),
                  })
                }
              />

              <button
                onClick={updateMenu}
                className="bg-green-600 hover:bg-green-700 text-white px-5 py-3 rounded mr-3"
              >
                Save
              </button>

              <button
                onClick={() => setEditingMenu(null)}
                className="bg-gray-500 hover:bg-gray-600 text-white px-5 py-3 rounded"
              >
                Cancel
              </button>

            </div>
          )}
          {/* Menu List */}

          <div className="bg-white rounded-xl shadow overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-100">
                <tr>
                  <th className="text-left p-4">ID</th>
                  <th className="text-left p-4">Image</th>
                  <th className="text-left p-4">Name</th>
                  <th className="text-left p-4">Description</th>
                  <th className="text-left p-4">Price</th>
                  <th className="text-left p-4">Action</th>
                </tr>
              </thead>

              <tbody>
                {menus.map((menu) => (
                  <tr key={menu.id} className="border-t">

                    <td className="p-4">
                      {menu.id}
                    </td>

                    <td className="p-4">
                      {menu.image_url ? (
                        <img
                          src={menu.image_url}
                          alt={menu.name}
                          className="w-16 h-16 object-cover rounded-lg border"
                        />
                      ) : (
                        <div className="w-16 h-16 bg-gray-200 rounded-lg flex items-center justify-center text-xs text-gray-500">
                          No Image
                        </div>
                      )}
                    </td>

                    <td className="p-4 font-medium">
                      {menu.name}
                    </td>

                    <td className="p-4">
                      {menu.description}
                    </td>

                    <td className="p-4">
                      RM {menu.price}
                    </td>

                    <td className="p-4 space-x-2">

                      <label className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded cursor-pointer">

                        Upload

                        <input
                          type="file"
                          className="hidden"
                          accept="image/*"
                          onChange={(e) => uploadImage(e, menu.id)}
                        />

                      </label>

                      <button
                        onClick={() => setEditingMenu(menu)}
                        className="bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-1 rounded"
                      >
                        Edit
                      </button>

                      <button
                        onClick={() =>
                          toggleAvailable(
                            menu.id,
                            menu.available
                          )
                        }
                        className={
                          menu.available
                            ? "bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded"
                            : "bg-gray-600 hover:bg-gray-700 text-white px-3 py-1 rounded"
                        }
                      >
                        {menu.available
                          ? "Available"
                          : "Sold Out"}
                      </button>

                      <button
                        onClick={() => deleteMenu(menu.id)}
                        className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded"
                      >
                        Delete
                      </button>

                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </main>
      </div>
    </div>
  );
}
