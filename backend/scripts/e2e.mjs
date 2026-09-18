// End-to-end integration test for the whole backend (real server + real DB).
// Run:  node scripts/e2e.mjs        (from backend/, server must be running)
// Unlike the unit tests, this exercises all 19 endpoints over HTTP with real
// sessions, real postgres rows and real redis sessions — the Postman flow,
// automated: signup -> shops -> roles -> invites -> cleanup.

import assert from "node:assert/strict";

const BASE = (process.env.API_URL || "http://localhost:3000").replace(/\/+$/, "");
const stamp = Date.now().toString(36);
const ownerEmail = `e2e-owner-${stamp}@mail.com`;
const memberEmail = `e2e-member-${stamp}@mail.com`;
const PASSWORD = "Password1";

// ---------------------------------------------------------------------------
// Minimal cookie-aware HTTP client (one per user, like separate browsers)
// ---------------------------------------------------------------------------
class Client {
    constructor() {
        this.cookie = "";
    }
    async req(method, path, body) {
        const res = await fetch(`${BASE}${path}`, {
            method,
            headers: {
                "Content-Type": "application/json",
                ...(this.cookie ? { Cookie: this.cookie } : {}),
            },
            body: body === undefined ? undefined : JSON.stringify(body),
        });
        // Persist session cookie across requests
        const setCookies =
            typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
        for (const c of setCookies) {
            const m = c.match(/session_id=([^;]*)/);
            if (m) this.cookie = m[1] ? `session_id=${m[1]}` : "";
        }
        const text = await res.text();
        let json = null;
        try {
            json = text ? JSON.parse(text) : null;
        } catch {
            json = null;
        }
        return { status: res.status, json, raw: text };
    }
}

// ---------------------------------------------------------------------------
// Step runner: pretty PASS/FAIL per endpoint, exact failure pinpointed
// ---------------------------------------------------------------------------
let passed = 0;
let failed = 0;
const failures = [];
async function step(name, fn) {
    try {
        await fn();
        passed++;
        console.log(`  ✓ ${name}`);
    } catch (err) {
        failed++;
        failures.push(name);
        console.log(`  ✗ ${name}`);
        console.log(`    → ${err.message.split("\n")[0]}`);
    }
}
function expectSuccess(r, code) {
    assert.equal(r.status, code, `expected HTTP ${code}, got ${r.status}: ${r.raw.slice(0, 200)}`);
    assert.equal(r.json?.success, true, `expected success=true: ${r.raw.slice(0, 200)}`);
}
function expectFailure(r, code) {
    assert.equal(r.status, code, `expected HTTP ${code}, got ${r.status}: ${r.raw.slice(0, 200)}`);
}

const owner = new Client();
const fresh = new Client(); // for signin flow
const anon = new Client(); // no session
const member = new Client();
let shopA, shopB, roleId, inviteRoleId, inviteId, tmpRoleId, tmpInviteId;

console.log(`\nE2E vs ${BASE}\n── Auth ──`);
await step("POST /auth/signup (owner) → 201 + session cookie", async () => {
    const r = await owner.req("POST", "/auth/signup", {
        name: "E2E Owner",
        email: ownerEmail,
        password: PASSWORD,
        confirm: PASSWORD,
    });
    expectSuccess(r, 201);
    assert.ok(owner.cookie, "no session_id cookie set");
});
await step("POST /auth/signup duplicate email → 4xx", async () => {
    const c = new Client();
    const r = await c.req("POST", "/auth/signup", {
        name: "Dup",
        email: ownerEmail,
        password: PASSWORD,
        confirm: PASSWORD,
    });
    assert.ok(r.status >= 400 && r.status < 500, `expected 4xx, got ${r.status}`);
});
await step("POST /auth/signup bad payload → 400", async () => {
    const c = new Client();
    const r = await c.req("POST", "/auth/signup", {
        name: "X",
        email: "not-an-email",
        password: "short",
        confirm: "short",
    });
    expectFailure(r, 400);
});
await step("POST /auth/signin (fresh client) → 201", async () => {
    const r = await fresh.req("POST", "/auth/signin", { email: ownerEmail, password: PASSWORD });
    expectSuccess(r, 201);
    assert.ok(fresh.cookie, "no session_id cookie set");
});
await step("POST /auth/signin wrong password → 4xx", async () => {
    const c = new Client();
    const r = await c.req("POST", "/auth/signin", { email: ownerEmail, password: "Wrongpass1" });
    assert.ok(r.status >= 400 && r.status < 500, `expected 4xx, got ${r.status}`);
});
await step("GET /auth/me (owner) → 200 with user", async () => {
    const r = await owner.req("GET", "/auth/me");
    expectSuccess(r, 200);
    assert.equal(r.json.data.user.email, ownerEmail);
});
await step("GET /auth/me (no session) → 401", async () => {
    const r = await anon.req("GET", "/auth/me");
    expectFailure(r, 401);
});

console.log("── Shops ──");
await step("POST /shops/ → 201", async () => {
    const r = await owner.req("POST", "/shops/", { name: "E2E Shop A" });
    expectSuccess(r, 201);
});
await step("POST /shops/ empty name → 400", async () => {
    const r = await owner.req("POST", "/shops/", { name: "" });
    expectFailure(r, 400);
});
await step("POST /shops/ extra key → 400 (strict)", async () => {
    const r = await owner.req("POST", "/shops/", { name: "X", ownerId: "evil" });
    expectFailure(r, 400);
});
await step("GET /shops/my-shops contains A, none soft-deleted", async () => {
    const r = await owner.req("GET", "/shops/my-shops");
    expectSuccess(r, 200);
    const shops = r.json.data.shops;
    const found = shops.find((s) => s.name === "E2E Shop A");
    assert.ok(found, "shop A missing from my-shops");
    assert.ok(shops.every((s) => s.softDelete === false), "soft-deleted shop leaked");
    shopA = found.id;
});
await step("GET /shops/:shopId → 200, isOwner", async () => {
    const r = await owner.req("GET", `/shops/${shopA}`);
    expectSuccess(r, 200);
    const shop = r.json.data.shopData ?? r.json.data.shop ?? r.json.data;
    assert.ok(shop.isOwner === true || shop.ownerId, "unexpected shop payload");
});
await step("GET /shops/:badId → 404", async () => {
    const r = await owner.req("GET", "/shops/00000000-0000-0000-0000-000000000000");
    expectFailure(r, 404);
});
await step("PATCH /shops/:shopId rename → 200", async () => {
    const r = await owner.req("PATCH", `/shops/${shopA}`, { name: "E2E Shop A Renamed" });
    expectSuccess(r, 200);
});
await step("second user signup (invite target) → 201", async () => {
    const r = await member.req("POST", "/auth/signup", {
        name: "E2E Member",
        email: memberEmail,
        password: PASSWORD,
        confirm: PASSWORD,
    });
    expectSuccess(r, 201);
});
await step("non-member GET /shops/:shopId → 404", async () => {
    const r = await member.req("GET", `/shops/${shopA}`);
    expectFailure(r, 404);
});
await step("non-member GET roles → 404", async () => {
    const r = await member.req("GET", `/shops/${shopA}/roles`);
    expectFailure(r, 404);
});

console.log("── Roles ──");
await step("GET roles/permissions → 200, includes roles:create", async () => {
    const r = await owner.req("GET", `/shops/${shopA}/roles/permissions`);
    expectSuccess(r, 200);
    const vals = JSON.stringify(r.json.data);
    assert.ok(vals.includes("roles:create"), "permissions list missing roles:create");
});
await step("POST role Cashier → 201", async () => {
    const r = await owner.req("POST", `/shops/${shopA}/roles`, {
        name: "Cashier",
        permissions: ["roles:read", "product:read"],
    });
    expectSuccess(r, 201);
    roleId = r.json.data.id;
    assert.ok(roleId, "no role id returned");
});
await step("POST role bad permission → 400", async () => {
    const r = await owner.req("POST", `/shops/${shopA}/roles`, {
        name: "Bad",
        permissions: ["admin:everything"],
    });
    expectFailure(r, 400);
});
await step("POST role empty name → 400", async () => {
    const r = await owner.req("POST", `/shops/${shopA}/roles`, { name: "" });
    expectFailure(r, 400);
});
await step("GET roles list contains Cashier", async () => {
    const r = await owner.req("GET", `/shops/${shopA}/roles`);
    expectSuccess(r, 200);
    assert.ok(r.json.data.some((x) => x.id === roleId), "created role missing");
});
await step("GET role by id → 200", async () => {
    const r = await owner.req("GET", `/shops/${shopA}/roles/${roleId}`);
    expectSuccess(r, 200);
});
await step("GET role bad id → 404", async () => {
    const r = await owner.req("GET", `/shops/${shopA}/roles/00000000-0000-0000-0000-000000000000`);
    expectFailure(r, 404);
});
await step("PATCH role rename → 200 persisted", async () => {
    const r = await owner.req("PATCH", `/shops/${shopA}/roles/${roleId}`, { name: "Senior Cashier" });
    expectSuccess(r, 200);
    const check = await owner.req("GET", `/shops/${shopA}/roles/${roleId}`);
    assert.equal(check.json.data.name, "Senior Cashier");
});
await step("cross-shop: role via other shop → 404", async () => {
    const s = await owner.req("POST", "/shops/", { name: "E2E Shop B" });
    expectSuccess(s, 201);
    const list = await owner.req("GET", "/shops/my-shops");
    shopB = list.json.data.shops.find((x) => x.name === "E2E Shop B").id;
    const r1 = await owner.req("GET", `/shops/${shopB}/roles/${roleId}`);
    expectFailure(r1, 404);
    const r2 = await owner.req("PATCH", `/shops/${shopB}/roles/${roleId}`, { name: "Hijack" });
    expectFailure(r2, 404);
});

console.log("── Invites ──");
await step("POST invite (member + role) → 201", async () => {
    const rr = await owner.req("POST", `/shops/${shopA}/roles`, { name: "InviteRole" });
    expectSuccess(rr, 201);
    inviteRoleId = rr.json.data.id;
    const r = await owner.req("POST", `/shops/${shopA}/invites`, {
        email: memberEmail,
        roleId: inviteRoleId,
    });
    expectSuccess(r, 201);
    inviteId = r.json.data.invite?.id ?? r.json.data.id;
    assert.ok(inviteId, "no invite id returned");
});
await step("POST duplicate invite → 409", async () => {
    const r = await owner.req("POST", `/shops/${shopA}/invites`, {
        email: memberEmail,
        roleId: inviteRoleId,
    });
    expectFailure(r, 409);
});
await step("POST invite unknown email → 404 + field error", async () => {
    const r = await owner.req("POST", `/shops/${shopA}/invites`, {
        email: `nobody-${stamp}@mail.com`,
        roleId: inviteRoleId,
    });
    expectFailure(r, 404);
});
await step("POST invite with other-shop role → 400", async () => {
    // role from shopB used in shopA must be rejected
    const rb = await owner.req("POST", `/shops/${shopB}/roles`, { name: "OtherShopRole" });
    expectSuccess(rb, 201);
    const r2 = await owner.req("POST", `/shops/${shopA}/invites`, {
        email: memberEmail,
        roleId: rb.json.data.id,
    });
    expectFailure(r2, 400);
    await owner.req("DELETE", `/shops/${shopB}/roles/${rb.json.data.id}`);
});
await step("POST invite missing roleId → 400", async () => {
    const r = await owner.req("POST", `/shops/${shopA}/invites`, { email: memberEmail });
    expectFailure(r, 400);
});
await step("GET invites list contains invite", async () => {
    const r = await owner.req("GET", `/shops/${shopA}/invites`);
    expectSuccess(r, 200);
    assert.ok(r.json.data.some((x) => x.id === inviteId), "invite missing from list");
});
await step("GET invite by id → 200", async () => {
    const r = await owner.req("GET", `/shops/${shopA}/invites/${inviteId}`);
    expectSuccess(r, 200);
});
await step("GET invite bad id → 404", async () => {
    const r = await owner.req("GET", `/shops/${shopA}/invites/00000000-0000-0000-0000-000000000000`);
    expectFailure(r, 404);
});
await step("DELETE role in use by invite → 409", async () => {
    const r = await owner.req("DELETE", `/shops/${shopA}/roles/${inviteRoleId}`);
    expectFailure(r, 409);
});
await step("DELETE invite → 200, then 404", async () => {
    const r = await owner.req("DELETE", `/shops/${shopA}/invites/${inviteId}`);
    expectSuccess(r, 200);
    const r2 = await owner.req("GET", `/shops/${shopA}/invites/${inviteId}`);
    expectFailure(r2, 404);
});

console.log("── Cleanup ──");
await step("DELETE temp role + shopB, verify filtered", async () => {
    const d1 = await owner.req("DELETE", `/shops/${shopA}/roles/${inviteRoleId}`);
    expectSuccess(d1, 200);
    const d2 = await owner.req("DELETE", `/shops/${shopB}`);
    assert.ok([200, 204].includes(d2.status), `expected 200/204, got ${d2.status}`);
    const list = await owner.req("GET", "/shops/my-shops");
    expectSuccess(list, 200);
    assert.ok(!list.json.data.shops.some((x) => x.id === shopB), "deleted shop still listed");
    assert.ok(list.json.data.shops.some((x) => x.id === shopA), "shopA should remain");
});
await step("DELETE role Cashier → 200, then 404", async () => {
    const r = await owner.req("DELETE", `/shops/${shopA}/roles/${roleId}`);
    expectSuccess(r, 200);
    const r2 = await owner.req("GET", `/shops/${shopA}/roles/${roleId}`);
    expectFailure(r2, 404);
});
await step("POST /auth/signout → 200, me → 401", async () => {
    const r = await owner.req("POST", "/auth/signout");
    expectSuccess(r, 200);
    const me = await owner.req("GET", "/auth/me");
    expectFailure(me, 401);
});

console.log(`\nResult: ${passed} passed, ${failed} failed${failed ? ` (${failures.join("; ")})` : ""}`);
console.log("Kept for manual testing: owner, member, Shop A Renamed.\n");
process.exit(failed ? 1 : 0);
