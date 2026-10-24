
(() => {
  const $ = id => document.getElementById(id);
  const products = window.PRODUCTS || [];
  const config = window.STORE_CONFIG || {};
  let cart = {};

  try {
    cart = JSON.parse(localStorage.getItem("otakushelf-cart") || "{}");
  } catch {
    cart = {};
  }

  const money = n => new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(n);

  const safe = value => String(value ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;",
    '"': "&quot;", "'": "&#39;"
  }[c]));

  const getProduct = id => products.find(p => p.id === id);
  const quantity = () => Object.values(cart).reduce((a, n) => a + n, 0);
  const subtotal = () => Object.entries(cart).reduce(
    (sum, [id, n]) => sum + (getProduct(id)?.price || 0) * n, 0
  );

  function saveCart() {
    try {
      localStorage.setItem("otakushelf-cart", JSON.stringify(cart));
    } catch {}
  }

  function renderProducts() {
    const query = $("searchInput").value.trim().toLowerCase();
    const category = $("categoryFilter").value;
    const sort = $("sortFilter").value;

    let list = products.filter(p =>
      (category === "all" || p.category === category) &&
      `${p.title} ${p.author} ${p.category}`.toLowerCase().includes(query)
    );

    if (sort === "low") list.sort((a, b) => a.price - b.price);
    if (sort === "high") list.sort((a, b) => b.price - a.price);

    $("productGrid").innerHTML = list.map(p => `
      <article class="product-card">
        <div class="product-art" style="background:radial-gradient(circle,${safe(p.colors[0])},${safe(p.colors[1])})">
          <div class="book-cover" style="background:linear-gradient(145deg,${safe(p.colors[0])},${safe(p.colors[1])})">
            <small>${safe(config.storeName || "OTAKUSHELF")}</small>
            <span class="symbol">${safe(p.icon || "✦")}</span>
            <strong>${safe(p.title)}</strong>
            <small>BOOK • MANGA • STORY</small>
          </div>
        </div>
        <div class="product-info">
          <span class="category">${safe(p.category)}</span>
          <h3>${safe(p.title)}</h3>
          <p class="author">${safe(p.author)}</p>
          <div class="product-bottom">
            <strong>${money(p.price)}</strong>
            <button class="add-button" data-add="${safe(p.id)}" ${p.stock < 1 ? "disabled" : ""}>
              ${p.stock < 1 ? "Sold out" : "Add to cart +"}
            </button>
          </div>
        </div>
      </article>
    `).join("");

    $("emptyState").hidden = list.length > 0;
  }

  function renderCart() {
    $("cartCount").textContent = quantity();
    const entries = Object.entries(cart).filter(([id, n]) => getProduct(id) && n > 0);

    $("cartItems").innerHTML = entries.length ? entries.map(([id, n]) => {
      const p = getProduct(id);
      return `
        <div class="cart-line">
          <strong>${safe(p.title)}</strong>
          <p>${money(p.price)} each</p>
          <div class="quantity-controls">
            <button data-qty="${safe(id)}" data-delta="-1">−</button>
            <span>${n}</span>
            <button data-qty="${safe(id)}" data-delta="1" ${n >= p.stock ? "disabled" : ""}>+</button>
            <button data-remove="${safe(id)}">Remove</button>
          </div>
        </div>
      `;
    }).join("") : "<p>Your cart is empty.</p>";

    $("cartSubtotal").textContent = money(subtotal());
  }

  function openCart() {
    $("cartDrawer").classList.add("open");
    $("cartDrawer").setAttribute("aria-hidden", "false");
    $("drawerBackdrop").hidden = false;
  }

  function closeCart() {
    $("cartDrawer").classList.remove("open");
    $("cartDrawer").setAttribute("aria-hidden", "true");
    $("drawerBackdrop").hidden = true;
  }

  $("productGrid").addEventListener("click", e => {
    const button = e.target.closest("[data-add]");
    if (!button) return;

    const p = getProduct(button.dataset.add);
    if (!p || p.stock < 1) return;

    const next = (cart[p.id] || 0) + 1;
    if (next > p.stock) {
      alert("The selected quantity exceeds available sample stock.");
      return;
    }

    cart[p.id] = next;
    saveCart();
    renderCart();
    button.textContent = "Added ✓";
  });

  $("cartItems").addEventListener("click", e => {
    const qButton = e.target.closest("[data-qty]");
    const removeButton = e.target.closest("[data-remove]");

    if (removeButton) delete cart[removeButton.dataset.remove];

    if (qButton) {
      const id = qButton.dataset.qty;
      const next = (cart[id] || 0) + Number(qButton.dataset.delta);
      const p = getProduct(id);

      if (next <= 0) delete cart[id];
      else if (p && next <= p.stock) cart[id] = next;
    }

    saveCart();
    renderCart();
  });

  $("cartOpen").addEventListener("click", openCart);
  $("cartClose").addEventListener("click", closeCart);
  $("drawerBackdrop").addEventListener("click", closeCart);

  ["searchInput", "categoryFilter", "sortFilter"].forEach(id => {
    $(id).addEventListener(id === "searchInput" ? "input" : "change", renderProducts);
  });

  $("checkoutButton").addEventListener("click", () => {
    $("checkoutError").textContent = "";

    const entries = Object.entries(cart).filter(([id, n]) => getProduct(id) && n > 0);
    const name = $("customerName").value.trim();
    const phone = $("customerPhone").value.trim();
    const address = $("customerAddress").value.trim();
    const payment = $("paymentMethod").value;

    if (!entries.length) {
      $("checkoutError").textContent = "Your cart is empty.";
      return;
    }

    if (!name || !phone || !address) {
      $("checkoutError").textContent = "Enter your name, phone number and delivery address.";
      return;
    }

    if (phone.replace(/\D/g, "").length < 10) {
      $("checkoutError").textContent = "Enter a valid phone number.";
      return;
    }

    const lines = entries.map(([id, n]) =>
      `• ${getProduct(id).title} × ${n} — ${money(getProduct(id).price * n)}`
    ).join("\n");

    const message = `${config.storeName || "OtakuShelf"} — ORDER REQUEST

Customer: ${name}
Phone: ${phone}
Delivery address: ${address}

Items:
${lines}

Subtotal (shipping excluded): ${money(subtotal())}
Preferred payment: ${payment}

Please confirm stock, delivery cost, final total and payment instructions.`;

    const whatsapp = String(config.whatsappNumber || "").replace(/\D/g, "");

    if (!whatsapp || whatsapp.includes("XXXXXXXXXX") || whatsapp.length < 10) {
      $("checkoutError").textContent = "Add your WhatsApp number in products.js first.";
      return;
    }

    window.open(
      `https://wa.me/${whatsapp}?text=${encodeURIComponent(message)}`,
      "_blank"
    );
  });

  $("year").textContent = new Date().getFullYear();
  renderProducts();
  renderCart();
})();
      
