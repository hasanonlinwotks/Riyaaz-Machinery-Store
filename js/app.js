const SHEET_API = "https://script.google.com/macros/s/AKfycbxyRXFgQMeAhToyWeXtclLZG41HXePp3vzuxzqILcpbEHHycOWNed6IyzCF7yulKJqe/exec";
const WHATSAPP_NUMBER = "919627311086";

let products = [];
let cart = JSON.parse(localStorage.getItem("riyaaz_cart") || "[]");

document.addEventListener("DOMContentLoaded", () => {
  updateCartUI();
  loadProducts();
});

function money(n) {
  return "₹" + Number(n || 0).toLocaleString("en-IN");
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[c]));
}

function imageUrl(url) {
  if (!url) return "";
  let u = String(url).trim();

  // GitHub blob URL -> raw URL
  u = u.replace("https://github.com/", "https://raw.githubusercontent.com/")
       .replace("/blob/", "/");

  // GitHub raw URL -> jsDelivr fallback is handled only after load failure.
  return u;
}

function fallbackImage(img) {
  const original = img.dataset.original || "";
  if (original.includes("github.com/") && !original.includes("raw.githubusercontent.com")) {
    img.src = original.replace("https://github.com/", "https://raw.githubusercontent.com/")
                       .replace("/blob/", "/");
    return;
  }
  if (original.includes("raw.githubusercontent.com/")) {
    img.src = original.replace("https://raw.githubusercontent.com/", "https://cdn.jsdelivr.net/gh/");
    return;
  }
  img.style.display = "none";
}

async function loadProducts() {
  const grid = document.getElementById("grid");
  if (!grid) return;
  grid.innerHTML = '<div class="loading">Loading products...</div>';

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(SHEET_API + "?t=" + Date.now(), {
      method: "GET",
      mode: "cors",
      cache: "no-store",
      redirect: "follow",
      signal: controller.signal,
      headers: { "Accept": "application/json,text/plain,*/*" }
    });
    clearTimeout(timeout);

    if (!response.ok) throw new Error("Google Sheet API HTTP " + response.status);

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      console.error("Google Sheet returned non-JSON:", text.slice(0, 500));
      throw new Error("Google Sheet API ne JSON data nahi diya.");
    }

    // Apps Script may return either an array or {products:[...]}
    const raw = Array.isArray(data) ? data : (Array.isArray(data.products) ? data.products : []);

    // Normalize column names so small changes in Sheet headers don't break the site.
    products = raw.map((p, index) => ({
      id: p.id ?? p.ID ?? index + 1,
      name: p.name ?? p.Name ?? "Product",
      description: p.description ?? p.Description ?? "",
      price: p.price ?? p.Price ?? 0,
      old_price: p.old_price ?? p.oldPrice ?? p.Old_Price ?? p.OldPrice ?? "",
      tag: p.tag ?? p.Tag ?? "",
      rating: p.rating ?? p.Rating ?? "",
      ratings: p.ratings ?? p.Ratings ?? 0,
      image: p.image ?? p.Image ?? ""
    }));

    if (!products.length) throw new Error("Google Sheet se 0 products mile.");

    console.log("Google Sheet Products:", products);
    renderProducts();
  } catch (err) {
    console.error("Google Sheet API Error:", err);
    const message = err.name === "AbortError"
      ? "Google Sheet response bahut late aa raha hai."
      : (err.message || "Unknown error");
    grid.innerHTML = `
      <div class="error">
        <h3>Products load nahi ho rahe</h3>
        <p>Google Sheet connection mein problem hai.</p>
        <small style="display:block;margin:10px 0;color:#777">${esc(message)}</small>
        <button class="btn" onclick="loadProducts()">↻ Retry</button>
      </div>`;
  }
}
function renderProducts() {
  const grid = document.getElementById("grid");
  grid.innerHTML = products.map(p => {
    const image = imageUrl(p.image);
    return `
      <article class="product-card" onclick="openProductModal(${Number(p.id)})">
        <div class="product-image">
          ${p.tag ? `<span class="tag">${esc(p.tag)}</span>` : ""}
          ${image ? `<img src="${esc(image)}" data-original="${esc(p.image || "")}" alt="${esc(p.name)}" onerror="fallbackImage(this)">` : ""}
        </div>
        <div class="product-body">
          <h3>${esc(p.name)}</h3>
          <p>${esc(p.description)}</p>
          <div><span class="price">${money(p.price)}</span>${p.old_price ? `<span class="old">${money(p.old_price)}</span>` : ""}</div>
          <div class="rating">★ ${esc(p.rating || "—")} · ${esc(p.ratings || 0)} ratings</div>
          <div class="card-actions">
            <button class="btn secondary" onclick="event.stopPropagation();openProductModal(${Number(p.id)})">View Details</button>
            <button class="btn" onclick="event.stopPropagation();addToCart(${Number(p.id)})">Add to Cart</button>
          </div>
        </div>
      </article>`;
  }).join("");
}

function openProductModal(id) {
  const p = products.find(x => Number(x.id) === Number(id));
  if (!p) return;

  const image = imageUrl(p.image);
  document.getElementById("productDetail").innerHTML = `
    <div class="detail">
      <div class="detail-img">
        ${image ? `<img src="${esc(image)}" data-original="${esc(p.image || "")}" alt="${esc(p.name)}" onerror="fallbackImage(this)">` : "<span>No image</span>"}
      </div>
      <div class="detail-info">
        ${p.tag ? `<span class="tag">${esc(p.tag)}</span>` : ""}
        <h3>${esc(p.name)}</h3>
        <p>${esc(p.description)}</p>
        <div class="rating">★ ${esc(p.rating || "—")} · ${esc(p.ratings || 0)} ratings</div>
        <div class="detail-price">${money(p.price)} ${p.old_price ? `<span class="old">${money(p.old_price)}</span>` : ""}</div>
        <p><b>Prepaid Offer:</b> Flat 10% OFF on Prepaid</p>
        <button class="btn full" onclick="addToCart(${Number(p.id)});closeProductModal()">Add to Cart</button>
        <a class="btn wa full" href="${whatsappProductLink(p)}" target="_blank" rel="noopener">Ask on WhatsApp</a>
      </div>
    </div>`;

  const modal = document.getElementById("productModal");
  modal.classList.add("show");
  modal.setAttribute("aria-hidden", "false");
}

function closeProductModal() {
  const modal = document.getElementById("productModal");
  modal.classList.remove("show");
  modal.setAttribute("aria-hidden", "true");
}

function whatsappProductLink(p) {
  const text = `Hello Riyaaz Machinery Store,%0A%0AI want details about:%0A*${encodeURIComponent(p.name || "")}*%0APrice: ${encodeURIComponent(money(p.price))}`;
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${text}`;
}

function addToCart(id) {
  const p = products.find(x => Number(x.id) === Number(id));
  if (!p) return;

  const existing = cart.find(x => Number(x.id) === Number(id));
  if (existing) existing.qty = Number(existing.qty || 1) + 1;
  else cart.push({...p, qty: 1});

  saveCart();
  openCart();
}

function changeQty(id, delta) {
  const item = cart.find(x => Number(x.id) === Number(id));
  if (!item) return;
  item.qty = Number(item.qty || 1) + delta;
  if (item.qty <= 0) cart = cart.filter(x => Number(x.id) !== Number(id));
  saveCart();
}

function removeFromCart(id) {
  cart = cart.filter(x => Number(x.id) !== Number(id));
  saveCart();
}

function saveCart() {
  localStorage.setItem("riyaaz_cart", JSON.stringify(cart));
  updateCartUI();
}

function updateCartUI() {
  const count = cart.reduce((sum, x) => sum + Number(x.qty || 1), 0);
  document.getElementById("count").textContent = count;

  const items = document.getElementById("cartItems");
  if (!cart.length) {
    items.innerHTML = '<p style="color:#66756d">Your cart is empty.</p>';
    document.getElementById("total").textContent = "Total: ₹0";
    return;
  }

  let total = 0;
  items.innerHTML = cart.map(item => {
    const qty = Number(item.qty || 1);
    const amount = Number(item.price || 0) * qty;
    total += amount;
    const image = imageUrl(item.image);

    return `
      <div class="cart-item">
        ${image ? `<img src="${esc(image)}" data-original="${esc(item.image || "")}" alt="" onerror="fallbackImage(this)">` : "<div></div>"}
        <div>
          <b>${esc(item.name)}</b>
          <div>${money(item.price)}</div>
          <div class="qty">
            <button onclick="changeQty(${Number(item.id)},-1)">−</button>
            <b>${qty}</b>
            <button onclick="changeQty(${Number(item.id)},1)">+</button>
            <button class="remove" onclick="removeFromCart(${Number(item.id)})">Remove</button>
          </div>
        </div>
        <b>${money(amount)}</b>
      </div>`;
  }).join("");

  document.getElementById("total").textContent = "Total: " + money(total);
}

function openCart() {
  document.getElementById("cart").classList.add("open");
  document.getElementById("shade").classList.add("open");
}

function closeCart() {
  document.getElementById("cart").classList.remove("open");
  document.getElementById("shade").classList.remove("open");
}

function sendOrder() {
  if (!cart.length) {
    alert("Please add at least one product to cart.");
    return;
  }

  const name = document.getElementById("name").value.trim();
  const mobile = document.getElementById("mobile").value.trim();
  const address = document.getElementById("address").value.trim();

  if (!name) return alert("Please enter your name.");
  if (!mobile) return alert("Please enter your mobile number.");
  if (!address) return alert("Please enter your address.");

  let total = 0;
  let lines = ["🛒 *NEW ORDER - RIYAAZ MACHINERY STORE*", "━━━━━━━━━━━━━━━━━━", "", "👤 *Customer Details*", `Name: ${name}`, `Mobile: ${mobile}`, `Address: ${address}`, "", "📦 *Order Details*", "━━━━━━━━━━━━━━━━━━"];

  cart.forEach((item, i) => {
    const qty = Number(item.qty || 1);
    const amount = Number(item.price || 0) * qty;
    total += amount;
    lines.push(`${i + 1}. *${item.name}*`, `Price: ${money(item.price)}`, `Qty: ${qty}`, `Amount: ${money(amount)}`, "");
  });

  lines.push("━━━━━━━━━━━━━━━━━━", `💰 *TOTAL: ${money(total)}*`, "", "Please confirm my order. 🙏");

  const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(lines.join("\n"))}`;

  // Use location navigation so normal browsers do not block it as a popup.
  window.location.href = url;
}

document.addEventListener("keydown", e => {
  if (e.key === "Escape") {
    closeProductModal();
    closeCart();
  }
});
