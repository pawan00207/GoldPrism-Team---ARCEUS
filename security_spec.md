# GoldPrism Firestore Security Specification (Phase 0 TDD)

## 1. Data Invariants
1. **Owner-Only Isolation**: Every workspace, private PII doc, paper trade, and copilot log belongs strictly to one authenticated Google user (`request.auth.uid == userId && request.auth.token.email_verified == true`).
2. **PII Split Isolation**: User `email` and `photoURL` live in `/users/{userId}/private/info`, isolated from workspace margin state, readable/writable only by the verified owner.
3. **Immutable Audit Ownership & Terminal Closing**: `ownerId` and `createdAt` cannot be modified after creation. Once a `UserPaperTrade` transitions from `OPEN` to `CLOSED`, its outcome fields (`netPnlInr`, `exitPriceA`, `closedAt`, `status`) are terminally locked.
4. **Server Temporal Integrity**: `createdAt` and `updatedAt` must equal `request.time` via `serverTimestamp()`.
5. **Bounded Payload & Path ID Hardening**: All path IDs match `^[a-zA-Z0-9_\\-]+$` (`<= 128` chars), and every string/number conforms strictly to `firebase-blueprint.json`.

## 2. Adversarial "Dirty Dozen" Payloads (Expected: PERMISSION_DENIED)
1. **Unauthenticated read/write** to `/users/uid1/trades/t1` (`request.auth == null`).
2. **Unverified email write** (`request.auth.token.email_verified == false`) on `/users/uid1`.
3. **Cross-user spoofing**: User `uid2` attempts `create` or `get` on `/users/uid1/trades/t1`.
4. **OwnerId mismatch on create**: `uid1` sets `ownerId: "uid2"` in `/users/uid1/trades/t1`.
5. **Shadow / Ghost field injection**: Adding `isAdmin: true` or `unlimitedMargin: true` on `/users/uid1`.
6. **Client-forged timestamp**: Sending an arbitrary past `createdAt` instead of `request.time`.
7. **Terminal state bypass**: Attempting to mutate a `CLOSED` trade back to `OPEN` or rewrite `netPnlInr`.
8. **Immutable ownerId mutation**: Updating `ownerId` on an existing trade document.
9. **Path ID poisoning**: Sending a 1,500-character or slash-containing `tradeId`.
10. **Payload string overflow**: Sending a `headline` > 160 chars or `rationale` > 600 chars.
11. **Invalid enum value**: Creating a trade with `contractA: "FAKEGOLD"` or `side: "SHORT_ALL"`.
12. **Blanket collection list scraping**: Attempting to list `/users` across accounts (`allow list: if false` at root `/users`).
