# Task 3: System Revision Items 1–3 Implementation & Verification

Implementation of **Items 1, 2, and 3 ONLY** from `SYSTEM REVISION.md` across the Laravel backend, Admin Inertia web UI, and Expo React Native mobile client (leaving items 4–10 untouched).

---

## Completed Implementation Details

### 1. Auto Compute Rent per Month
- **Enum (`app/Enums/StallSize.php`):**
  - Added `monthlyRent(): float` mapping:
    - `Small` (`small`) → `₱1,500.00`
    - `Medium` (`medium`) → `₱2,000.00`
    - `Large` (`large`) → `₱3,000.00`
- **Form Request & Service (`app/Http/Requests/Admin/StoreStallRequest.php`, `app/Services/Admin/StallManagementService.php`):**
  - `StoreStallRequest::prepareForValidation()` automatically derives `monthly_rent` from the selected `StallSize`.
  - `StallManagementService::getIndexData()` exposes `monthly_rent` per size option to the frontend.
  - `StallManagementService::create()` and `update()` enforce server-side rent derivation via `resolveMonthlyRent()` so manually tampered rents cannot override size pricing.
- **Admin UI (`resources/js/pages/admin/stalls/index.tsx`):**
  - Both Create Stall and Edit Stall modals auto-compute `monthly_rent` immediately when the `Size` dropdown changes.
  - Replaced editable numeric rent inputs with `readOnly` non-editable formatted fields labeled `Rent / Month (₱) (Auto)`.

### 2. Separate Fields (Consolidation Under Stall Management)
- **Admin Sidebar (`resources/js/components/app-sidebar.tsx`):**
  - Removed separate sidebar entries `Stall Monitoring & Complaints` and `Stall Rentals & Billing` from `Vendor Management`.
  - Kept `Stall Management` (`/admin/dashboard/vendors/stalls`) with `activeMatches` covering `/admin/dashboard/vendors/stalls`, `/admin/dashboard/vendors/stalls/monitoring`, and `/admin/dashboard/vendors/rentals`, keeping `Vendor Management` expanded and `Stall Management` highlighted when navigating between its sub-tabs.
- **Sub-Navigation & Breadcrumbs (`resources/js/pages/admin/stalls/index.tsx`, `monitoring.tsx`, `rentals/index.tsx`):**
  - `Stall Monitoring & Customer Complaints` and `Monthly Stall Rentals & Billing` remain accessible directly via the section tabs inside `Stall Management`.
  - Updated `rentals/index.tsx` breadcrumbs to nest cleanly under `Dashboard > Stall Management > Monthly Stall Rentals & Billing`.

### 3. PDF and Image Uploading (Vendor & Customer)
- **Backend Validation (`app/Http/Requests/Auth/RegisterRequest.php`, `app/Services/CustomerVerificationService.php`, `app/Http/Requests/VendorRegisterRequest.php`):**
  - Updated customer registration (`RegisterRequest`) and profile ID verification upload (`CustomerVerificationService`) from `image` to `file|mimes:jpeg,png,jpg,webp,pdf|max:5120`.
  - Aligned `VendorRegisterRequest` to accept `jpg,jpeg,png,webp,pdf` (max 5MB) across all uploaded documents.
- **Admin User ID Verification Preview (`resources/js/pages/admin/users/index.tsx`):**
  - Added `isPdfDocument()` helper so customer PDF IDs display a PDF badge in table/detail thumbnails and render an interactive `<iframe>` PDF viewer + `Open PDF` link in the preview modal.
- **Mobile Client (`mobile/client`):**
  - Installed `expo-document-picker` (`~58.0.5`) and registered its plugin in `app.json`.
  - Created shared `src/utils/document-picker.ts` supporting Camera, Photo Gallery, and File System (`application/pdf`, JPG, PNG, WEBP up to 5MB) with consistent Android/iOS source selection.
  - Updated Vendor registration (`src/screens/registration/StepDocuments.tsx`, `src/components/registration/DocumentUploader.tsx`) to support PDF and image picking with `PDF`/`IMG` badges.
  - Updated Customer registration & profile ID upload (`src/app/customer-login.tsx`, `src/app/(customer)/profile.tsx`, `src/services/customer-auth.ts`, `src/services/customer-verification.ts`) to support PDF and image picking, proper FormData MIME handling, and PDF preview cards.

---

## Verification

- Covered in unified Pest test suite `tests/Feature/SystemRevision1To4Test.php`.
- Verified Laravel test suite (`php artisan test --compact`), Pint formatting check (`./vendor/bin/pint --test`), Vite TypeScript & build (`npm run types:check && npm run build`), and Expo mobile TypeScript check (`npx tsc --noEmit`).
