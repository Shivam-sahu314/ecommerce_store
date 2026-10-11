

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

function formatPrice(amount) {
    return `₹${Number(amount || 0).toFixed(2)}`;
}

function getCart() {
    try {
        const cart = JSON.parse(localStorage.getItem("cart") || "[]");
        return Array.isArray(cart) ? cart : [];
    } catch (error) {
        console.error("Cart read error:", error);
        return [];
    }
}

function showCheckoutMessage(message, success = false) {
    const messageElement = document.getElementById("checkoutMessage");

    if (messageElement) {
        messageElement.textContent = message;
        messageElement.style.color = success ? "green" : "red";
    } else {
        alert(message);
    }
}

function renderCheckoutSummary() {
    const checkoutItems = document.getElementById("checkoutItems");
    const checkoutTotal = document.getElementById("checkoutTotal");
    const submitButton = document.querySelector(
        '#checkoutForm button[type="submit"]'
    );

    const cart = getCart();

    if (!cart.length) {
        checkoutItems.innerHTML = `
            <p>Your cart is empty.</p>
            <a href="index.html">Continue Shopping</a>
        `;

        checkoutTotal.textContent = "0.00";

        if (submitButton) submitButton.disabled = true;
        return;
    }

    let total = 0;

    checkoutItems.innerHTML = cart.map(item => {
        const product = item.product || {};
        const quantity = Number(item.quantity || 0);
        const price = Number(product.price || 0);
        const subtotal = price * quantity;

        total += subtotal;

        return `
            <div class="checkout-item">
                <span>
                    ${escapeHTML(product.name || "Product")}
                    × ${quantity}
                </span>
                <strong>${formatPrice(subtotal)}</strong>
            </div>
        `;
    }).join("");

    checkoutTotal.textContent = total.toFixed(2);

    if (submitButton) submitButton.disabled = false;
}

async function placeOrder(event) {
    event.preventDefault();

    const token = localStorage.getItem("token");

    if (!token) {
        alert("Please login before placing an order.");
        window.location.href = "login.html";
        return;
    }

    const form = document.getElementById("checkoutForm");
    const submitButton = form.querySelector('button[type="submit"]');
    const cart = getCart();

    if (!cart.length) {
        showCheckoutMessage("Your cart is empty.");
        return;
    }

    // Read values using the actual IDs in checkout.html.
    const name = document.getElementById("customerName").value.trim();
    const phone = document.getElementById("customerPhone").value.trim();
    const address = document.getElementById("customerAddress").value.trim();
    const city = document.getElementById("customerCity").value.trim();
    const pincode = document.getElementById("customerPincode").value.trim();

    if (!name || !phone || !address || !city || !pincode) {
        showCheckoutMessage("Please fill in all delivery details.");
        return;
    }

    if (!/^\d{10}$/.test(phone)) {
        showCheckoutMessage("Enter a valid 10-digit phone number.");
        return;
    }

    if (!/^\d{6}$/.test(pincode)) {
        showCheckoutMessage("Enter a valid 6-digit pincode.");
        return;
    }

    const products = cart.map(item => ({
        product: item.product?._id,
        quantity: Number(item.quantity)
    }));

    if (products.some(item =>
        !item.product ||
        !Number.isInteger(item.quantity) ||
        item.quantity < 1
    )) {
        showCheckoutMessage(
            "A cart item is invalid. Please remove it and add the product again."
        );
        return;
    }

    const paymentMethod = document.querySelector(
        'input[name="paymentMethod"]:checked'
    )?.value || "COD";

    const orderData = {
        products,
        deliveryDetails: {
            name,
            phone,
            address,
            city,
            pincode
        },
        paymentMethod
    };

    if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = "Placing Order...";
    }

    showCheckoutMessage("");

    try {
        const response = await fetch(API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify(orderData)
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(
                data.message || `Order failed (${response.status}).`
            );
        }

        if (!data.order || !data.order._id) {
            throw new Error(
                "Server did not return the created order. Please verify My Orders before retrying."
            );
        }

        // Clear the cart only after the server confirms the order.
        localStorage.removeItem("cart");

        showCheckoutMessage("Order placed successfully!", true);

        alert("Order placed successfully!");

        window.location.href = "orders.html";

    } catch (error) {
        console.error("Checkout Error:", error);

        showCheckoutMessage(
            error.message || "Unable to place order. Please try again."
        );
    } finally {
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = "Place Order";
        }
    }
}

document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("checkoutForm");

    if (!form) {
        console.error('Checkout form with id="checkoutForm" not found.');
        return;
    }

    form.addEventListener("submit", placeOrder);
    renderCheckoutSummary();
});
