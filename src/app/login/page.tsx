"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import {
    isAdmin,
    isCashier,
    isKitchen,
} from "@/lib/auth";

export default function LoginPage() {

    const router = useRouter();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    async function login() {

        try {

            const { data, error } =
                await supabase.auth.signInWithPassword({
                    email,
                    password,
                });

            console.log("LOGIN RESULT", data);
            console.log("LOGIN ERROR", error);

            if (error) {
                alert(error.message);
                return;
            }

        } catch (err) {

            console.log("FULL ERROR", err);

            alert("Failed to fetch");
        }

        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) return;

        if (isAdmin(user.email)) {
            router.push("/admin");
        }
        else if (isCashier(user.email)) {
            router.push("/admin/cashier");
        }
        else if (isKitchen(user.email)) {
            router.push("/admin/kitchen");
        }
        else {
            alert("Unauthorized Account");

            await supabase.auth.signOut();

            return;
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-100">

            <div className="bg-white p-8 rounded-xl shadow w-96">

                <h1 className="text-3xl font-bold mb-6">
                    Jikasei Admin Login
                </h1>

                <input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) =>
                        setEmail(e.target.value)
                    }
                    className="border p-3 rounded w-full mb-3"
                />

                <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) =>
                        setPassword(e.target.value)
                    }
                    className="border p-3 rounded w-full mb-4"
                />

                <button
                    onClick={login}
                    className="w-full bg-blue-600 text-white p-3 rounded"
                >
                    Login
                </button>

            </div>

        </div>
    );
}