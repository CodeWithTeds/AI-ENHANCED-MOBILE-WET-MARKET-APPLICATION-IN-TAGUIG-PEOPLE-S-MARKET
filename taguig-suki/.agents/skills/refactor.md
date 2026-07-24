Refactor the entire codebase to follow enterprise-level Laravel architecture and coding standards.

### Requirements

* Apply **Separation of Concerns (SoC)** throughout the application.
* Refactor all business logic out of controllers into **Repository classes**.
* Implement the **Repository Pattern** with interfaces.
* Controllers should only be responsible for handling HTTP requests and returning responses. **Each controller method should ideally contain only one line**, delegating all logic to the appropriate repository or service.
* Use **PHP Enums** for all backend constants, statuses, types, roles, and other fixed values. Remove hardcoded strings and magic numbers.
* Follow **PSR-12** coding standards and Laravel best practices.
* Remove duplicated code by extracting reusable logic into shared classes, traits, or services where appropriate.
* Keep methods small, focused, and maintainable, following the **Single Responsibility Principle (SRP)**.
* Use **Dependency Injection** instead of directly instantiating classes.
* Ensure proper validation using **Form Request** classes instead of validating inside controllers.
* Return consistent API responses using a standardized response format.
* Organize the project into a clean architecture with clear folder responsibilities.

### Expected Folder Structure

* Controllers
* Requests
* Repositories

  * Interfaces
  * Implementations
* Services (if necessary)
* Enums
* DTOs (if applicable)
* Resources
* Models
* Policies
* Traits
* Helpers

### Additional Requirements

* Eliminate fat controllers and fat models.
* Remove unnecessary code and improve readability.
* Use meaningful class, method, and variable names.
* Ensure the code is scalable, maintainable, testable, and production-ready.
* Follow Laravel conventions wherever possible instead of reinventing existing features.
* Improve performance by avoiding unnecessary queries and applying eager loading where appropriate.
* Ensure every class has a single responsibility and each layer only communicates with its intended dependency.

The final result should resemble an enterprise-grade Laravel backend that is clean, modular, maintainable, and easy to extend.
