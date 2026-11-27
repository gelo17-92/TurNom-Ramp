# Firestore Security Specifications (Phase 0)

This document outlines the security specifications, data invariants, and potential attack payloads for the application, verifying that the rules prevent unauthorized access.

## Data Invariants
1. **User Segregation**: A user (identified by custom UID) can only read or write their own configuration, shifts, levels, and pluses under `/users/{userId}/`.
2. **Path Integrity**: Path document IDs must match valid schema-defined patterns (e.g., date formats, integer numbers) and prevent overflow values.
3. **Immutability of Key Metadata**: Fields such as `userId` or specific metadata keys cannot be morphed inside user subcollections.
4. **Valid Schema Constraints**: No extraneous fields can be injected during create/update operations.

## The "Dirty Dozen" Malicious Payloads (The Red Team Vectors)

### Payload 1: Accessing Sibling Data
An attacker (authenticated as `user_abc`) attempts to read or write config at `/users/user_xyz/config/settings`.
- **Expected result**: `PERMISSION_DENIED`

### Payload 2: Overwriting App role
An attacker is logged in as a standard user (`user_abc`) and attempts to update their own role/privileges to `admin` directly at `/users/user_abc` with `{ role: 'admin' }`.
- **Expected result**: `PERMISSION_DENIED`

### Payload 3: Injecting Arbitrary Key (Shadow Update)
An attacker attempts to insert a "Ghost Field" (such as `isSubrogadoOverride: true` or `vip: true`) in `/users/user_abc/config/settings`.
- **Expected result**: `PERMISSION_DENIED`

### Payload 4: Overwriting Seniority Date Type
An attacker attempts to write standard settings but provides a boolean or integer for `seniorityDate` (e.g., `12345` instead of `"2026-05-30"`).
- **Expected result**: `PERMISSION_DENIED`

### Payload 5: Denying Wallet (Massive Shift Date)
An attacker tries to store a shift with a 1MB string value as document ID (e.g., massive padding of noise) instead of standard date representation like `"2026-05-30"`.
- **Expected result**: `PERMISSION_DENIED`

### Payload 6: Spoofing Verification
An attacker sends a write payload with an unverified email token claiming admin access.
- **Expected result**: `PERMISSION_DENIED`

### Payload 7: Array Exploit in Settings
An attacker attempts to pass an unchecked object/dictionary value into a list-type field (e.g., `holidays: { arbitraryKey: "arbitraryValue" }`).
- **Expected result**: `PERMISSION_DENIED`

### Payload 8: Negative Number Spoofing
An attacker writes levels under `/users/user_abc/levels/1` with a base salary `anual: -1000`.
- **Expected result**: `PERMISSION_DENIED`

### Payload 9: Invalid Shift Type Injection
An attacker inserts a shift with state `type: "FiestaLoca"` (invalid shift type enum).
- **Expected result**: `PERMISSION_DENIED`

### Payload 10: Modifying Terminated Months
An attacker modifies vacation shifts for times registered as locked/frozen.
- **Expected result**: `PERMISSION_DENIED`

### Payload 11: Bypassing List Queries (Query Scraping)
An attacker attempts to query the collection `/users/user_xyz/shifts` using list without filters.
- **Expected result**: `PERMISSION_DENIED`

### Payload 12: Invalid Plus Format
An attacker sets `pagas: 99` inside a entry for user pluses.
- **Expected result**: `PERMISSION_DENIED`
