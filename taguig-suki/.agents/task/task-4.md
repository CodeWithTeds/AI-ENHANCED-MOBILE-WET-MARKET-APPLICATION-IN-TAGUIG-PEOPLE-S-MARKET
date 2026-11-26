# Task 4: Notification on Account Approval (Item 4 ONLY)

Implementation of **Item 4 ONLY** from `SYSTEM REVISION.md` across the Laravel backend, Gmail SMTP mail config, and Admin panel UI (leaving items 5–10 untouched).

---

## Completed Implementation Details

### 1. Admin Notifications on Customer & Vendor Approval Requests
- **Notification (`app/Notifications/AccountApprovalRequestedNotification.php`):**
  - Persists database notifications for all active administrators (`is_admin = true`) with `account_type` (`customer` / `vendor`), applicant details (`applicant_user_id`, `applicant_name`, `applicant_email`, optional `stall_name`), and direct `action_url` to the approval queue.
- **Service (`app/Services/AdminNotificationService.php`):**
  - `notifyAccountApprovalRequested()` notifies active admins on:
    - Customer registration (`app/Services/AuthService.php`)
    - Customer ID verification upload (`app/Services/CustomerVerificationService.php`)
    - Vendor registration (`app/Services/VendorRegistrationService.php`, after DB transaction commits)
  - `markApprovalRequestsReadForApplicant()` marks related unread request notifications read once reviewed.
- **Admin Endpoints & Inertia Shared Props (`app/Http/Controllers/Admin/AdminNotificationController.php`, `routes/web.php`, `app/Http/Middleware/HandleInertiaRequests.php`):**
  - Registered `/admin/dashboard/notifications` (`GET`), `/admin/dashboard/notifications/{notification}/read` (`PATCH`), and `/admin/dashboard/notifications/read-all` (`POST`).
  - Shares live `adminNotifications` prop on all authenticated admin requests.
- **Admin UI (`resources/js/components/admin-notification-bell.tsx`, `app-sidebar-header.tsx`, `resources/js/pages/dashboard.tsx`):**
  - Added live `<AdminNotificationBell />` dropdown in the Admin header bar across every page with unread badge count, quick pending vendor/customer review links, click-to-navigate + mark read, and 15-second background polling.
  - Added pending vendor registration banner alongside pending customer ID verification banner on `dashboard.tsx`.

### 2. Email Notification on Account Approval + Gmail SMTP Setup
- **Notification (`app/Notifications/AccountApprovedNotification.php`):**
  - Dispatches synchronously over `['mail', 'database']` when admin approves either a customer (`CustomerVerificationService::approve()`) or vendor (`VendorApprovalService::approve()`), emailing the applicant's registered email address.
- **Gmail SMTP Configuration (`.env`, gitignored):**
  - Configured `MAIL_MAILER=smtp`, `MAIL_HOST=smtp.gmail.com`, `MAIL_PORT=587`, `MAIL_USERNAME=teadmarvin@gmail.com`, `MAIL_FROM_ADDRESS="teadmarvin@gmail.com"`, `MAIL_FROM_NAME="exegesis"`.

---

## Verification

- Covered in unified Pest test suite `tests/Feature/SystemRevision1To4Test.php`.
- Verified Pint formatting (`./vendor/bin/pint --test`), full Laravel test suite (`php artisan test --compact`), Vite production build (`npm run build`), and real Gmail SMTP connection/delivery.
