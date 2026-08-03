Implement a fully functional **Place Order** system that works like a real production e-commerce application.

### Order Processing

When the user taps the **Place Order** button:

1. Validate all required information:

   * Shipping address
   * Payment method
   * Cart is not empty
   * Product stock is available

2. Create the order successfully.

3. Save all purchased products into the **Orders** collection/table with:


### Inventory Management

After a successful order:

* Automatically deduct the purchased quantity from the vendor's inventory.
* Update the product stock in the database immediately.
* Example:

  * Current Stock: **25**
  * Customer Orders: **3**
  * Updated Stock: **22**

### Stock Validation

Before placing the order:

* Check the latest stock from the database.
* Prevent ordering if stock is insufficient.
* Display a modern error message such as:

  * "Only 2 items remaining in stock."
  * "This product is currently out of stock."

Never allow stock values to become negative.

### Atomic Transaction

The order process must be atomic:

* Create the order.
* Deduct product stock.
* Save order items.
* Update inventory.

If any step fails, roll back all changes so that:

* No partial order is created.
* Stock remains unchanged.
* The cart is not cleared.

### Shopping Cart

Only clear the user's cart after the order has been successfully completed and saved.

### Vendor Dashboard

Immediately update the vendor dashboard after an order:


### Customer Orders

After placing an order, it should appear instantly in **My Orders** with statuses such as:

* Pending
* Confirmed
* Processing
* Shipped
* Delivered
* Cancelled

### UI/UX

While processing the order:

* Show a loading indicator.
* Disable the **Place Order** button to prevent duplicate submissions.
* Prevent multiple taps.

After success:

* Show a modern success animation.
* Display an order confirmation page with:

  * Order Number
  * Purchased Products
  * Total Amount
  * Estimated Delivery Date
  * Payment Summary
  * Continue Shopping button
  * View My Orders button

### Data Consistency

Ensure inventory, cart, orders, vendor data, and customer order history always remain synchronized. The stock deduction must happen only after a successful order and should be reflected immediately across the entire application without requiring a manual refresh.
