# Vendor Registration - TaguigSuki Mobile App

## Overview

Vendors must register through the mobile app and submit proof of business for admin approval before they can list products on the platform.

---

## Registration Form Fields

### Personal Information

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Full Name | Text | Yes | Vendor's complete name |
| Email | Email | Optional | For notifications and password recovery |
| Password | Password | Yes | Minimum 8 characters |

### Business Information

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Stall Name / Business Name | Text | Yes | Display name customers will see (e.g., "Aling Rosa's Fresh Fish") |
| Stall Location | Text / Dropdown | Yes | Location within Taguig People's Market (e.g., "Stall 12, Meat Section") |
| Product Category | Dropdown (multi-select) | Yes | What they sell: Meat, Fish, Vegetables, Fruits, Spices, etc. |

### Proof of Business (Document Uploads)

| Document | Type | Required | Notes |
|----------|------|----------|-------|
| Business/Mayor's Permit | Image upload (JPG/PNG/PDF) | Yes | Most common for palengke vendors in Taguig |
| Market Stall Lease/Contract | Image upload (JPG/PNG/PDF) | Yes | Proof they rent a stall at Taguig People's Market |
| Valid ID | Image upload (JPG/PNG/PDF) | Yes | Government-issued ID for identity verification |

---

## Registration Flow

1. Vendor opens the app → taps "Create Account"
2. Selects role: **Vendor**
3. Fills out personal info (Full Name, Email, Password)
4. Fills out business info (Stall Name, Stall Location, Product Category)
5. Uploads proof of business documents (Business Permit, Stall Lease, Valid ID)
6. Submits registration
7. Account status is set to **"Pending Approval"**
8. Vendor sees a "Waiting for Admin Approval" screen

---

## Admin Approval Flow (Web Panel)

1. Admin sees new vendor registration in **Vendor Management**
2. Admin views submitted documents (Business Permit, Stall Lease, Valid ID)
3. Admin reviews business information
4. Admin either:
   - **Approves** → Vendor receives notification, can now list products
   - **Rejects** → Vendor receives notification with rejection reason, can resubmit

---

## Vendor Account Statuses

| Status | Description |
|--------|-------------|
| Pending | Registration submitted, waiting for admin review |
| Approved | Admin approved, vendor can list products and receive orders |
| Rejected | Admin rejected, vendor can view reason and resubmit documents |
| Suspended | Admin suspended the account (e.g., violation of terms) |

---

## Database Considerations

- `vendors` table stores business info (stall_name, stall_location, product_category, status)
- `vendor_documents` table stores uploaded files (document_type, file_path, uploaded_at)
- Document types: `business_permit`, `stall_lease`, `valid_id`
- File storage: Laravel storage disk (local or S3)
- Max file size: 5MB per document
- Accepted formats: JPG, PNG, PDF
