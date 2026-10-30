Add a picture attachment feature to the customer feedback section. Allow customers to upload photos of products they received that are damaged, rotten, defective, or in poor condition. These images will serve as visual evidence to help vendors verify the actual condition of the products and investigate customer complaints.

COMPLETED IMPLEMENTATION & VERIFICATION:

1. Database Migration:
   - Migration: `database/migrations/2026_10_30_140000_create_review_images_table.php` (Migrated successfully)
   - Table `review_images` with: `id`, `review_id` (foreign key, cascade on delete), `path` (storage path in public disk), `order` (display order), `timestamps`.

2. Models:
   - `app/Models/ReviewImage.php`: Model with `review_id`, `path`, `order`, `url` accessor using `Storage::disk('public')->url()`, and `belongsTo(Review::class)`.
   - `app/Models/Review.php`: Added `images(): HasMany` relationship to `ReviewImage` ordered by `order`.

3. Backend Services & Controllers:
   - `app/Services/ReviewService.php`:
     - `createReview()`: Handles transaction-safe creation of `ReviewImage` records alongside reviews and returns reviews with loaded `images` relation.
     - `getReviewImages()`: Helper to retrieve review images in order.
     - `vendorReviews()`, `productReviews()`, `recipeReviews()`, and `getVendorReviewsDashboard()`: Eager loads images and returns serialized image objects containing `id`, `path`, and `url`.
     - `deleteReview()`: Deletes storage files when reviews are deleted.
   - `app/Http/Controllers/Api/ReviewController.php`:
     - Proper Laravel validation for single file or array of images (`image|mimes:jpeg,png,jpg|max:5120`).
     - Extracts and stores image uploads in `storage/app/public/feedback-images/{userId}` using unique filenames.
   - `app/Services/Admin/FeedbackManagementService.php`:
     - Eager loads `images` relationship for feedback listing and formats images with public URLs.

4. Admin Dashboard Web UI:
   - `resources/js/pages/admin/feedback/index.tsx`:
     - Extended `Review` TypeScript type with `images: ReviewImage[]`.
     - Table rows display an evidence badge with photo count and mini thumbnails when customer has attached visual proof.
     - Detail modal displays full "Customer Visual Evidence" gallery with click-to-preview lightbox overlay.
     - Respond modal displays attached photos so admins/vendors can reference the visual evidence while writing their response.

5. Customer Mobile Application (`mobile/client`):
   - `src/services/reviews.ts`:
     - Extended `Review` and `SubmitReviewPayload` with `ReviewImage` and `images` payload.
     - `submitProductReview()` and `submitVendorReview()` seamlessly send multipart `FormData` when photos are attached.
     - Added `resolveReviewImageUrl()` helper to handle local and production URLs.
   - `src/app/(customer)/track/[id].tsx`:
     - Integrated `expo-image-picker` into `ReviewSheet`.
     - Customers can select up to 5 photos from their gallery or use the camera to photograph damaged, rotten, or defective items.
     - Horizontal thumbnail previews with delete `(X)` buttons to remove/replace photos before submitting.

6. Vendor Mobile Reviews Dashboard:
   - `src/app/(vendor)/reviews.tsx`:
     - Collapsed review card indicates attached photo proof with an evidence chip.
     - Expanded review card renders full horizontal photo evidence gallery.
     - Vendors can tap any photo to open a fullscreen evidence preview modal to inspect the damaged/defective product condition.

7. Automated Test Suite:
   - `tests/Feature/Api/ReviewImageAttachmentTest.php`:
     - Verifies customer submitting reviews with photos.
     - Verifies public product reviews and vendor reviews dashboard API endpoints return images.
     - Verifies admin feedback service presents visual evidence.
     - Verifies automatic file cleanup on review deletion.
     - Verifies validation rejection of non-image files (PDF) and oversized files (>5MB).
   - All tests passing (25 assertions in `ReviewImageAttachmentTest`).
