# AdeegoPOS Modular Access Architecture

AdeegoPOS authorization is defined by `lib/modules.js` and enforced through `lib/rbac.js`. The same registry drives the sidebar, home workspace, page-route checks, component capability checks, and Electron IPC operation checks.

## Modules and levels

The eight module IDs are `pos`, `customers`, `inventory`, `suppliers`, `bookkeeping`, `reports`, `staff_admin`, and `adeego_plus`.

Access levels are ordered `none < view < operate < manage`. Staff documents with `accessVersion: 2` use `moduleAccess` as the authorization source of truth. `role` and `roles` remain compatibility/display fields only.

Owners always receive the highest valid level for every module. Delegated managers may receive Staff/Admin Operate and manage non-owner staff, but only the owner may delegate Staff/Admin access or change protected store settings.

## Authorization flow

1. Local or online credentials are verified inside Electron.
2. Electron stores only the verified staff ID and store number in its in-memory session.
3. Each protected operation reloads the active staff document before evaluating its module requirement.
4. Unknown routes and operations fail closed.
5. Module changes create an `accessAudit` document with actor, target, before/after grants, store, and timestamp.

Embedded lookup dependencies allow a workflow to reference another module's records without showing that module in navigation or granting its mutation operations.

## Migration

Migration is idempotent and runs during sign-in, session establishment, and staff listing. The oldest active legacy Admin becomes the sole protected owner. Other roles map through built-in presets, and multi-role accounts receive the highest level from the union of those presets. Migrated assignments are marked `accessReviewRequired` until an authorized administrator reviews and saves them.
