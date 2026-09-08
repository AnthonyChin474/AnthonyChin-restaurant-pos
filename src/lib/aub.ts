import { supabase } from "./supabase";

export async function getCurrentUser() {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
}

export function isAdmin(email?: string | null) {
  return email === "admin@jikasei.com";
}

export function isCashier(email?: string | null) {
  return email === "cashier@jikasei.com";
}

export function isKitchen(email?: string | null) {
  return email === "kitchen@jikasei.com";
}