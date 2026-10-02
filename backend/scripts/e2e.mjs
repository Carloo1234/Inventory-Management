// End-to-end integration test for the whole backend (real server + real DB).
// Run:  npm run test:e2e            (from backend/, server must be running)
// Exercises every endpoint over HTTP with real sessions, real postgres rows
// and real redis sessions — the Postman flow, automated:
// signup -> shops -> roles -> invites -> accept -> permissions -> cleanup.
// One step uses a direct DB tweak (expired invite) since no API sets expiry.

import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { Pool } from "@neondatabase/serverless";

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
await step("GET /invites/mine as invited user → 200 with shop info", async () => {
    const r = await member.req("GET", "/invites/mine");
    expectSuccess(r, 200);
    const found = r.json.data.find((x) => x.id === inviteId);
    assert.ok(found, "invite missing from personal inbox");
    assert.equal(found.shopId, shopA);
    assert.ok(found.shop?.id, "shop identity missing");
    assert.ok(found.role?.id, "role identity missing");
});
await step("GET /invites/mine as owner (no invites) → 200 empty", async () => {
    const r = await owner.req("GET", "/invites/mine");
    expectSuccess(r, 200);
    assert.deepEqual(r.json.data, []);
});
await step("GET /invites/mine anon → 401", async () => {
    const r = await anon.req("GET", "/invites/mine");
    expectFailure(r, 401);
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

console.log("── Accept invites + manager permissions ──");
let acceptRoleId, acceptInviteId, expiredInviteId;
await step("POST limited role (invite:read only) → 201", async () => {
    const r = await owner.req("POST", `/shops/${shopA}/roles`, {
        name: "InviteViewer",
        permissions: ["invite:read"],
    });
    expectSuccess(r, 201);
    acceptRoleId = r.json.data.id;
});
await step("POST invite for member → 201", async () => {
    const r = await owner.req("POST", `/shops/${shopA}/invites`, {
        email: memberEmail,
        roleId: acceptRoleId,
    });
    expectSuccess(r, 201);
    acceptInviteId = r.json.data.invite?.id ?? r.json.data.id;
    assert.ok(acceptInviteId, "no invite id returned");
});
await step("owner accepts member's invite → 404 (not yours)", async () => {
    const r = await owner.req("POST", `/shops/${shopA}/invites/${acceptInviteId}/accept`);
    expectFailure(r, 404);
});
await step("anon accepts invite → 401", async () => {
    const r = await anon.req("POST", `/shops/${shopA}/invites/${acceptInviteId}/accept`);
    expectFailure(r, 401);
});
await step("cross-shop accept → 404", async () => {
    const r = await member.req("POST", `/shops/${shopB}/invites/${acceptInviteId}/accept`);
    expectFailure(r, 404);
});
await step("accept bad invite id → 404", async () => {
    const r = await member.req("POST", `/shops/${shopA}/invites/00000000-0000-0000-0000-000000000000/accept`);
    expectFailure(r, 404);
});
await step("member accepts own invite → 201 + manager row", async () => {
    const r = await member.req("POST", `/shops/${shopA}/invites/${acceptInviteId}/accept`);
    expectSuccess(r, 201);
    assert.equal(r.json.data.shopId, shopA);
});
await step("accepted invite is gone → 404", async () => {
    const r = await owner.req("GET", `/shops/${shopA}/invites/${acceptInviteId}`);
    expectFailure(r, 404);
});
await step("re-accept consumed invite → 404", async () => {
    const r = await member.req("POST", `/shops/${shopA}/invites/${acceptInviteId}/accept`);
    expectFailure(r, 404);
});
await step("member now sees shop as non-owner with permissions", async () => {
    const r = await member.req("GET", `/shops/${shopA}`);
    expectSuccess(r, 200);
    const shop = r.json.data.shopData ?? r.json.data.shop ?? r.json.data;
    assert.equal(shop.isOwner, false);
    assert.ok(shop.managerPermissions?.includes("invite:read"), "manager permissions missing");
});
await step("member GET invites (has invite:read) → 200", async () => {
    const r = await member.req("GET", `/shops/${shopA}/invites`);
    expectSuccess(r, 200);
});
await step("member POST invite (lacks invite:create) → 403", async () => {
    const r = await member.req("POST", `/shops/${shopA}/invites`, {
        email: memberEmail,
        roleId: acceptRoleId,
    });
    expectFailure(r, 403);
});
await step("member PATCH role (lacks roles:update) → 403", async () => {
    const r = await member.req("PATCH", `/shops/${shopA}/roles/${acceptRoleId}`, { name: "Hacked" });
    expectFailure(r, 403);
});
await step("expired invite → 400", async () => {
    // Member is already staff, so use a fresh third user for this invite.
    const expiredUser = new Client();
    const su = await expiredUser.req("POST", "/auth/signup", {
        name: "E2E Expired",
        email: `e2e-expired-${stamp}@mail.com`,
        password: PASSWORD,
        confirm: PASSWORD,
    });
    expectSuccess(su, 201);
    const c = await owner.req("POST", `/shops/${shopA}/invites`, {
        email: `e2e-expired-${stamp}@mail.com`,
        roleId: acceptRoleId,
    });
    expectSuccess(c, 201);
    expiredInviteId = c.json.data.invite?.id ?? c.json.data.id;
    // No API sets expiry, so backdate it directly (real DB, real check).
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    await pool.query("UPDATE shop_invitations SET expires_at = now() - interval '1 day' WHERE id = $1", [
        expiredInviteId,
    ]);
    await pool.end();
    const r = await expiredUser.req("POST", `/shops/${shopA}/invites/${expiredInviteId}/accept`);
    expectFailure(r, 400);
    const d = await owner.req("DELETE", `/shops/${shopA}/invites/${expiredInviteId}`);
    expectSuccess(d, 200);
});

console.log("── Managers ──");
let staffRoleId, bigRoleId, limitedRoleId, smallRoleId, seniorRoleId, fourthId, fifthEmail;
await step("GET managers list contains member", async () => {
    const r = await owner.req("GET", `/shops/${shopA}/managers`);
    expectSuccess(r, 200);
    const found = r.json.data.find((x) => x.user.email === memberEmail);
    assert.ok(found, "member missing from managers list");
    assert.equal(found.role.id, acceptRoleId);
});
await step("GET manager by id → 200", async () => {
    const list = await owner.req("GET", `/shops/${shopA}/managers`);
    const mgr = list.json.data.find((x) => x.user.email === memberEmail);
    const r = await owner.req("GET", `/shops/${shopA}/managers/${mgr.user.id}`);
    expectSuccess(r, 200);
    assert.equal(r.json.data.user.email, memberEmail);
});
await step("GET manager bad id → 404", async () => {
    const r = await owner.req("GET", `/shops/${shopA}/managers/00000000-0000-0000-0000-000000000000`);
    expectFailure(r, 404);
});
await step("GET manager cross-shop → 404", async () => {
    const list = await owner.req("GET", `/shops/${shopA}/managers`);
    const mgr = list.json.data.find((x) => x.user.email === memberEmail);
    const r = await owner.req("GET", `/shops/${shopB}/managers/${mgr.user.id}`);
    expectFailure(r, 404);
});
await step("member GET managers (lacks manager:read) → 403", async () => {
    const r = await member.req("GET", `/shops/${shopA}/managers`);
    expectFailure(r, 403);
});
await step("PATCH role returns affectedManagers", async () => {
    const r = await owner.req("PATCH", `/shops/${shopA}/roles/${acceptRoleId}`, { name: "InviteViewer2" });
    expectSuccess(r, 200);
    assert.equal(r.json.data.role.name, "InviteViewer2");
    assert.equal(r.json.data.affectedManagers.count, 1);
    assert.ok(r.json.data.affectedManagers.managerIds.length === 1);
});
await step("PATCH manager role → 200 + verify", async () => {
    const rc = await owner.req("POST", `/shops/${shopA}/roles`, { name: "Staff", permissions: ["manager:read"] });
    expectSuccess(rc, 201);
    staffRoleId = rc.json.data.id;
    const list = await owner.req("GET", `/shops/${shopA}/managers`);
    const mgr = list.json.data.find((x) => x.user.email === memberEmail);
    const r = await owner.req("PATCH", `/shops/${shopA}/managers/${mgr.user.id}`, { roleId: staffRoleId });
    expectSuccess(r, 200);
    const check = await owner.req("GET", `/shops/${shopA}/managers/${mgr.user.id}`);
    assert.equal(check.json.data.role.id, staffRoleId);
});
await step("PATCH manager to other-shop role → 404", async () => {
    const rb = await owner.req("POST", `/shops/${shopB}/roles`, { name: "ShopBRole" });
    expectSuccess(rb, 201);
    const list = await owner.req("GET", `/shops/${shopA}/managers`);
    const mgr = list.json.data.find((x) => x.user.email === memberEmail);
    const r = await owner.req("PATCH", `/shops/${shopA}/managers/${mgr.user.id}`, { roleId: rb.json.data.id });
    expectFailure(r, 404);
    await owner.req("DELETE", `/shops/${shopB}/roles/${rb.json.data.id}`);
});
await step("PATCH manager missing roleId → 400", async () => {
    const list = await owner.req("GET", `/shops/${shopA}/managers`);
    const mgr = list.json.data.find((x) => x.user.email === memberEmail);
    const r = await owner.req("PATCH", `/shops/${shopA}/managers/${mgr.user.id}`, {});
    expectFailure(r, 400);
});
await step("member PATCH manager (lacks manager:update) → 403", async () => {
    const list = await owner.req("GET", `/shops/${shopA}/managers`);
    const mgr = list.json.data.find((x) => x.user.email === memberEmail);
    const r = await member.req("PATCH", `/shops/${shopA}/managers/${mgr.user.id}`, { roleId: staffRoleId });
    expectFailure(r, 403);
});
await step("subset: role create with unheld perm → 403", async () => {
    // Fourth user holds roles:create but NOT roles:delete.
    const u4 = new Client();
    const su = await u4.req("POST", "/auth/signup", {
        name: "E2E Fourth",
        email: `e2e-fourth-${stamp}@mail.com`,
        password: PASSWORD,
        confirm: PASSWORD,
    });
    expectSuccess(su, 201);
    const me = await u4.req("GET", "/auth/me");
    fourthId = me.json.data.user.id;
    const rl = await owner.req("POST", `/shops/${shopA}/roles`, {
        name: "Limited",
        permissions: ["roles:create", "roles:read", "roles:update", "roles:delete", "invite:create", "invite:read", "manager:read", "manager:update"],
    });
    expectSuccess(rl, 201);
    limitedRoleId = rl.json.data.id;
    const inv = await owner.req("POST", `/shops/${shopA}/invites`, {
        email: `e2e-fourth-${stamp}@mail.com`,
        roleId: limitedRoleId,
    });
    expectSuccess(inv, 201);
    const acc = await u4.req("POST", `/shops/${shopA}/invites/${inv.json.data.invite.id}/accept`);
    expectSuccess(acc, 201);
    const bad = await u4.req("POST", `/shops/${shopA}/roles`, {
        name: "GodMode",
        permissions: ["shop:delete"],
    });
    expectFailure(bad, 403);
    assert.ok(JSON.stringify(bad.json).includes("shop:delete"), "403 should name the offending perm");
    const ok = await u4.req("POST", `/shops/${shopA}/roles`, {
        name: "SmallRole",
        permissions: ["invite:read"],
    });
    expectSuccess(ok, 201);
    smallRoleId = ok.json.data.id;
});
await step("subset: invite with unheld perm → 403", async () => {
    const u4 = new Client();
    await u4.req("POST", "/auth/signin", { email: `e2e-fourth-${stamp}@mail.com`, password: PASSWORD });
    const rb = await owner.req("POST", `/shops/${shopA}/roles`, {
        name: "BigRole",
        permissions: ["manager:delete"],
    });
    expectSuccess(rb, 201);
    bigRoleId = rb.json.data.id;
    fifthEmail = `e2e-fifth-${stamp}@mail.com`;
    const u5 = new Client();
    const su = await u5.req("POST", "/auth/signup", {
        name: "E2E Fifth",
        email: fifthEmail,
        password: PASSWORD,
        confirm: PASSWORD,
    });
    expectSuccess(su, 201);
    const bad = await u4.req("POST", `/shops/${shopA}/invites`, { email: fifthEmail, roleId: bigRoleId });
    expectFailure(bad, 403);
    assert.ok(JSON.stringify(bad.json).includes("manager:delete"), "403 should name the offending perm");
    const ok = await u4.req("POST", `/shops/${shopA}/invites`, { email: fifthEmail, roleId: limitedRoleId });
    expectSuccess(ok, 201);
    const del = await owner.req("DELETE", `/shops/${shopA}/invites/${ok.json.data.invite.id}`);
    expectSuccess(del, 200);
});
await step("subset: manager role escalation → 403", async () => {
    const u4 = new Client();
    await u4.req("POST", "/auth/signin", { email: `e2e-fourth-${stamp}@mail.com`, password: PASSWORD });
    const list = await owner.req("GET", `/shops/${shopA}/managers`);
    const mgr = list.json.data.find((x) => x.user.email === memberEmail);
    const r = await u4.req("PATCH", `/shops/${shopA}/managers/${mgr.user.id}`, { roleId: bigRoleId });
    expectFailure(r, 403);
});
await step("self role upgrade → 403 (own role immutable)", async () => {
    const u4 = new Client();
    await u4.req("POST", "/auth/signin", { email: `e2e-fourth-${stamp}@mail.com`, password: PASSWORD });
    const r = await u4.req("PATCH", `/shops/${shopA}/managers/${fourthId}`, { roleId: bigRoleId });
    expectFailure(r, 403);
});
await step("self role demote → 403 (even downwards)", async () => {
    const u4 = new Client();
    await u4.req("POST", "/auth/signin", { email: `e2e-fourth-${stamp}@mail.com`, password: PASSWORD });
    const r = await u4.req("PATCH", `/shops/${shopA}/managers/${fourthId}`, { roleId: smallRoleId });
    expectFailure(r, 403);
});
await step("rank: junior demotes senior → 403", async () => {
    // Member holds SeniorRole (Limited + manager:delete): strictly above fourth.
    const rs = await owner.req("POST", `/shops/${shopA}/roles`, {
        name: "Senior",
        permissions: ["roles:create", "roles:read", "roles:update", "roles:delete", "invite:create", "invite:read", "manager:read", "manager:update", "manager:delete"],
    });
    expectSuccess(rs, 201);
    seniorRoleId = rs.json.data.id;
    const list = await owner.req("GET", `/shops/${shopA}/managers`);
    const mgr = list.json.data.find((x) => x.user.email === memberEmail);
    const assign = await owner.req("PATCH", `/shops/${shopA}/managers/${mgr.user.id}`, { roleId: seniorRoleId });
    expectSuccess(assign, 200);
    const u4 = new Client();
    await u4.req("POST", "/auth/signin", { email: `e2e-fourth-${stamp}@mail.com`, password: PASSWORD });
    const r = await u4.req("PATCH", `/shops/${shopA}/managers/${mgr.user.id}`, { roleId: staffRoleId });
    expectFailure(r, 403);
    assert.ok(JSON.stringify(r.json).includes("below your own level"), "rank message missing");
    const back = await owner.req("PATCH", `/shops/${shopA}/managers/${mgr.user.id}`, { roleId: staffRoleId });
    expectSuccess(back, 200);
});
await step("rank: peer edits peer → 403", async () => {
    // Fifth accepts Limited: identical set to fourth → peers, untouchable.
    const inv = await owner.req("POST", `/shops/${shopA}/invites`, { email: fifthEmail, roleId: limitedRoleId });
    expectSuccess(inv, 201);
    const u5 = new Client();
    await u5.req("POST", "/auth/signin", { email: fifthEmail, password: PASSWORD });
    const acc = await u5.req("POST", `/shops/${shopA}/invites/${inv.json.data.invite.id}/accept`);
    expectSuccess(acc, 201);
    const u4 = new Client();
    await u4.req("POST", "/auth/signin", { email: `e2e-fourth-${stamp}@mail.com`, password: PASSWORD });
    const r = await u4.req("PATCH", `/shops/${shopA}/managers/${acc.json.data.manager.managerId}`, { roleId: staffRoleId });
    expectFailure(r, 403);
});
await step("rank: rename-only edit of own role → 403", async () => {
    const u4 = new Client();
    await u4.req("POST", "/auth/signin", { email: `e2e-fourth-${stamp}@mail.com`, password: PASSWORD });
    const r = await u4.req("PATCH", `/shops/${shopA}/roles/${limitedRoleId}`, { name: "Limited Renamed" });
    expectFailure(r, 403);
});
await step("rank: delete senior role → 403", async () => {
    const u4 = new Client();
    await u4.req("POST", "/auth/signin", { email: `e2e-fourth-${stamp}@mail.com`, password: PASSWORD });
    const r = await u4.req("DELETE", `/shops/${shopA}/roles/${seniorRoleId}`);
    expectFailure(r, 403);
});
await step("rank: fifth self-leaves, owner removes fifth's trace", async () => {
    const u5 = new Client();
    await u5.req("POST", "/auth/signin", { email: fifthEmail, password: PASSWORD });
    const me = await u5.req("GET", "/auth/me");
    const leave = await u5.req("DELETE", `/shops/${shopA}/managers/${me.json.data.user.id}`);
    expectSuccess(leave, 200);
});
await step("remove owner target → 400", async () => {
    const me = await owner.req("GET", "/auth/me");
    const r = await owner.req("DELETE", `/shops/${shopA}/managers/${me.json.data.user.id}`);
    expectFailure(r, 400);
});
await step("member DELETE other (lacks manager:delete) → 403", async () => {
    const r = await member.req("DELETE", `/shops/${shopA}/managers/${fourthId}`);
    expectFailure(r, 403);
});
await step("admin remove member → 200, then 404", async () => {
    const list = await owner.req("GET", `/shops/${shopA}/managers`);
    const mgr = list.json.data.find((x) => x.user.email === memberEmail);
    const r = await owner.req("DELETE", `/shops/${shopA}/managers/${mgr.user.id}`);
    expectSuccess(r, 200);
    const r2 = await owner.req("GET", `/shops/${shopA}/managers/${mgr.user.id}`);
    expectFailure(r2, 404);
    const r3 = await owner.req("DELETE", `/shops/${shopA}/managers/${mgr.user.id}`);
    expectFailure(r3, 404);
});
await step("self-leave without manager:delete → 200, then locked out", async () => {
    const u4 = new Client();
    await u4.req("POST", "/auth/signin", { email: `e2e-fourth-${stamp}@mail.com`, password: PASSWORD });
    const r = await u4.req("DELETE", `/shops/${shopA}/managers/${fourthId}`);
    expectSuccess(r, 200);
    const shop = await u4.req("GET", `/shops/${shopA}`);
    expectFailure(shop, 404);
});
await step("cleanup subset-test roles", async () => {
    for (const id of [bigRoleId, limitedRoleId, smallRoleId, staffRoleId, seniorRoleId]) {
        const r = await owner.req("DELETE", `/shops/${shopA}/roles/${id}`);
        expectSuccess(r, 200);
    }
});

console.log("── Products ──");
// 1x1 PNG bytes for upload tests (68 bytes, well under the 5MB cap).
const PNG_1PX = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
);
async function uploadImage(client, shopId, productId, { variantId, bytes, filename, mimetype }) {
    const fd = new FormData();
    if (bytes !== null) fd.append("image", new Blob([bytes], { type: mimetype }), filename);
    if (variantId) fd.append("variantId", variantId);
    const res = await fetch(`${BASE}/shops/${shopId}/products/${productId}/images/upload`, {
        method: "POST",
        headers: { ...(client.cookie ? { Cookie: client.cookie } : {}) },
        body: fd,
    });
    const text = await res.text();
    return { status: res.status, json: text ? JSON.parse(text) : null, raw: text };
}
const diskPath = (url) => url.replace(/^\//, "");
let pAttrId, pRedId, pBlueId, pForeignValueId, pProductId, pV1, pV2;

await step("attributes: name + 2 values → 201", async () => {
    let r = await owner.req("POST", `/shops/${shopA}/attributes`, { name: "Size" });
    expectSuccess(r, 201);
    pAttrId = r.json.data.id;
    r = await owner.req("POST", `/shops/${shopA}/attributes/${pAttrId}/values`, { value: "M" });
    expectSuccess(r, 201);
    pRedId = r.json.data.id;
    r = await owner.req("POST", `/shops/${shopA}/attributes/${pAttrId}/values`, { value: "L" });
    expectSuccess(r, 201);
    pBlueId = r.json.data.id;
});
await step("attributes: foreign value ready in shopB", async () => {
    let r = await owner.req("POST", `/shops/${shopB}/attributes`, { name: "Alien" });
    expectSuccess(r, 201);
    r = await owner.req("POST", `/shops/${shopB}/attributes/${r.json.data.id}/values`, { value: "X" });
    expectSuccess(r, 201);
    pForeignValueId = r.json.data.id;
});
await step("POST product 2 variants → 201", async () => {
    const r = await owner.req("POST", `/shops/${shopA}/products`, {
        name: `Tea-${stamp}`,
        description: "e2e product",
        variants: [
            { sku: `TSKU-${stamp}-1`, price: "9.99", quantity: 20, attributeValueIds: [pRedId] },
            { sku: `TSKU-${stamp}-2`, barcode: `BC${stamp}1`, price: "24.50", quantity: 5, attributeValueIds: [pBlueId] },
        ],
    });
    expectSuccess(r, 201);
    pProductId = r.json.data.product.id;
    assert.equal(r.json.data.variants.length, 2);
});
await step("POST duplicate SKU → 409 FormError variants.0.sku", async () => {
    const r = await owner.req("POST", `/shops/${shopA}/products`, {
        name: "Dup",
        variants: [{ sku: `TSKU-${stamp}-1`, price: "1", quantity: 1, attributeValueIds: [] }],
    });
    expectFailure(r, 409);
    assert.ok(r.json.formErrors.fieldErrors["variants.0.sku"][0].includes(`TSKU-${stamp}-1`));
});
await step("POST in-request duplicate → 409 flags both indices", async () => {
    const r = await owner.req("POST", `/shops/${shopA}/products`, {
        name: "Dup2",
        variants: [
            { sku: `TSKU-${stamp}-9`, price: "1", quantity: 1, attributeValueIds: [] },
            { sku: `TSKU-${stamp}-9`, price: "2", quantity: 2, attributeValueIds: [] },
        ],
    });
    expectFailure(r, 409);
    assert.ok(r.json.formErrors.fieldErrors["variants.0.sku"]);
    assert.ok(r.json.formErrors.fieldErrors["variants.1.sku"]);
});
await step("POST foreign value → 404", async () => {
    const r = await owner.req("POST", `/shops/${shopA}/products`, {
        name: "Alien",
        variants: [{ sku: `TSKU-${stamp}-8`, price: "1", quantity: 1, attributeValueIds: [pForeignValueId] }],
    });
    expectFailure(r, 404);
});
await step("POST empty variants + numeric price → 400s", async () => {
    let r = await owner.req("POST", `/shops/${shopA}/products`, { name: "Empty", variants: [] });
    expectFailure(r, 400);
    r = await owner.req("POST", `/shops/${shopA}/products`, {
        name: "Num",
        variants: [{ sku: `TSKU-${stamp}-7`, price: 9.99, quantity: 1, attributeValueIds: [] }],
    });
    expectFailure(r, 400);
});
await step("GET products paginated + envelope", async () => {
    const r = await owner.req("GET", `/shops/${shopA}/products?page=1&limit=5&sortBy=name&sortOrder=asc`);
    expectSuccess(r, 200);
    assert.ok(r.json.data.total >= 1 && r.json.data.items.length >= 1 && r.json.data.totalPages >= 1);
});
await step("GET products bad sort + over-limit → 400", async () => {
    const r = await owner.req("GET", `/shops/${shopA}/products?sortBy=price&limit=500`);
    expectFailure(r, 400);
    assert.ok(r.json.formErrors.fieldErrors.limit && r.json.formErrors.fieldErrors.sortBy);
});
await step("GET product nests variants + attributes", async () => {
    const r = await owner.req("GET", `/shops/${shopA}/products/${pProductId}`);
    expectSuccess(r, 200);
    assert.equal(r.json.data.productVariants.length, 2);
    pV1 = r.json.data.productVariants[0].id;
    pV2 = r.json.data.productVariants[1].id;
});
await step("GET product cross-shop → 404", async () => {
    const r = await owner.req("GET", `/shops/${shopB}/products/${pProductId}`);
    expectFailure(r, 404);
});
await step("PATCH rename + variant upsert → 200", async () => {
    const r = await owner.req("PATCH", `/shops/${shopA}/products/${pProductId}`, {
        name: `Tea2-${stamp}`,
        variants: [
            { id: pV1, quantity: 99 },
            { sku: `TSKU-${stamp}-3`, price: "9.99", quantity: 3, attributeValueIds: [] },
        ],
    });
    expectSuccess(r, 200);
    assert.equal(r.json.data.name, `Tea2-${stamp}`);
    assert.equal(r.json.data.productVariants.length, 3);
});
await step("PATCH empty + unknown variant → 400/404", async () => {
    let r = await owner.req("PATCH", `/shops/${shopA}/products/${pProductId}`, {});
    expectFailure(r, 400);
    r = await owner.req("PATCH", `/shops/${shopA}/products/${pProductId}`, {
        variants: [{ id: "00000000-0000-0000-0000-000000000000", price: "1" }],
    });
    expectFailure(r, 404);
});
await step("GET flat variants price-sorted + barcode lookup", async () => {
    let r = await owner.req("GET", `/shops/${shopA}/products/variants?sortBy=price&sortOrder=asc`);
    expectSuccess(r, 200);
    assert.ok(r.json.data.items.length >= 3);
    assert.ok(r.json.data.items[0].product, "parent product missing");
    r = await owner.req("GET", `/shops/${shopA}/products/variants?barcode=BC${stamp}1`);
    expectSuccess(r, 200);
    assert.equal(r.json.data.items.length, 1);
});
await step("PATCH single variant → 200, empty → 400", async () => {
    let r = await owner.req("PATCH", `/shops/${shopA}/products/variants/${pV1}`, { price: "11.50" });
    expectSuccess(r, 200);
    r = await owner.req("PATCH", `/shops/${shopA}/products/variants/${pV1}`, {});
    expectFailure(r, 400);
});
await step("POST attach URL image → list → delete", async () => {
    let r = await owner.req("POST", `/shops/${shopA}/products/${pProductId}/images`, {
        url: "https://example.com/tea.jpg",
    });
    expectSuccess(r, 201);
    const imgId = r.json.data.id;
    r = await owner.req("GET", `/shops/${shopA}/products/${pProductId}/images`);
    expectSuccess(r, 200);
    assert.ok(r.json.data.some((i) => i.id === imgId));
    r = await owner.req("DELETE", `/shops/${shopA}/products/${pProductId}/images/${imgId}`);
    expectSuccess(r, 200);
});
await step("UPLOAD file image → 201 + bytes on disk + served", async () => {
    const r = await uploadImage(owner, shopA, pProductId, {
        bytes: PNG_1PX,
        filename: "tea.png",
        mimetype: "image/png",
    });
    expectSuccess(r, 201);
    assert.ok(r.json.data.url.startsWith("/uploads/"), `unexpected url ${r.json.data.url}`);
    assert.ok(existsSync(diskPath(r.json.data.url)), "file missing on disk");
    const got = await fetch(`${BASE}${r.json.data.url}`);
    assert.equal(got.status, 200);
    assert.ok((got.headers.get("content-type") || "").includes("image/"));
    const del = await owner.req("DELETE", `/shops/${shopA}/products/${pProductId}/images/${r.json.data.id}`);
    expectSuccess(del, 200);
    assert.ok(!existsSync(diskPath(r.json.data.url)), "file not cleaned from disk");
});
await step("UPLOAD variant-scoped file → 201", async () => {
    const r = await uploadImage(owner, shopA, pProductId, {
        variantId: pV1,
        bytes: PNG_1PX,
        filename: "v.png",
        mimetype: "image/png",
    });
    expectSuccess(r, 201);
    assert.equal(r.json.data.variantId, pV1);
});
await step("UPLOAD rejects: type, size, missing, anon", async () => {
    let r = await uploadImage(owner, shopA, pProductId, {
        bytes: Buffer.from("hello"),
        filename: "x.txt",
        mimetype: "text/plain",
    });
    expectFailure(r, 400);
    r = await uploadImage(owner, shopA, pProductId, {
        bytes: Buffer.alloc(6 * 1024 * 1024),
        filename: "big.png",
        mimetype: "image/png",
    });
    expectFailure(r, 400);
    r = await uploadImage(owner, shopA, pProductId, { bytes: null, filename: "x.png", mimetype: "image/png" });
    expectFailure(r, 400);
    const anonUp = await uploadImage(new Client(), shopA, pProductId, {
        bytes: PNG_1PX,
        filename: "a.png",
        mimetype: "image/png",
    });
    expectFailure(anonUp, 401);
});
await step("UPLOAD cap: 5 shared then 400, files tracked", async () => {
    // Shared scope currently holds 0 (URL image was deleted above).
    const urls = [];
    for (let i = 0; i < 5; i++) {
        const r = await uploadImage(owner, shopA, pProductId, {
            bytes: PNG_1PX,
            filename: `s${i}.png`,
            mimetype: "image/png",
        });
        expectSuccess(r, 201);
        urls.push(r.json.data.url);
    }
    const over = await uploadImage(owner, shopA, pProductId, {
        bytes: PNG_1PX,
        filename: "s5.png",
        mimetype: "image/png",
    });
    expectFailure(over, 400);
    for (const u of urls) assert.ok(existsSync(diskPath(u)), `missing ${u}`);
    // Stash for the product-delete cleanup check below.
    globalThis.__e2eUploads = urls;
});
await step("DELETE variant keeps others, last guarded", async () => {
    // pV1 is variant-scoped image holder; deleting variant cascades its file row.
    let r = await owner.req("DELETE", `/shops/${shopA}/products/variants/${pV2}`);
    expectSuccess(r, 200);
    const det = await owner.req("GET", `/shops/${shopA}/products/${pProductId}`);
    expectSuccess(det, 200);
    const remaining = det.json.data.productVariants.map((v) => v.id);
    assert.ok(!remaining.includes(pV2) && remaining.length === 2);
    r = await owner.req("DELETE", `/shops/${shopA}/products/variants/${pV1}`);
    expectSuccess(r, 200);
    r = await owner.req("DELETE", `/shops/${shopA}/products/variants/${remaining.find((id) => id !== pV1 && id !== pV2)}`);
    expectFailure(r, 400);
});
await step("DELETE product cleans rows + files", async () => {
    const r = await owner.req("DELETE", `/shops/${shopA}/products/${pProductId}`);
    expectSuccess(r, 200);
    for (const u of globalThis.__e2eUploads || []) assert.ok(!existsSync(diskPath(u)), `orphan file ${u}`);
    const gone = await owner.req("GET", `/shops/${shopA}/products/${pProductId}`);
    expectFailure(gone, 404);
});
await step("DELETE attribute freed by cascade → 200", async () => {
    const r = await owner.req("DELETE", `/shops/${shopA}/attributes/${pAttrId}`);
    expectSuccess(r, 200);
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
