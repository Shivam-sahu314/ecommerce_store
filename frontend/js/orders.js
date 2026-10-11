
const API_URL = "http://localhost:3000/api/orders/my-orders";
function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}

function getStatusClass(status) {
    return String(status || "Pending")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-");
}

async function loadOrders() {
    const ordersList = document.getElementById("ordersList");
    const token = localStorage.getItem("token");

    if (!ordersList) {
        console.error('Missing HTML element: id="ordersList"');
        return;
    }

    if (!token) {
        alert("Please login first.");
        window.location.href = "login.html";
        return;
    }

    ordersList.innerHTML = "<p>Loading your orders...</p>";

    try {
        const response = await fetch(API_URL, {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });

        const orders = await response.json();

        if (!response.ok) {
            ordersList.innerHTML = `
                <p>${escapeHTML(
                    orders.message || "Failed to load orders."
                )}</p>
            `;
            return;
        }

        if (!Array.isArray(orders)) {
            console.error("Unexpected orders API response:", orders);
            ordersList.innerHTML =
                "<p>Unexpected response from server.</p>";
            return;
        }

        if (orders.length === 0) {
            ordersList.innerHTML = `
                <div class="empty-orders">
                    <h3>No Orders Yet 📦</h3>
                    <p>You haven't placed any orders yet.</p>
                    <a href="index.html">Start Shopping</a>
                </div>
            `;
            return;
        }

        ordersList.innerHTML = "";

        orders.forEach(order => {
            const card = document.createElement("article");
            card.className = "order-card";

            const date = order.createdAt
                ? new Date(order.createdAt).toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric"
                })
                : "Date unavailable";

            const paymentMethod =
                order.paymentMethod === "ONLINE_DEMO"
                    ? "Online Payment (Demo)"
                    : "Cash on Delivery";

            const paymentStatus = order.paymentStatus || "Pending";

            const products = (order.products || [])
                .map(item => {
                    const name = item.product?.name ||
                        "Unavailable product";

                    return `${name} × ${item.quantity}`;
                })
                .join(", ");

            card.innerHTML = `
                <div class="order-top">
                    <div>
                        <h3>Order</h3>
                        <p class="order-id">
                            ${escapeHTML(order._id)}
                        </p>
                    </div>

                    <span class="order-status status-${getStatusClass(order.status)}">
                        ${escapeHTML(order.status || "Pending")}
                    </span>
                </div>

                <p class="order-date">
                    📅 ${escapeHTML(date)}
                </p>

                <p class="order-product-summary">
                    ${escapeHTML(products || "No product details available")}
                </p>

                <div class="order-payment-info">
                    <p>
                        <strong>Payment:</strong>
                        ${escapeHTML(paymentMethod)}
                    </p>
                    <p>
                        <strong>Payment Status:</strong>
                        ${escapeHTML(paymentStatus)}
                    </p>
                </div>

                <div class="order-bottom">
                    <strong>
                        Total: ₹${Number(order.totalAmount || 0).toFixed(2)}
                    </strong>

                    <a class="track-order-btn"
                       href="order-details.html?id=${encodeURIComponent(order._id)}">
                        View Details &amp; Track
                    </a>
                </div>
            `;

            ordersList.appendChild(card);
        });

    } catch (error) {
        console.error("My Orders Error:", error);

        ordersList.innerHTML = `
            <p>Unable to connect to server. Please try again.</p>
            <button id="retryOrders" type="button">Try Again</button>
        `;

        document.getElementById("retryOrders")
            ?.addEventListener("click", loadOrders);
    }
}

loadOrders();
