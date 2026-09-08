export const ROLES = {
    ADMIN: "admin@jikasei.com",
    CASHIER: "cashier@jikasei.com",
    KITCHEN: "kitchen@jikasei.com",
};

export function isAdmin(email?: string | null) {
    return email === ROLES.ADMIN;
}

export function isCashier(email?: string | null) {
    return email === ROLES.CASHIER;
}

export function isKitchen(email?: string | null) {
    return email === ROLES.KITCHEN;
}