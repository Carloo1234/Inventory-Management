// Demo seed: friendly shop with staff at different permission levels.
// Run:  node --env-file=.env scripts/seed-demo.mjs   (from backend/, server must be running)
// Safe to re-run: existing users are signed into instead of recreated,
// and existing demo rows are reused (looked up by name/email).
import assert from "node:assert/strict";
import { existsSync } from "node:fs";

const BASE = (process.env.API_URL || "http://localhost:3000").replace(/\/+$/, "");
const PASSWORD = "Demo1234";
const PNG_1PX = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
);

class Client {
    constructor() {
        this.cookie = "";
    }
    async req(method, path, body) {
        const res = await fetch(`${BASE}${path}`, {
            method,
            headers: { "Content-Type": "application/json", ...(this.cookie ? { Cookie: this.cookie } : {}) },
            body: body === undefined ? undefined : JSON.stringify(body),
        });
        const setCookies = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
        for (const c of setCookies) {
            const m = c.match(/session_id=([^;]*)/);
            if (m) this.cookie = m[1] ? `session_id=${m[1]}` : "";
        }
        const text = await res.text();
        return { status: res.status, json: text ? JSON.parse(text) : null };
    }
}

async function login(email, name) {
    const c = new Client();
    let r = await c.req("POST", "/auth/signup", { name, email, password: PASSWORD, confirm: PASSWORD });
    if (r.status !== 201) {
        r = await c.req("POST", "/auth/signin", { email, password: PASSWORD });
        assert.equal(r.status, 201, `signin failed for ${email}: ${r.status}`);
    }
    return c;
}

const ok = (r, code, what) => assert.equal(r.status, code, `${what}: want ${code} got ${r.status}`);

const owner = await login("owner@pos.demo", "Olivia Owner");
const maria = await login("maria.manager@pos.demo", "Maria Manager");
const sam = await login("sam.cashier@pos.demo", "Sam Cashier");
const alex = await login("alex.newbie@pos.demo", "Alex Newbie");
console.log("users ready (owner, maria, sam, alex)");

// Shop (reuse by name for idempotent re-runs)
let r = await owner.req("GET", "/shops/my-shops");
let shop = r.json.data.shops.find((s) => s.name === "Downtown Store");
if (!shop) {
    r = await owner.req("POST", "/shops/", { name: "Downtown Store" });
    ok(r, 201, "create shop");
    r = await owner.req("GET", "/shops/my-shops");
    shop = r.json.data.shops.find((s) => s.name === "Downtown Store");
}
const shopId = shop.id;
console.log(`shop ready: Downtown Store (${shopId})`);

// Roles (reuse by name)
async function ensureRole(name, permissions) {
    let list = await owner.req("GET", `/shops/${shopId}/roles`);
    let role = list.json.data.find((x) => x.name === name);
    if (!role) {
        const c = await owner.req("POST", `/shops/${shopId}/roles`, { name, permissions });
        ok(c, 201, `create role ${name}`);
        role = c.json.data;
    }
    return role;
}
const managerRole = await ensureRole("Store Manager", [
    "shop:read", "shop:update", "product:create", "product:read", "product:update", "product:delete",
    "roles:read", "invite:create", "invite:read", "manager:read",
]);
const cashierRole = await ensureRole("Cashier", ["shop:read", "product:read", "invite:read"]);
console.log("roles ready (Store Manager, Cashier)");

// Invite + accept helper (accepts if a pending invite exists)
async function ensureManager(client, email, roleId) {
    let list = await owner.req("GET", `/shops/${shopId}/managers`);
    const me = await client.req("GET", "/auth/me");
    if (list.json.data.some((m) => m.managerId === me.json.data.user.id)) return;
    let inv = await owner.req("POST", `/shops/${shopId}/invites`, { email, roleId });
    if (inv.status !== 201) {
        const all = await owner.req("GET", `/shops/${shopId}/invites`);
        inv = { json: { data: { invite: all.json.data.find((i) => i.invitedUser.email === email) } } };
    }
    const inviteId = inv.json.data.invite?.id ?? inv.json.data.id;
    const acc = await client.req("POST", `/shops/${shopId}/invites/${inviteId}/accept`);
    ok(acc, 201, `accept for ${email}`);
}
await ensureManager(maria, "maria.manager@pos.demo", managerRole.id);
await ensureManager(sam, "sam.cashier@pos.demo", cashierRole.id);
console.log("managers ready (maria = Store Manager, sam = Cashier)");

// Pending invite for alex (left unaccepted on purpose)
{
    const all = await owner.req("GET", `/shops/${shopId}/invites`);
    if (!all.json.data.some((i) => i.invitedUser.email === "alex.newbie@pos.demo")) {
        const inv = await owner.req("POST", `/shops/${shopId}/invites`, {
            email: "alex.newbie@pos.demo",
            roleId: cashierRole.id,
        });
        ok(inv, 201, "invite alex");
    }
    console.log("pending invite ready (alex as Cashier — accept it from My Invites)");
}

// Attributes (reuse by name)
async function ensureAttr(name, values) {
    let list = await owner.req("GET", `/shops/${shopId}/attributes`);
    let attr = list.json.data.find((a) => a.name === name);
    if (!attr) {
        const c = await owner.req("POST", `/shops/${shopId}/attributes`, { name });
        ok(c, 201, `create attr ${name}`);
        attr = c.json.data;
    }
    for (const value of values) {
        const vals = await owner.req("GET", `/shops/${shopId}/attributes/${attr.id}/values`);
        if (!vals.json.data.some((v) => v.value === value)) {
            await owner.req("POST", `/shops/${shopId}/attributes/${attr.id}/values`, { value });
        }
    }
    const full = await owner.req("GET", `/shops/${shopId}/attributes/${attr.id}`);
    return full.json.data;
}
const color = await ensureAttr("Color", ["Red", "Blue", "Black"]);
const size = await ensureAttr("Size", ["S", "M", "L"]);
const val = (attr, v) => attr.values.find((x) => x.value === v).id;
console.log("attributes ready (Color, Size)");

// Products (reuse by name)
async function ensureProduct(name, variants) {
    let list = await owner.req("GET", `/shops/${shopId}/products?page=1&limit=100&search=${encodeURIComponent(name)}`);
    let prod = list.json.data.items.find((p) => p.name === name);
    if (!prod) {
        const c = await owner.req("POST", `/shops/${shopId}/products`, { name, variants });
        ok(c, 201, `create product ${name}`);
        prod = c.json.data.product;
    }
    return prod;
}
const shirt = await ensureProduct("Classic T-Shirt", [
    { sku: "TSHIRT-RED-M", price: "19.99", quantity: 42, attributeValueIds: [val(color, "Red"), val(size, "M")] },
    { sku: "TSHIRT-BLUE-L", barcode: "1000000000011", price: "21.50", quantity: 15, attributeValueIds: [val(color, "Blue"), val(size, "L")] },
    { sku: "TSHIRT-BLACK-S", price: "19.99", quantity: 0, attributeValueIds: [val(color, "Black"), val(size, "S")] },
]);
await ensureProduct("Coffee Mug", [
    { sku: "MUG-WHITE", price: "9.50", quantity: 100, attributeValueIds: [] },
    { sku: "MUG-BLACK", barcode: "1000000000028", price: "10.00", quantity: 60, attributeValueIds: [val(color, "Black")] },
]);
console.log("products ready (Classic T-Shirt x3, Coffee Mug x2)");

// One shared image on the shirt (multipart upload)
{
    const det = await owner.req("GET", `/shops/${shopId}/products/${shirt.id}`);
    const hasImage = det.json.data.images.length > 0;
    if (!hasImage) {
        const fd = new FormData();
        fd.append("image", new Blob([PNG_1PX], { type: "image/png" }), "shirt.png");
        const res = await fetch(`${BASE}/shops/${shopId}/products/${shirt.id}/images/upload`, {
            method: "POST",
            headers: { Cookie: owner.cookie },
            body: fd,
        });
        assert.equal(res.status, 201, `upload failed: ${res.status}`);
    }
    console.log("image ready (shared on Classic T-Shirt)");
}

console.log(`
Demo accounts (password for all): ${PASSWORD}
  owner@pos.demo          → shop owner (everything)
  maria.manager@pos.demo  → Store Manager (broad, no deletes)
  sam.cashier@pos.demo    → Cashier (read-only-ish)
  alex.newbie@pos.demo    → pending Cashier invite (My Invites → Accept)
Shop: Downtown Store`);
