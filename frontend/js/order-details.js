

const API_URL = "http://localhost:3000/api/orders";

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}

function formatPrice(value) {
    return `₹${Number(value || 0).toFixed(2)}`;
}

function statusClass(status) {
    return String(status || "Pending")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-");
}

async function loadOrderDetails() {
    const container = document.getElementById("orderDetails");
    const token = localStorage.getItem("token");

    if (!container) {
        console.error('HTML element id="orderDetails" is missing.');
        return;
    }

    if (!token) {
        alert("Please login first.");
        window.location.href = "login.html";
        return;
    }

    const orderId = new URLSearchParams(window.location.search).get("id");

    if (!orderId) {
        container.innerHTML = `
            <p>Order ID missing. Please open the order from My Orders.</p>
            <a href="orders.html">Back to My Orders</a>
        `;
        return;
    }

    container.innerHTML = "<p>Loading order details...</p>";

    try {
        const response = await fetch(
            `${API_URL}/${encodeURIComponent(orderId)}`,
            {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(
                data.message || `Unable to load order (${response.status}).`
            );
        }

        const order = data.order || data;

        if (!order || !order._id) {
            throw new Error("Order details were not found in the response.");
        }

        const delivery = order.deliveryDetails || {};
        const products = order.products || [];

        const productsHTML = products.map(item => {
            const product = item.product || {};
            const quantity = Number(item.quantity || 0);
            const price = Number(product.price || item.price || 0);

            return `
                <div class="order-detail-item">
                    <div>
                        <h4>${escapeHTML(
                            product.name || "Unavailable product"
                        )}</h4>
                        <p>Quantity: ${quantity}</p>
                    </div>
                    <strong>${formatPrice(price * quantity)}</strong>
                </div>
            `;
        }).join("");

        const date = order.createdAt
            ? new Date(order.createdAt).toLocaleString("en-IN")
            : "Unavailable";

        const paymentMethod =
            order.paymentMethod === "ONLINE_DEMO"
                ? "Online Payment (Demo)"
                : "Cash on Delivery";

        container.innerHTML = `
            <section class="order-detail-card">
                <h2>Order Details</h2>

                <p><strong>Order ID:</strong>
                    ${escapeHTML(order._id)}</p>

                <p><strong>Order Date:</strong>
                    ${escapeHTML(date)}</p>

                <p><strong>Status:</strong>
                    <span class="order-status status-${statusClass(order.status)}">
                        ${escapeHTML(order.status || "Pending")}
                    </span>
                </p>

                <p><strong>Payment Method:</strong>
                    ${escapeHTML(paymentMethod)}</p>

                <p><strong>Payment Status:</strong>
                    ${escapeHTML(order.paymentStatus || "Pending")}</p>

                <hr>

                <h3>Ordered Products</h3>
                ${productsHTML || "<p>No product details available.</p>"}

                <hr>

                <h3>Delivery Details</h3>
                <p>${escapeHTML(delivery.name || "Not provided")}</p>
                <p>${escapeHTML(delivery.phone || "")}</p>
                <p>${escapeHTML(delivery.address || "")}</p>
                <p>${escapeHTML(delivery.city || "")}
                    ${escapeHTML(delivery.pincode || "")}</p>

                <hr>

                <h3>Total: ${formatPrice(order.totalAmount)}</h3>

                <a class="track-order-btn" href="orders.html">
                    Back to My Orders
                </a>
            </section>
        `;
    } catch (error) {
        console.error("Order Details Error:", error);

        container.innerHTML = `
            <p class="error-message">${escapeHTML(error.message)}</p>
            <a href="orders.html">Back to My Orders</a>
        `;
    }
}

loadOrderDetails();
