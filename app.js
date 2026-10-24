document.addEventListener("DOMContentLoaded", () => {
  const config = window.STORE_CONFIG || {};
  const products = window.PRODUCTS || [];

  const $ = (id) => document.getElementById(id);

  const searchInput = $("searchInput");
  const categoryFilter = $("categoryFilter");
  const sortFilter = $("sortFilter");
  const productGrid = $("productGrid");
  const emptyState = $("emptyState");

  const cartCount = $("cartCount");
  const cartItems = $("cartItems");
  const cartSubtotal = $("cartSubtotal");
  const cartDrawer = $("cartDrawer");
  const drawerBackdrop = $("drawerBackdrop");
  const cartOpen = $("cartOpen");
  const cartClose = $("cartClose");
  const checkoutButton = $("checkoutButton");
  const checkoutError = $("checkoutError");

  const customerName = $("customerName");
  const customerPhone = $("customerPhone");
  const customerAddress = $("customerAddress");
  const paymentMethod = $("paymentMethod");

  const money = (amount) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: config.currency || "INR",
      maximumFractionDigits: 0
    }).format(amount);

  // Cart format: { productId: quantity }
  let cart = {};

  try {
    cart = JSON.parse(localStorage.getItem("otakushelf-cart")) || {};
  } catch {
    cart = {};
  }

  function saveCart() {
    localStorage.setItem("otakushelf-cart", JSON.stringify(cart));
  }

  function getProduct(id) {
    return products.find((product) => product.id === id);
  }

  function getCartQuantity(id) {
    return Number(cart[id]) || 0;
  }

  function getCartTotal() {
    return Object.entries(cart).reduce((total, [id, quantity]) => {
      const product = getProduct(id);
      return product
        ? total + product.price * quantity
        : total;
    }, 0);
  }

  function getCartCount() {
    return Object.values(cart).reduce(
      (total, quantity) => total + (Number(quantity) || 0),
      0
    );
  }

  function escapeHTML(value = "") {
    return String(value).replace(/[&<>"']/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[character]);
  }

  function populateGenres() {
    if (!categoryFilter) return;

    const genres = [
      ...new Set(
        products.flatMap((product) =>
          product.genres || [product.category].filter(Boolean)
        )
      )
    ].sort((a, b) => a.localeCompare(b));

    categoryFilter.innerHTML =
      '<option value="">All genres</option>' +
      genres.map((genre) =>
        `<option value="${escapeHTML(genre)}">${escapeHTML(genre)}</option>`
      ).join("");
  }

  function getFilteredProducts() {
    const search = (searchInput?.value || "")
      .trim()
      .toLowerCase();

    const genre = categoryFilter?.value || "";
    const sort = sortFilter?.value || "";

    let result = products.filter((product) => {
      const searchableText = [
        product.title,
        product.series,
        product.author,
        product.illustrator,
        product.publisher,
        product.isbn,
        product.category,
        ...(product.genres || [])
      ].filter(Boolean).join(" ").toLowerCase();

      const matchesSearch = searchableText.includes(search);

      const productGenres =
        product.genres || [product.category].filter(Boolean);

      const matchesGenre = !genre || productGenres.includes(genre);

      return matchesSearch && matchesGenre;
    });

    if (sort === "price-low") {
      result.sort((a, b) => a.price - b.price);
    } else if (sort === "price-high") {
      result.sort((a, b) => b.price - a.price);
    } else if (sort === "name") {
      result.sort((a, b) => a.title.localeCompare(b.title));
    }

    return result;
  }

  function renderProducts() {
    if (!productGrid) return;

    const filteredProducts = getFilteredProducts();

    if (emptyState) {
      emptyState.hidden = filteredProducts.length !== 0;
    }

    productGrid.innerHTML = filteredProducts.map((product) => {
      const genres = product.genres || [product.category].filter(Boolean);
      const outOfStock = Number(product.stock) <= 0;

      const imageHTML = product.image
        ? `<img
            class="real-book-cover"
            src="${escapeHTML(product.image)}"
            alt="${escapeHTML(product.title)} cover"
            loading="lazy"
            onerror="this.style.display='none';this.nextElementSibling.hidden=false"
          >
          <div class="book-cover-placeholder" hidden>
            <span>${escapeHTML(product.series || product.title)}</span>
            <small>Cover unavailable</small>
          </div>`
        : `<div class="book-cover-placeholder">
            <span>${escapeHTML(product.series || product.title)}</span>
            <small>Cover unavailable</small>
          </div>`;

      return `
        <article class="product-card">
          <a
            class="product-image-link"
            href="${escapeHTML(product.productUrl || "#")}"
            ${product.productUrl ? 'target="_blank" rel="noopener noreferrer"' : ""}
            aria-label="View ${escapeHTML(product.title)} details"
          >
            <div class="product-image">${imageHTML}</div>
          </a>

          <div class="product-info">
            <div class="product-genres">
              ${genres.map((item) =>
                `<span>${escapeHTML(item)}</span>`
              ).join("")}
            </div>

            <h3>${escapeHTML(product.title)}</h3>

            <p class="product-author">
              By ${escapeHTML(product.author || "Author not listed")}
            </p>

            ${product.illustrator ? `
              <p class="product-detail">
                Illustrator: ${escapeHTML(product.illustrator)}
              </p>` : ""}

            ${product.volume ? `
              <p class="product-detail">
                Volume ${escapeHTML(product.volume)}
              </p>` : ""}

            ${product.isbn ? `
              <p class="product-detail">
                ISBN: ${escapeHTML(product.isbn)}
              </p>` : ""}

            <div class="product-price">${money(product.price)}</div>

            <p class="stock-status">
              ${outOfStock ? "Out of stock" : `${product.stock} available`}
            </p>

            <button
              class="add-to-cart"
              data-add="${escapeHTML(product.id)}"
              ${outOfStock ? "disabled" : ""}
            >
              ${outOfStock ? "Out of stock" : "Add to cart"}
            </button>
          </div>
        </article>
      `;
    }).join("");
  }

  function renderCart() {
    if (cartCount) {
      cartCount.textContent = getCartCount();
    }

    if (cartSubtotal) {
      cartSubtotal.textContent = money(getCartTotal());
    }

    if (!cartItems) return;

    const entries = Object.entries(cart)
      .filter(([id, quantity]) => getProduct(id) && quantity > 0);

    if (!entries.length) {
      cartItems.innerHTML = "<p>Your cart is empty.</p>";
      return;
    }

    cartItems.innerHTML = entries.map(([id, quantity]) => {
      const product = getProduct(id);

      return `
        <div class="cart-item">
          <div class="cart-item-info">
            <strong>${escapeHTML(product.title)}</strong>
            <span>${money(product.price)} each</span>
            <span>Subtotal: ${money(product.price * quantity)}</span>
          </div>

          <div class="cart-quantity">
            <button data-change="${escapeHTML(id)}" data-delta="-1"
              aria-label="Decrease quantity">−</button>
            <span>${quantity}</span>
            <button data-change="${escapeHTML(id)}" data-delta="1"
              aria-label="Increase quantity"
              ${quantity >= product.stock ? "disabled" : ""}>+</button>
          </div>

          <button class="remove-item" data-remove="${escapeHTML(id)}">
            Remove
          </button>
        </div>
      `;
    }).join("");
  }

  function addToCart(id) {
    const product = getProduct(id);
    if (!product) return;

    const currentQuantity = getCartQuantity(id);

    if (currentQuantity >= Number(product.stock)) {
      alert("You cannot add more than the available stock.");
      return;
    }

    cart[id] = currentQuantity + 1;
    saveCart();
    renderCart();
  }

  function changeQuantity(id, delta) {
    const product = getProduct(id);
    if (!product) return;

    const nextQuantity = getCartQuantity(id) + delta;

    if (nextQuantity <= 0) {
      delete cart[id];
    } else if (nextQuantity <= Number(product.stock)) {
      cart[id] = nextQuantity;
    }

    saveCart();
    renderCart();
  }

  function removeFromCart(id) {
    delete cart[id];
    saveCart();
    renderCart();
  }

  function openCart() {
    cartDrawer?.classList.add("is-open");
    drawerBackdrop?.classList.add("is-visible");
    cartDrawer?.setAttribute("aria-hidden", "false");
  }

  function closeCart() {
    cartDrawer?.classList.remove("is-open");
    drawerBackdrop?.classList.remove("is-visible");
    cartDrawer?.setAttribute("aria-hidden", "true");
  }

  function checkout() {
    if (checkoutError) checkoutError.textContent = "";

    const items = Object.entries(cart)
      .filter(([id, quantity]) => getProduct(id) && quantity > 0);

    if (!items.length) {
      if (checkoutError) checkoutError.textContent = "Your cart is empty.";
      return;
    }

    const name = customerName?.value.trim() || "";
    const phone = customerPhone?.value.trim() || "";
    const address = customerAddress?.value.trim() || "";

    if (!name || !phone || !address) {
      if (checkoutError) {
        checkoutError.textContent =
          "Enter your name, phone number and delivery address.";
      }
      return;
    }

    const orderLines = items.map(([id, quantity]) => {
      const product = getProduct(id);
      return `${product.title} x ${quantity} = ${money(product.price * quantity)}`;
    });

    const message = [
      `New order request — ${config.storeName || "OtakuShelf"}`,
      "",
      `Customer: ${name}`,
      `Phone: ${phone}`,
      `Address: ${address}`,
      `Payment preference: ${paymentMethod?.value || "Not selected"}`,
      "",
      "Items:",
      ...orderLines,
      "",
      `Subtotal: ${money(getCartTotal())}`,
      "",
      "Please confirm stock, delivery charges and final total."
    ].join("\n");

    const whatsappNumber = String(config.whatsappNumber || "")
      .replace(/\D/g, "");

    if (!whatsappNumber || whatsappNumber.endsWith("XXXXXXXXXX")) {
      if (checkoutError) {
        checkoutError.textContent =
          "Store owner: configure your WhatsApp number in products.js first.";
      }
      return;
    }

    const url = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  // Product-grid event delegation
  productGrid?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-add]");
    if (button) addToCart(button.dataset.add);
  });

  cartItems?.addEventListener("click", (event) => {
    const changeButton = event.target.closest("[data-change]");
    const removeButton = event.target.closest("[data-remove]");

    if (changeButton) {
      changeQuantity(
        changeButton.dataset.change,
        Number(changeButton.dataset.delta)
      );
    }

    if (removeButton) {
      removeFromCart(removeButton.dataset.remove);
    }
  });

  searchInput?.addEventListener("input", renderProducts);
  categoryFilter?.addEventListener("change", renderProducts);
  sortFilter?.addEventListener("change", renderProducts);

  cartOpen?.addEventListener("click", openCart);
  cartClose?.addEventListener("click", closeCart);
  drawerBackdrop?.addEventListener("click", closeCart);
  checkoutButton?.addEventListener("click", checkout);

  const year = $("year");
  if (year) year.textContent = new Date().getFullYear();

  populateGenres();
  renderProducts();
  renderCart();
});
      
