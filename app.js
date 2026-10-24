(() => {
  "use strict";

  const $ = id => document.getElementById(id);
  const products = window.PRODUCTS || [];
  const config = window.STORE_CONFIG || {};

  const money = n => new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(n);

  const escapeHTML = value => String(value ?? "").replace(
    /[&<>"']/g,
    c => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;",
      '"': "&quot;", "'": "&#39;"
    })[c]
  );

  let cart = {};

  try {
    cart = JSON.parse(localStorage.getItem("otakushelf-cart") || "{}");
    if (!cart || typeof cart !== "object" || Array.isArray(cart)) cart = {};
  } catch {
    cart = {};
  }

  // Keep only valid product IDs and safe integer quantities.
  cart = Object.fromEntries(
    Object.entries(cart).filter(([id, quantity]) => {
      const p = products.find(book => book.id === id);
      return p && Number.isSafeInteger(quantity) &&
        quantity > 0 && quantity <= p.stock;
    })
  );

  const getProduct = id => products.find(p => p.id === id);

  const cartQuantity = () =>
    Object.values(cart).reduce((sum, n) => sum + n, 0);

  const subtotal = () =>
    Object.entries(cart).reduce((sum, [id, n]) => {
      const p = getProduct(id);
      return sum + (p ? p.price * n : 0);
    }, 0);

  function saveCart() {
    try {
      localStorage.setItem("otakushelf-cart", JSON.stringify(cart));
    } catch {
      // The cart still works during this page session.
    }
  }

  function productCard(p) {
    return `
      <article class="product-card" data-product="${escapeHTML(p.id)}">
        <div class="cover-wrap">
          <div class="cover-placeholder" id="placeholder-${escapeHTML(p.id)}">
            <span>漫</span>
            <strong>${escapeHTML(p.title)}</strong>
            <small>SEARCHING FOR COVER…</small>
          </div>
          <img id="cover-${escapeHTML(p.id)}"
               alt="${escapeHTML(p.title)} book cover"
               loading="lazy" hidden>
        </div>
        <div class="product-info">
          <span class="genre-tag">${escapeHTML(p.category)}</span>
          <h3>${escapeHTML(p.title)}</h3>
          <p class="product-author">By ${escapeHTML(p.author)}</p>
          <div class="product-price">${money(p.price)}</div>
          <button class="add-button" type="button"
                  data-add="${escapeHTML(p.id)}"
                  ${p.stock < 1 ? "disabled" : ""}>
            ${p.stock < 1 ? "Sold out" : "Add to bag +"}
          </button>
        </div>
      </article>
    `;
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
    if (sort === "name") list.sort((a, b) => a.title.localeCompare(b.title));

    $("productGrid").innerHTML = list.map(productCard).join("");
    $("emptyState").hidden = list.length > 0;
    $("resultsCount").textContent =
      `${list.length} ${list.length === 1 ? "title" : "titles"} found`;

    // Reuse any cover URLs already discovered.
    list.forEach(p => {
      if (p.image) showCover(p, p.image);
    });
  }

  function showCover(product, url) {
    const img = $(`cover-${product.id}`);
    const placeholder = $(`placeholder-${product.id}`);
    if (!img || !placeholder) return;

    img.onerror = () => {
      img.hidden = true;
      placeholder.hidden = false;
      placeholder.innerHTML =
        `<span>漫</span><strong>${escapeHTML(product.title)}</strong>` +
        `<small>Cover unavailable</small>`;
    };

    img.onload = () => {
      img.hidden = false;
      placeholder.hidden = true;
    };

    img.src = url;
  }

  // Look up real cover thumbnails online. Some editions may not
  // exist in Google Books; those use the designed placeholder.
  async function lookupCover(product) {
    if (product.image) return;

    const url = "https://www.googleapis.com/books/v1/volumes?q=" +
      encodeURIComponent(product.query) + "&maxResults=5";

    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error("Book search unavailable");

      const data = await response.json();
      const items = data.items || [];

      const match = items.find(item => {
        const info = item.volumeInfo || {};
        return info.imageLinks &&
          (info.imageLinks.thumbnail || info.imageLinks.smallThumbnail);
      });

      if (!match) throw new Error("No cover found");

      const links = match.volumeInfo.imageLinks;
      product.image = (
        links.thumbnail || links.smallThumbnail
      ).replace(/^http:/, "https:").replace(/&amp;/g, "&");

      showCover(product, product.image);
    } catch {
      const placeholder = $(`placeholder-${product.id}`);
      if (placeholder) {
        placeholder.innerHTML =
          `<span>漫</span><strong>${escapeHTML(product.title)}</strong>` +
          `<small>Cover unavailable — check another edition</small>`;
      }
    }
  }

  // Limit simultaneous requests so the store loads more gently.
  async function loadCovers() {
    let index = 0;
    async function worker() {
      while (index < products.length) {
        const product = products[index++];
        await lookupCover(product);
      }
    }
    await Promise.all(Array.from({ length: 4 }, () => worker()));
  }

  function renderCart() {
    $("cartCount").textContent = cartQuantity();

    const entries = Object.entries(cart).filter(([id, n]) =>
      getProduct(id) && n > 0
    );

    $("cartItems").innerHTML = entries.length
      ? entries.map(([id, n]) => {
          const p = getProduct(id);
          return `
            <div class="cart-line">
              <div class="cart-line-top">
                <strong>${escapeHTML(p.title)}</strong>
                <strong>${money(p.price * n)}</strong>
              </div>
              <p>${money(p.price)} each</p>
              <div class="quantity-controls">
                <button type="button" data-qty="${escapeHTML(id)}"
                        data-delta="-1" aria-label="Decrease quantity">−</button>
                <span>${n}</span>
                <button type="button" data-qty="${escapeHTML(id)}"
                        data-delta="1" aria-label="Increase quantity"
                        ${n >= p.stock ? "disabled" : ""}>+</button>
                <button type="button" class="remove-button"
                        data-remove="${escapeHTML(id)}">Remove</button>
              </div>
            </div>
          `;
        }).join("")
      : "<p class='shipping-note'>Your bag is empty. Explore the collection to add manga.</p>";

    $("cartSubtotal").textContent = money(subtotal());
  }

  function openCart() {
    $("cartDrawer").hidden = false;
    $("drawerBackdrop").hidden = false;
    document.body.style.overflow = "hidden";
    $("cartClose").focus();
  }

  function closeCart() {
    $("cartDrawer").hidden = true;
    $("drawerBackdrop").hidden = true;
    document.body.style.overflow = "";
    $("cartOpen").focus();
  }

  $("productGrid").addEventListener("click", event => {
    const button = event.target.closest("[data-add]");
    if (!button) return;

    const p = getProduct(button.dataset.add);
    if (!p || p.stock < 1) return;

    if ((cart[p.id] || 0) >= p.stock) {
      alert("The maximum available quantity is already in your bag.");
      return;
    }

    cart[p.id] = (cart[p.id] || 0) + 1;
    saveCart();
    renderCart();

    const oldText = button.textContent;
    button.textContent = "Added ✓";
    setTimeout(() => {
      if (button.isConnected) button.textContent = oldText;
    }, 1000);
  });

  $("cartItems").addEventListener("click", event => {
    const remove = event.target.closest("[data-remove]");
    const quantityButton = event.target.closest("[data-qty]");

    if (remove) {
      delete cart[remove.dataset.remove];
    } else if (quantityButton) {
      const id = quantityButton.dataset.qty;
      const next = (cart[id] || 0) + Number(quantityButton.dataset.delta);
      const p = getProduct(id);

      if (next <= 0) delete cart[id];
      else if (p && next <= p.stock) cart[id] = next;
    } else {
      return;
    }

    saveCart();
    renderCart();
  });

  $("cartOpen").addEventListener("click", openCart);
  $("cartClose").addEventListener("click", closeCart);
  $("drawerBackdrop").addEventListener("click", closeCart);

  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !$("cartDrawer").hidden) closeCart();
  });

  ["searchInput", "categoryFilter", "sortFilter"].forEach(id => {
    $(id).addEventListener(
      id === "searchInput" ? "input" : "change",
      renderProducts
    );
  });

  // Generate genre choices directly from the catalog.
  [...new Set(products.map(p => p.category))].sort().forEach(category => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    $("categoryFilter").appendChild(option);
  });

  $("checkoutForm").addEventListener("submit", event => {
    event.preventDefault();
    $("checkoutError").textContent = "";

    const entries = Object.entries(cart).filter(([id, n]) =>
      getProduct(id) && n > 0
    );

    if (!entries.length) {
      $("checkoutError").textContent = "Your bag is empty.";
      return;
    }

    const name = $("customerName").value.trim();
    const phone = $("customerPhone").value.trim();
    const address = $("customerAddress").value.trim();
    const digits = phone.replace(/\D/g, "");

    if (!name || !address || digits.length < 10 || digits.length > 15) {
      $("checkoutError").textContent =
        "Enter your name, full address and a valid phone number.";
      return;
    }

    const number = String(config.whatsappNumber || "").replace(/\D/g, "");

    if (!number || number.includes("XXXXXXXXXX") || number.length < 10) {
      $("checkoutError").textContent =
        "Set your real WhatsApp number in config.js first.";
      return;
    }

    const lines = entries.map(([id, n]) => {
      const p = getProduct(id);
      return `- ${p.title} x ${n} = ${money(p.price * n)}`;
    }).join("\n");

    const message = [
      `${config.storeName || "OtakuShelf"} — ORDER REQUEST`,
      "",
      `Customer: ${name}`,
      `Phone: ${phone}`,
      `Address: ${address}`,
      "",
      "Items:",
      lines,
      "",
      `Subtotal (shipping excluded): ${money(subtotal())}`,
      `Preferred payment: ${$("paymentMethod").value}`,
      "",
      "Please confirm stock, shipping cost, final total and payment instructions."
    ].join("\n");

    const whatsappURL =
      `https://wa.me/${number}?text=${encodeURIComponent(message)}`;

    const opened = window.open(whatsappURL, "_blank");

    if (!opened) {
      $("checkoutError").textContent =
        "WhatsApp could not open automatically. Allow pop-ups or open WhatsApp and try again.";
    }
  });

  $("year").textContent = new Date().getFullYear();

  renderProducts();
  renderCart();
  loadCovers();
})();
