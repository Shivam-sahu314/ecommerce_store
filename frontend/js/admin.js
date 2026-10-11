

const PRODUCT_API = "http://localhost:3000/api/products";
const ORDER_API = "http://localhost:3000/api/orders/admin/all";
const ORDER_STATUS_API = "http://localhost:3000/api/orders/admin";


const token = localStorage.getItem("token");

let user = null;
try {
    user = JSON.parse(localStorage.getItem("user"));
} catch (error) {
    console.error("Invalid user data:", error);
}

let productsCache = [];
let ordersCache = [];
let currentOrderFilter = "all";

if (!token || !user) {
    alert("Please login first.");
    window.location.href = "login.html";
} else if (user.role !== "admin") {
    alert("Admin access required.");
    window.location.href = "index.html";
}

function getHeaders() {
    return {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
    };
}

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[character]);
}

function getStockStatus(stock) {
    const quantity = Number(stock);

    if (!Number.isFinite(quantity) || quantity <= 0) {
        return { label: "Out of Stock", className: "stock-out" };
    }

    if (quantity <= 5) {
        return { label: "Low Stock", className: "stock-low" };
    }

    return { label: "In Stock", className: "stock-good" };
}

function applyOrderStatusColor(selectElement) {
    if (!selectElement) return;

    const status = selectElement.value.toLowerCase();

    selectElement.classList.remove(
        "status-pending",
        "status-processing",
        "status-shipped",
        "status-delivered",
        "status-cancelled"
    );

    selectElement.classList.add(`status-${status}`);
}

// =====================================
// PRODUCT CATEGORY FILTER
// =====================================

function updateCategoryFilter() {
    const categoryFilter = document.getElementById("productCategoryFilter");
    if (!categoryFilter) return;

    const selectedCategory = categoryFilter.value;

    const categories = [
        ...new Set(
            productsCache
                .map(product => String(product.category || "").trim())
                .filter(Boolean)
        )
    ].sort((a, b) => a.localeCompare(b));

    categoryFilter.innerHTML = '<option value="">All Categories</option>';

    categories.forEach(category => {
        const option = document.createElement("option");
        option.value = category;
        option.textContent = category;
        categoryFilter.appendChild(option);
    });

    if (categories.includes(selectedCategory)) {
        categoryFilter.value = selectedCategory;
    }
}

// =====================================
// RENDER PRODUCTS
// =====================================

function renderProducts() {
    const adminProducts = document.getElementById("adminProducts");
    if (!adminProducts) return;

    const searchText = (
        document.getElementById("productSearchInput")?.value || ""
    ).trim().toLowerCase();

    const selectedCategory =
        document.getElementById("productCategoryFilter")?.value || "";

    const selectedStock =
        document.getElementById("productStockFilter")?.value || "";

    const resultsCount = document.getElementById("productResultsCount");

    const filteredProducts = productsCache.filter(product => {
        const name = String(product.name || "").toLowerCase();
        const category = String(product.category || "");
        const stock = Number(product.stock) || 0;

        const matchesSearch = name.includes(searchText);
        const matchesCategory =
            !selectedCategory || category === selectedCategory;

        let matchesStock = true;

        if (selectedStock === "in-stock") {
            matchesStock = stock > 5;
        } else if (selectedStock === "low-stock") {
            matchesStock = stock > 0 && stock <= 5;
        } else if (selectedStock === "out-of-stock") {
            matchesStock = stock <= 0;
        }

        return matchesSearch && matchesCategory && matchesStock;
    });

    if (resultsCount) {
        resultsCount.textContent =
            `Showing ${filteredProducts.length} of ${productsCache.length} products`;
    }

    if (productsCache.length === 0) {
        adminProducts.innerHTML =
            "<p>No products found. Add your first product.</p>";
        return;
    }

    if (filteredProducts.length === 0) {
        adminProducts.innerHTML =
            "<p>No products match your search or filters.</p>";
        return;
    }

    adminProducts.innerHTML = "";

    filteredProducts.forEach(product => {
        const productDiv = document.createElement("div");
        productDiv.className = "admin-product";

        const stockStatus = getStockStatus(product.stock);

        productDiv.innerHTML = `
            <div class="admin-product-details">
                <h3>${escapeHTML(product.name)}</h3>
                <p>Price: ₹${escapeHTML(product.price)}</p>
                <p>Category: ${escapeHTML(product.category)}</p>
                <p>
                    Stock: ${escapeHTML(product.stock)}
                    <span class="stock-badge ${stockStatus.className}">
                        ${stockStatus.label}
                    </span>
                </p>
            </div>
            <div class="admin-product-actions">
                <button type="button" class="edit-product-button">Edit</button>
                <button type="button" class="delete-product-button">Delete</button>
            </div>
        `;

        productDiv.querySelector(".edit-product-button").addEventListener(
            "click",
            () => editProduct(product._id)
        );

        productDiv.querySelector(".delete-product-button").addEventListener(
            "click",
            () => deleteProduct(product._id)
        );

        adminProducts.appendChild(productDiv);
    });
}

// =====================================
// IMAGE PREVIEW
// =====================================

function setupImagePreview(inputId, previewId, messageId) {
    const imageInput = document.getElementById(inputId);
    const imagePreview = document.getElementById(previewId);
    const imageMessage = document.getElementById(messageId);

    if (!imageInput || !imagePreview || !imageMessage) return;

    function updatePreview() {
        const imageUrl = imageInput.value.trim();

        imagePreview.hidden = true;
        imagePreview.removeAttribute("src");

        if (!imageUrl) {
            imageMessage.textContent = "Enter an image URL to preview.";
            return;
        }

        let parsedUrl;

        try {
            parsedUrl = new URL(imageUrl);
        } catch {
            imageMessage.textContent = "Please enter a valid image URL.";
            return;
        }

        if (!["http:", "https:"].includes(parsedUrl.protocol)) {
            imageMessage.textContent =
                "Image URL must start with HTTP or HTTPS.";
            return;
        }

        imageMessage.textContent = "Loading image preview...";

        imagePreview.onload = function () {
            imagePreview.hidden = false;
            imageMessage.textContent = "Image preview loaded.";
        };

        imagePreview.onerror = function () {
            imagePreview.hidden = true;
            imagePreview.removeAttribute("src");
            imageMessage.textContent =
                "Image could not be loaded. Check the URL.";
        };

        imagePreview.src = parsedUrl.href;
    }

    imageInput.addEventListener("input", updatePreview);
    imageInput.addEventListener("change", updatePreview);

    if (imageInput.value.trim()) {
        updatePreview();
    } else {
        imageMessage.textContent = "Enter an image URL to preview.";
    }
}

// =====================================
// EDIT PRODUCT MODAL
// =====================================

function closeEditModal() {
    document.getElementById("editProductModal")?.remove();
}

function editProduct(id) {
    const product = productsCache.find(item => item._id === id);

    if (!product) {
        alert("Product not found. Please refresh the page.");
        return;
    }

    closeEditModal();

    const modal = document.createElement("div");
    modal.id = "editProductModal";
    modal.style.cssText = `
        position:fixed;inset:0;z-index:9999;
        background:rgba(0,0,0,.7);display:flex;
        align-items:center;justify-content:center;
        padding:16px;overflow-y:auto;
    `;

    modal.innerHTML = `
        <div style="
            background:white;color:#222;width:100%;max-width:520px;
            max-height:90vh;overflow-y:auto;padding:24px;border-radius:12px;
            box-sizing:border-box;
        ">
            <h2 style="margin-top:0">Edit Product</h2>

            <form id="editProductForm">
                <label for="editName">Product Name</label>
                <input id="editName" type="text" maxlength="150" required
                    style="width:100%;box-sizing:border-box;margin:6px 0 14px;padding:10px">

                <label for="editDescription">Description</label>
                <textarea id="editDescription" rows="3" maxlength="2000" required
                    style="width:100%;box-sizing:border-box;margin:6px 0 14px;padding:10px"></textarea>

                <label for="editPrice">Price (₹)</label>
                <input id="editPrice" type="number" min="0.01" step="0.01" required
                    style="width:100%;box-sizing:border-box;margin:6px 0 14px;padding:10px">

                <label for="editImage">Image URL</label>
                <input id="editImage" type="url" required
                    style="width:100%;box-sizing:border-box;margin:6px 0 8px;padding:10px">

                <div style="margin-bottom:16px">
                    <p>Image Preview</p>
                    <img id="editImagePreview" alt="Product preview" hidden
                        style="width:180px;height:180px;object-fit:contain;border:1px solid #ddd;border-radius:8px;padding:8px">
                    <p id="editImageMessage" role="status"></p>
                </div>

                <label for="editCategory">Category</label>
                <input id="editCategory" type="text" maxlength="100" required
                    style="width:100%;box-sizing:border-box;margin:6px 0 14px;padding:10px">

                <label for="editStock">Stock</label>
                <input id="editStock" type="number" min="0" step="1" required
                    style="width:100%;box-sizing:border-box;margin:6px 0 20px;padding:10px">

                <div style="display:flex;gap:10px;flex-wrap:wrap">
                    <button type="submit" id="saveProductButton">Save Changes</button>
                    <button type="button" id="cancelEditButton">Cancel</button>
                </div>

                <p id="editProductMessage" role="status"></p>
            </form>
        </div>
    `;

    document.body.appendChild(modal);

    document.getElementById("editName").value = product.name || "";
    document.getElementById("editDescription").value = product.description || "";
    document.getElementById("editPrice").value = product.price ?? "";
    document.getElementById("editImage").value = product.image || "";
    document.getElementById("editCategory").value = product.category || "";
    document.getElementById("editStock").value = product.stock ?? 0;

    setupImagePreview("editImage", "editImagePreview", "editImageMessage");

    document.getElementById("cancelEditButton").addEventListener(
        "click",
        closeEditModal
    );

    modal.addEventListener("click", event => {
        if (event.target === modal) closeEditModal();
    });

    document.getElementById("editProductForm").addEventListener(
        "submit",
        async function (event) {
            event.preventDefault();

            const name = document.getElementById("editName").value.trim();
            const description =
                document.getElementById("editDescription").value.trim();
            const priceValue = document.getElementById("editPrice").value;
            const price = Number(priceValue);
            const image = document.getElementById("editImage").value.trim();
            const category = document.getElementById("editCategory").value.trim();
            const stockValue = document.getElementById("editStock").value;
            const stock = Number(stockValue);

            const message = document.getElementById("editProductMessage");
            const saveButton = document.getElementById("saveProductButton");

            if (
                !name || !description || !image || !category ||
                priceValue.trim() === "" || !Number.isFinite(price) || price <= 0 ||
                stockValue.trim() === "" || !Number.isInteger(stock) || stock < 0
            ) {
                message.textContent =
                    "Please enter valid details in every field.";
                return;
            }

            saveButton.disabled = true;
            saveButton.textContent = "Saving...";

            try {
                const response = await fetch(`${PRODUCT_API}/${id}`, {
                    method: "PUT",
                    headers: getHeaders(),
                    body: JSON.stringify({
                        name, description, price, image, category, stock
                    })
                });

                const data = await response.json();

                if (!response.ok) {
                    message.textContent =
                        data.message || "Failed to update product.";
                    return;
                }

                closeEditModal();
                alert("Product updated successfully!");
                await loadProducts();

            } catch (error) {
                console.error("Update product error:", error);
                message.textContent = "Unable to connect to server.";
            } finally {
                const currentButton =
                    document.getElementById("saveProductButton");

                if (currentButton) {
                    currentButton.disabled = false;
                    currentButton.textContent = "Save Changes";
                }
            }
        }
    );
}

// =====================================
// LOAD PRODUCTS
// =====================================

async function loadProducts() {
    const adminProducts = document.getElementById("adminProducts");
    if (!adminProducts) return;

    adminProducts.innerHTML = "<p>Loading products...</p>";

    try {
        const response = await fetch(PRODUCT_API);
        const data = await response.json();

        if (!response.ok) {
            adminProducts.innerHTML = "<p>Failed to load products.</p>";
            console.error("Load products failed:", data);
            return;
        }

        productsCache = Array.isArray(data) ? data : [];

        const totalProducts = document.getElementById("totalProducts");
        if (totalProducts) {
            totalProducts.textContent = productsCache.length;
        }

        updateCategoryFilter();
        renderProducts();

    } catch (error) {
        console.error("Load products error:", error);
        adminProducts.innerHTML =
            "<p>Unable to connect to server. Check your backend.</p>";

        const resultsCount = document.getElementById("productResultsCount");
        if (resultsCount) resultsCount.textContent = "Unable to load products";
    }
}

// Product search/filter listeners
document.getElementById("productSearchInput")
    ?.addEventListener("input", renderProducts);

document.getElementById("productCategoryFilter")
    ?.addEventListener("change", renderProducts);

document.getElementById("productStockFilter")
    ?.addEventListener("change", renderProducts);

// =====================================
// ADD PRODUCT
// =====================================

const productForm = document.getElementById("productForm");

if (productForm) {
    productForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        const name = document.getElementById("productName").value.trim();
        const description =
            document.getElementById("productDescription").value.trim();
        const priceValue = document.getElementById("productPrice").value;
        const price = Number(priceValue);
        const image = document.getElementById("productImage").value.trim();
        const category =
            document.getElementById("productCategory").value.trim();
        const stockValue = document.getElementById("productStock").value;
        const stock = Number(stockValue);
        const message = document.getElementById("productMessage");

        if (
            !name || !description || !image || !category ||
            priceValue.trim() === "" || !Number.isFinite(price) || price <= 0 ||
            stockValue.trim() === "" || !Number.isInteger(stock) || stock < 0
        ) {
            message.textContent = "Please enter valid product details.";
            return;
        }

        const submitButton =
            productForm.querySelector('button[type="submit"]');

        if (submitButton) submitButton.disabled = true;

        try {
            const response = await fetch(PRODUCT_API, {
                method: "POST",
                headers: getHeaders(),
                body: JSON.stringify({
                    name, description, price, image, category, stock
                })
            });

            const data = await response.json();

            if (!response.ok) {
                message.textContent =
                    data.message || "Failed to add product.";
                return;
            }

            message.textContent = "Product added successfully!";
            productForm.reset();

            const preview = document.getElementById("addImagePreview");
            const imageMessage = document.getElementById("addImageMessage");

            if (preview) {
                preview.hidden = true;
                preview.removeAttribute("src");
            }

            if (imageMessage) {
                imageMessage.textContent = "Enter an image URL to preview.";
            }

            await loadProducts();

        } catch (error) {
            console.error("Add product error:", error);
            message.textContent = "Unable to connect to server.";
        } finally {
            if (submitButton) submitButton.disabled = false;
        }
    });
}

// =====================================
// DELETE PRODUCT
// =====================================

async function deleteProduct(id) {
    if (!confirm("Are you sure you want to delete this product?")) return;

    try {
        const response = await fetch(`${PRODUCT_API}/${id}`, {
            method: "DELETE",
            headers: getHeaders()
        });

        const data = await response.json();

        if (!response.ok) {
            alert(data.message || "Failed to delete product.");
            return;
        }

        alert("Product deleted successfully!");
        await loadProducts();

    } catch (error) {
        console.error("Delete product error:", error);
        alert("Unable to connect to server.");
    }
}

// =====================================
// LOAD ORDERS AND DASHBOARD STATS
// =====================================

async function loadOrders() {
    const adminOrders = document.getElementById("adminOrders");
    if (!adminOrders) return;

    adminOrders.innerHTML = "<p>Loading orders...</p>";

    try {
        const response = await fetch(ORDER_API, {
            method: "GET",
            headers: getHeaders()
        });

        const data = await response.json();

        if (!response.ok) {
            adminOrders.textContent =
                data.message || "Failed to load orders.";
            console.error("Load orders failed:", data);
            return;
        }

        ordersCache = Array.isArray(data) ? data : [];

        const totalOrders = document.getElementById("totalOrders");
        const pendingOrders = document.getElementById("pendingOrders");
        const totalSalesElement = document.getElementById("totalSales");

        if (totalOrders) {
            totalOrders.textContent = ordersCache.length;
        }

        const pendingCount = ordersCache.filter(order =>
            String(order.status || "").toLowerCase() === "pending"
        ).length;

        if (pendingOrders) {
            pendingOrders.textContent = pendingCount;
        }

        const totalSales = ordersCache.reduce((total, order) => {
            return String(order.status || "").toLowerCase() !== "cancelled"
                ? total + Number(order.totalAmount || 0)
                : total;
        }, 0);

        if (totalSalesElement) {
            totalSalesElement.textContent =
                totalSales.toLocaleString("en-IN");
        }

        renderOrders();

    } catch (error) {
        console.error("Load orders error:", error);
        adminOrders.innerHTML = "<p>Unable to connect to server.</p>";
    }
}

// =====================================
// FILTER AND RENDER ORDERS
// =====================================

function renderOrders() {
    const adminOrders = document.getElementById("adminOrders");
    if (!adminOrders) return;

    const heading = document.getElementById("ordersHeading");
    const description = document.getElementById("ordersDescription");
    const showAllButton = document.getElementById("showAllOrdersButton");

    const filteredOrders = currentOrderFilter === "all"
        ? ordersCache
        : ordersCache.filter(order =>
            String(order.status || "").toLowerCase() ===
            currentOrderFilter.toLowerCase()
        );

    if (heading) {
        heading.textContent = currentOrderFilter === "all"
            ? "Manage Orders"
            : "Pending Orders";
    }

    if (description) {
        description.textContent = currentOrderFilter === "all"
            ? "Track orders and update their current status."
            : `Showing ${filteredOrders.length} pending order(s).`;
    }

    if (showAllButton) {
        showAllButton.hidden = currentOrderFilter === "all";
    }

    if (filteredOrders.length === 0) {
        adminOrders.innerHTML = currentOrderFilter === "Pending"
            ? "<p>No pending orders found.</p>"
            : "<p>No orders found.</p>";
        return;
    }

    adminOrders.innerHTML = "";

    filteredOrders.forEach(function (order) {
        const orderDiv = document.createElement("div");
        orderDiv.className = "admin-order";

        const customerName = order.user?.name || "Unknown";
        const customerEmail = order.user?.email || "";

        let productsHTML = "";

        (order.products || []).forEach(function (item) {
            if (!item.product) return;

            productsHTML += `
                <p>${escapeHTML(item.product.name)}
                × ${escapeHTML(item.quantity)}</p>
            `;
        });

        const statuses = [
            "Pending", "Processing", "Shipped", "Delivered", "Cancelled"
        ];

        const currentStatus = String(order.status || "Pending");

        const statusOptions = statuses.map(status => `
            <option value="${status}"
                ${currentStatus.toLowerCase() === status.toLowerCase()
                    ? "selected" : ""}>
                ${status}
            </option>
        `).join("");

        orderDiv.innerHTML = `
            <h3>Order ${escapeHTML(order._id)}</h3>
            <p>Customer: ${escapeHTML(customerName)}</p>
            <p>Email: ${escapeHTML(customerEmail)}</p>
            <p>Products:</p>
            ${productsHTML || "<p>Product details unavailable.</p>"}
            <p>Total: ₹${escapeHTML(order.totalAmount)}</p>
            <p>Status:</p>
            <select class="order-status-select">
                ${statusOptions}
            </select>
        `;

        const statusSelect =
            orderDiv.querySelector(".order-status-select");

        applyOrderStatusColor(statusSelect);

        statusSelect.addEventListener("change", function (event) {
            updateOrderStatus(order._id, event.target.value);
        });

        adminOrders.appendChild(orderDiv);
    });
}

// =====================================
// DASHBOARD CARD CLICK EVENTS
// =====================================

function setOrderFilter(filter) {
    currentOrderFilter = filter;
    renderOrders();

    document.getElementById("orders-section")?.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
}

document.querySelectorAll("[data-order-filter]").forEach(card => {
    function activateCard() {
        setOrderFilter(card.dataset.orderFilter);
    }

    card.addEventListener("click", activateCard);

    card.addEventListener("keydown", function (event) {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            activateCard();
        }
    });
});

document.getElementById("allOrdersLink")?.addEventListener(
    "click",
    function () {
        currentOrderFilter = "all";
        renderOrders();
    }
);

document.getElementById("showAllOrdersButton")?.addEventListener(
    "click",
    function () {
        setOrderFilter("all");
    }
);

// =====================================
// UPDATE ORDER STATUS
// =====================================

async function updateOrderStatus(orderId, status) {
    try {
        const response = await fetch(
            `${ORDER_STATUS_API}/${orderId}/status`,
            {
                method: "PUT",
                headers: getHeaders(),
                body: JSON.stringify({ status })
            }
        );

        const data = await response.json();

        if (!response.ok) {
            alert(data.message || "Failed to update order status.");
            await loadOrders();
            return;
        }

        alert("Order status updated!");
        await loadOrders();

    } catch (error) {
        console.error("Update order status error:", error);
        alert("Unable to connect to server.");
        await loadOrders();
    }
}

// =====================================
// LOGOUT
// =====================================

function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.href = "login.html";
}

// =====================================
// INITIAL LOAD
// =====================================

setupImagePreview(
    "productImage",
    "addImagePreview",
    "addImageMessage"
);

if (token && user && user.role === "admin") {
    loadProducts();
    loadOrders();
}
