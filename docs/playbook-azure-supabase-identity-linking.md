# Playbook: Microsoft Azure (Entra) and Supabase identity linking

This document explains how to reason about **Supabase Auth + Microsoft Azure OAuth** when users change email (migration, alias, UPN change), why **“Sign in with Microsoft”** sometimes does not attach to the expected app account, and what patterns we used to fix or mitigate it. You can copy this file as-is into another repository.

---

## 1. Symptom you are solving

- A person’s **work email was migrated or renamed** (e.g. `old.name@company.com` → `new.name@company.com`, or primary SMTP vs Entra **UPN**).
- They click **“Continue with Microsoft”** (Azure OAuth).
- The app **does not recognise them** as the existing employee record: no profile sync, wrong user, or “orphan” Azure login with **no link** to the row your app uses (`profiles`, roles, etc.).

Root cause is almost always: **the email identity Supabase and your app trust is not the same string Microsoft puts on the JWT** after login.

---

## 2. How Supabase links identities (important vocabulary)

Supabase distinguishes two ideas:

| Concept | What it is |
|--------|------------|
| **Automatic identity linking** | When a user signs in with an OAuth provider, Auth looks for an **existing user with the same email** (and linking rules around **verified** email) and **attaches** that OAuth identity to that user instead of creating a duplicate. This is **described in the product docs**; it is **not** the same thing as the dashboard toggle **“Enable manual linking”**. |
| **Manual linking (beta)** | Lets a **logged-in** user call `linkIdentity()` to add another provider. Controlled by **“Enable manual linking”** in the dashboard (or self-hosted env). |

So: **if you only see “manual linking” in the dashboard, that does not mean automatic linking is “off”.** Manual linking is an extra feature for signed-in users. Automatic linking behaviour is governed by Auth rules and email verification, not by that toggle.

Official reference: [Identity Linking](https://supabase.com/docs/guides/auth/auth-identity-linking).

---

## 3. Why email migration breaks “automatic” behaviour

Automatic linking assumes a **stable, comparable email** between:

1. **Microsoft / Entra** — what ends up in the OAuth profile (often **UPN** or `email` claim; can differ from the mailbox the person uses day to day).
2. **`auth.users.email`** in Supabase — the email on the auth row you created or invited.
3. **Your app tables** — e.g. `profiles.lovable_email`, `secondary_email`, HR import fields, etc.

If HR or Supabase still has **`old@company.com`** but Microsoft now returns **`new@company.com`**, Supabase will treat the Azure sign-in as a **different person** unless something else reconciles them.

**Verified email:** automatic linking is unsafe with unverified emails; Supabase only links in situations where email trust is satisfied (see docs). Invited or confirmed users are in a better position than random unverified duplicates.

---

## 4. Pattern used in this project (conceptual architecture)

These ideas were implemented or already present in the codebase this chat referred to:

### 4.1 Database trigger: do not auto-create `profiles` for raw Azure sign-ups

For Microsoft provider sign-ups, **`handle_new_user`** intentionally **does not** insert into `public.profiles`, because the first Azure login might be a **temporary** user row that must later be **merged** into the real employee record.

Implication: if someone signs in with Azure **before** any link/reconcile step, they may **exist in `auth.users`** but **not** in your business tables until a linking flow runs.

### 4.2 Explicit linking edge function + RPC

When automatic linking by email is **not** enough (migrated email, duplicate row, etc.), the app exposes something like:

- **`link-microsoft-account`** (Edge Function):  
  - Caller is the **current** Supabase user (must already be an **Azure** identity).  
  - Must **not** already have a `profiles` row (the “temporary Microsoft-only” case).  
  - Accepts a **`targetEmail`**: resolves the **canonical** user to attach to by matching `auth.users.email` **or** `profiles.lovable_email` / `secondary_email`.  
  - Calls an RPC such as **`transfer_azure_identity`** to move the Azure identity from the temporary user to the target user, patch profile fields, then delete the temporary auth user.

That is the **controlled** path when **email equality** between Entra and Supabase is not reliable.

### 4.3 Admin invite path (passwordless, Microsoft-first)

To avoid issuing **temporary passwords** and to steer users toward **Azure** as the primary login:

1. Admin calls an Edge Function (e.g. `create-user`) that uses **`auth.admin.inviteUserByEmail`** instead of `createUser({ password })`.
2. Supabase sends the official **invitation email**; `redirectTo` points to a first-party route (e.g. **`/auth/accept-invite`**).
3. That page **does not** ask for a password; it instructs the user to click **“Continue with Microsoft”** (`signInWithOAuth({ provider: 'azure', ... })`).
4. **Success condition:** the invited email and the Microsoft account’s primary email (UPN) **match**, so Supabase can treat the OAuth identity as the same person (per automatic linking rules).

If the organisation migrated mail **after** invitations were sent, revisit **which email** is on the invite and on `profiles`.

---

## 5. Operational checklist when a user “is not detected” after email migration

Work through these in order:

1. **Confirm what Microsoft sends**  
   Inspect the Azure / Entra profile for that user: **UPN**, **primary email**, aliases. Decide the **canonical** string you want in Supabase.

2. **Align Supabase `auth.users.email`**  
   Update the auth user’s email in the Supabase Dashboard (Auth → Users) **or** via Admin API so it matches the Microsoft identity you expect.

3. **Align app profile emails**  
   Update `profiles` (and any HR fields) so `lovable_email` / `secondary_email` / login email used by your linking logic match **either** the Entra UPN **or** whatever your `link-microsoft-account` resolver matches on.

4. **Remove or merge duplicate auth users**  
   If they already created a **second** Supabase user by signing in with Microsoft after migration, you may have two `auth.users` rows. Use your **transfer / link** flow or manual Dashboard cleanup so only one row remains tied to the profile.

5. **Re-invite if needed**  
   If the user was created via invite to the **old** address, send a new invite to the **new** address **or** fix emails first then have them use **Microsoft** again from your invite landing page.

6. **Enable “manual linking” only if you use `linkIdentity()`**  
   If your app’s UX calls `linkIdentity()` for signed-in users, turn on manual linking. It does **not** replace automatic linking for invite + OAuth flows.

---

## 6. Edge Function HTTP auth (separate issue from linking)

If admin tools call Edge Functions with `supabase.functions.invoke` and the function returns **`Authorization header required`**:

- Ensure the **browser request** actually carries a **user JWT** (session not expired).
- Hardening used in this project: read JWT from **`Authorization`** **or** a fallback header **`x-client-authorization`**, refresh CORS `Access-Control-Allow-Headers` for headers modern `supabase-js` sends, and on the client call **`getUser()`**, optionally **`refreshSession()`**, before invoking.

That fixes **transport/auth to the function**, not Entra identity semantics—but broken invokes block admin fixes for linking.

---

## 7. Summary

| Goal | Mechanism |
|------|-----------|
| New employee, Microsoft-first, no temp password | `inviteUserByEmail` + landing page + `signInWithOAuth('azure')` |
| Same person, email changed in IT | Update **`auth.users.email`** + **`profiles`** emails; reconcile duplicates |
| Same person, Azure login created a stray auth user | **`link-microsoft-account`** + **`transfer_azure_identity`** (or equivalent) |
| Dashboard only shows “manual linking” | Normal; it controls **`linkIdentity`**, not the whole linking story—read Supabase **Identity Linking** docs |

---

## 8. References

- [Supabase: Identity Linking](https://supabase.com/docs/guides/auth/auth-identity-linking)  
- [Supabase: Securing Edge Functions](https://supabase.com/docs/guides/functions/auth)  

---

*This playbook was written to capture decisions from an internal implementation chat: invite-based onboarding, an accept-invite route, explicit Microsoft account linking for mismatched emails, and Edge Function JWT forwarding.*
