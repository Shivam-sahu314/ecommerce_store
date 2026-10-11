
const API_URL = "http://localhost:3000/api/products";// =====================================
// VARIABLES
// =====================================

let allProducts = [];

// =====================================
// HELPER: ESCAPE HTML
// =====================================

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, function (char) {
        const entities = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        };

        return entities[char];
    });
}

// =====================================
// HELPER: VALIDATE IMAGE URL
// =====================================

function getSafeImageURL(value) {
    try {
        const url = new URL(String(value ?? ""));

        if (url.protocol === "http:" || url.protocol === "https:") {
            return url.href;
        }

        return "";
    } catch {
        return "";
    }
}

// =====================================
// HELPER: FORMAT PRICE
// =====================================

function formatPrice(price) {
    const amount = Number(price);

    if (!Number.isFinite(amount)) {
        return "Price unavailable";
    }

    return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 2
    }).format(amount);
}

// =====================================
// LOAD PRODUCTS
// =====================================

async function loadProducts() {
    const productList = document.getElementById("productList");
    const resultsCount = document.getElementById("resultsCount");

    if (!productList || !resultsCount) {
        console.error(
            "productList or resultsCount element is missing from index.html"
        );
        return;
    }

    productList.innerHTML = `
        <p class="store-message">Loading products...</p>
    `;

    resultsCount.textContent = "Loading products...";

    try {
        const response = await fetch(API_URL);

        if (!response.ok) {
            throw new Error(`Server error: ${response.status}`);
        }

        const products = await response.json();

        if (!Array.isArray(products)) {
            throw new Error("Invalid product data received.");
        }

        allProducts = products;

        createCategories(allProducts);
        filterProducts();

    } catch (error) {
        console.error("Products Error:", error);

        resultsCount.textContent = "";

        productList.innerHTML = `
            <div class="store-message store-error">
                <h3>Unable to load products</h3>
                <p>
                    Please check whether the backend server is running
                    and try again.
                </p>
                <button type="button" id="retryProducts">
                    Try Again
                </button>
            </div>
        `;

        document
            .getElementById("retryProducts")
            .addEventListener("click", loadProducts);
    }
}

// =====================================
// CREATE CATEGORY OPTIONS
// =====================================

function createCategories(products) {
    const categoryFilter = document.getElementById("categoryFilter");

    if (!categoryFilter) {
        console.error("categoryFilter element is missing from index.html");
        return;
    }

    const previousCategory = categoryFilter.value;

    const categories = [
        ...new Set(
            products
                .map(function (product) {
                    return String(product.category ?? "").trim();
                })
                .filter(Boolean)
        )
    ].sort(function (a, b) {
        return a.localeCompare(b);
    });

    categoryFilter.innerHTML = `
        <option value="all">All Categories</option>
    `;

    categories.forEach(function (category) {
        const option = document.createElement("option");

        option.value = category;
        option.textContent = category;

        categoryFilter.appendChild(option);
    });

    if (categories.includes(previousCategory)) {
        categoryFilter.value = previousCategory;
    } else {
        categoryFilter.value = "all";
    }
}

// =====================================
// DISPLAY PRODUCTS
// =====================================

function displayProducts(products) {
    const productList = document.getElementById("productList");
    const resultsCount = document.getElementById("resultsCount");

    if (!productList || !resultsCount) {
        console.error("Required product listing elements are missing.");
        return;
    }

    resultsCount.textContent =
        `${products.length} ${products.length === 1 ? "product" : "products"} found`;

    if (products.length === 0) {
        productList.innerHTML = `
            <div class="store-message no-products">
                <div class="empty-search-icon" aria-hidden="true">⌕</div>
                <h3>No products found</h3>
                <p>
                    Try a different search term or choose another category.
                </p>
                <button type="button" id="clearFilters">
                    Clear Filters
                </button>
            </div>
        `;

        document
            .getElementById("clearFilters")
            .addEventListener("click", function () {
                document.getElementById("searchInput").value = "";
                document.getElementById("categoryFilter").value = "all";

                filterProducts();
            });

        return;
    }

    productList.innerHTML = "";

    products.forEach(function (product) {
        const productCard = document.createElement("article");

        productCard.className = "store-product-card";

        const name = String(product.name ?? "Unnamed Product");
        const description = String(
            product.description ?? "No description available."
        );

        const category = String(product.category ?? "").trim();
        const safeCategory = category || "General";

        const stock = Number(product.stock);
        const validStock = Number.isFinite(stock) ? stock : 0;

        let stockClass = "in-stock";
        let stockLabel = `${validStock} in stock`;

        if (validStock <= 0) {
            stockClass = "out-of-stock";
            stockLabel = "Out of Stock";
        } else if (validStock <= 5) {
            stockClass = "low-stock";
            stockLabel = `Only ${validStock} left`;
        }

        const imageURL = getSafeImageURL(product.image);
        const safeId = String(product._id ?? "");

        productCard.innerHTML = `
            <div class="store-image-wrap">
                <span class="stock-badge ${stockClass}">
                    ${escapeHTML(stockLabel)}
                </span>

                <img
                    class="store-product-image"
                    src="${escapeHTML(imageURL)}"
                    alt="${escapeHTML(name)}"
                    loading="lazy"
                >

                <div class="store-image-fallback" aria-hidden="true">
                    <span>Image unavailable</span>
                </div>
            </div>

            <div class="store-product-info">
                <p class="store-product-category">
                    ${escapeHTML(safeCategory)}
                </p>

                <h3 class="store-product-name">
                    ${escapeHTML(name)}
                </h3>

                <p class="store-product-description">
                    ${escapeHTML(description)}
                </p>

                <div class="store-product-bottom">
                    <p class="store-product-price">
                        ${escapeHTML(formatPrice(product.price))}
                    </p>

                    <button
                        type="button"
                        class="store-view-button"
                        ${validStock <= 0 || !safeId ? "disabled" : ""}
                    >
                        ${validStock <= 0 ? "Unavailable" : "View Product"}
                    </button>
                </div>
            </div>
        `;

        const image = productCard.querySelector(".store-product-image");
        const fallback = productCard.querySelector(".store-image-fallback");

        function showImageFallback() {
            image.hidden = true;
            fallback.classList.add("visible");
        }

        if (!imageURL) {
            showImageFallback();
        } else {
            image.addEventListener("error", showImageFallback);
        }

        const viewButton = productCard.querySelector(".store-view-button");

        if (validStock > 0 && safeId) {
            viewButton.addEventListener("click", function () {
                viewProduct(safeId);
            });
        }

        productList.appendChild(productCard);
    });
}

// =====================================
// VIEW PRODUCT
// =====================================

function viewProduct(productId) {
    window.location.href =
        `product.html?id=${encodeURIComponent(productId)}`;
}

// =====================================
// FILTER PRODUCTS
// =====================================

function filterProducts() {
    const searchInput = document.getElementById("searchInput");
    const categoryFilter = document.getElementById("categoryFilter");

    if (!searchInput || !categoryFilter) {
        console.error("Search input or category filter is missing.");
        return;
    }

    const searchText = searchInput.value.trim().toLowerCase();
    const selectedCategory = categoryFilter.value;

    const filteredProducts = allProducts.filter(function (product) {
        const name = String(product.name ?? "").toLowerCase();
        const description = String(product.description ?? "").toLowerCase();
        const category = String(product.category ?? "").toLowerCase();

        const matchesSearch =
            name.includes(searchText) ||
            description.includes(searchText) ||
            category.includes(searchText);

        const matchesCategory =
            selectedCategory === "all" ||
            String(product.category ?? "").trim() === selectedCategory;

        return matchesSearch && matchesCategory;
    });

    displayProducts(filteredProducts);
}

// =====================================
// EVENTS
// =====================================

const searchInput = document.getElementById("searchInput");
const categoryFilter = document.getElementById("categoryFilter");

if (searchInput) {
    searchInput.addEventListener("input", filterProducts);
}

if (categoryFilter) {
    categoryFilter.addEventListener("change", filterProducts);
}

// =====================================
// START
// =====================================

loadProducts();
