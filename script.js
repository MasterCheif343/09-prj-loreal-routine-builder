/* Get references to DOM elements */
const categoryFilter = document.getElementById("categoryFilter");
const productsContainer = document.getElementById("productsContainer");
const chatForm = document.getElementById("chatForm");
const chatWindow = document.getElementById("chatWindow");
const selectedProductsList = document.getElementById("selectedProductsList");
const generateRoutineButton = document.getElementById("generateRoutine");
const clearProductsButton = document.getElementById("clearProducts");
const userInput = document.getElementById("userInput");

/* Show initial placeholder until user selects a category */
productsContainer.innerHTML = `
  <div class="placeholder-message">
    Select a category to view products
  </div>
`;

/* Load product data from JSON file */
async function loadProducts() {
  const response = await fetch("products.json");
  const data = await response.json();
  return data.products;
}

/* Create HTML for displaying product cards */
function displayProducts(products) {
  productsContainer.innerHTML = products
    .map(
      (product) => {
        const isExpanded = expandedProductIds.includes(product.id);

        return `
    <div class="product-card ${isProductSelected(product.id) ? "selected" : ""}"
      data-product-id="${product.id}"
      role="group"
      tabindex="0"
      aria-label="${product.name}. ${isProductSelected(product.id) ? "Selected" : "Not selected"}">
      <img src="${product.image}" alt="${product.name}">
      <div class="product-info">
        <h3>${product.name}</h3>
        <p>${product.brand}</p>
        <button class="description-toggle" type="button"
          aria-expanded="${isExpanded}"
          aria-controls="description-${product.id}">
          ${isExpanded ? "Hide description" : "View description"}
        </button>
        <p id="description-${product.id}" class="product-description"
          ${isExpanded ? "" : 'hidden'}>
          ${product.description}
        </p>
      </div>
    </div>
  `;
      }
    )
    .join("");
}

/* Toggle a product description without changing its selected state */
function toggleProductDescription(productId) {
  if (expandedProductIds.includes(productId)) {
    expandedProductIds = expandedProductIds.filter(
      (expandedId) => expandedId !== productId
    );
  } else {
    expandedProductIds.push(productId);
  }

  displayProducts(visibleProducts);
}

/* Keep all selected products so they stay selected when changing categories */
let selectedProducts = [];
let visibleProducts = [];
let expandedProductIds = [];
const workerUrl =
  "https://loreal-product-helper.adamkrenek-atwork.workers.dev";
let messages = [
  {
    role: "system",
    content:
      "You are L'Oréal's Smart Product-Aware Routine Builder. Help only with L'Oréal products, skincare, makeup, haircare, fragrance, beauty routines, and beauty-related recommendations. Stay focused on the user's generated routine or selected products.",
  },
];

/* Save the selected products in localStorage */
function saveSelectedProducts() {
  localStorage.setItem(
    "selectedLorealProducts",
    JSON.stringify(selectedProducts)
  );
}

/* Restore saved products after the page reloads */
async function restoreSelectedProducts() {
  const savedProducts = localStorage.getItem("selectedLorealProducts");

  if (!savedProducts) {
    displaySelectedProducts();
    return;
  }

  try {
    selectedProducts = JSON.parse(savedProducts);
  } catch (error) {
    selectedProducts = [];
    localStorage.removeItem("selectedLorealProducts");
  }

  displaySelectedProducts();
}

/* Check whether a product is already in the selected products array */
function isProductSelected(productId) {
  return selectedProducts.some((product) => product.id === productId);
}

/* Add or remove a product when a card is clicked */
function toggleProductSelection(productId) {
  const selectedProduct = selectedProducts.find(
    (product) => product.id === productId
  );

  if (selectedProduct) {
    selectedProducts = selectedProducts.filter(
      (product) => product.id !== productId
    );
  } else {
    const productToAdd = visibleProducts.find(
      (product) => product.id === productId
    );
    if (productToAdd) {
      selectedProducts.push(productToAdd);
    }
  }

  displayProducts(visibleProducts);
  displaySelectedProducts();
  saveSelectedProducts();
}

/* Show selected products in the list and add remove buttons */
function displaySelectedProducts() {
  if (selectedProducts.length === 0) {
    selectedProductsList.innerHTML =
      '<p class="selected-placeholder">No products selected yet</p>';
    return;
  }

  selectedProductsList.innerHTML = selectedProducts
    .map(
      (product) => `
    <div class="selected-product-item">
      <span>${product.brand} - ${product.name}</span>
      <button class="remove-product" data-product-id="${product.id}" type="button"
        aria-label="Remove ${product.name}">
        <i class="fa-solid fa-xmark"></i>
      </button>
    </div>
  `
    )
    .join("");
}

/* Handle clicks on product cards */
productsContainer.addEventListener("click", (e) => {
  const descriptionButton = e.target.closest(".description-toggle");
  if (descriptionButton) {
    const productCard = descriptionButton.closest(".product-card");
    toggleProductDescription(Number(productCard.dataset.productId));
    return;
  }

  const productCard = e.target.closest(".product-card");
  if (productCard) {
    toggleProductSelection(Number(productCard.dataset.productId));
  }
});

/* Allow keyboard users to select or unselect a card */
productsContainer.addEventListener("keydown", (e) => {
  if (e.target.closest(".description-toggle")) {
    return;
  }

  if (e.key === "Enter" || e.key === " ") {
    const productCard = e.target.closest(".product-card");
    if (productCard) {
      e.preventDefault();
      toggleProductSelection(Number(productCard.dataset.productId));
    }
  }
});

/* Handle clicks on remove buttons in the selected products list */
selectedProductsList.addEventListener("click", (e) => {
  const removeButton = e.target.closest(".remove-product");
  if (removeButton) {
    toggleProductSelection(Number(removeButton.dataset.productId));
  }
});

/* Remove every saved product at once */
clearProductsButton.addEventListener("click", () => {
  selectedProducts = [];
  saveSelectedProducts();
  displayProducts(visibleProducts);
  displaySelectedProducts();
});

/* Filter and display products when category changes */
categoryFilter.addEventListener("change", async (e) => {
  const products = await loadProducts();
  const selectedCategory = e.target.value;

  /* filter() creates a new array containing only products 
     where the category matches what the user selected */
  const filteredProducts = products.filter(
    (product) => product.category === selectedCategory
  );

  visibleProducts = filteredProducts;
  displayProducts(filteredProducts);
});

/* Send one message to the worker and keep the conversation history */
async function sendChatMessage(messageText, visibleText = messageText) {
  if (!messageText.trim()) {
    return;
  }

  const userMessage = {
    role: "user",
    content: messageText,
  };

  messages.push(userMessage);
  displayChatMessage("user", visibleText);

  const loadingMessage = displayChatMessage("assistant", "Thinking...");

  try {
    const response = await fetch(workerUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ messages }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || "The routine service is unavailable.");
    }

    const assistantReply = data.choices?.[0]?.message?.content;

    if (!assistantReply) {
      throw new Error("The routine service returned an unexpected response.");
    }

    messages.push({
      role: "assistant",
      content: assistantReply,
    });

    loadingMessage.textContent = assistantReply;
  } catch (error) {
    loadingMessage.textContent =
      "Sorry, I could not reach the routine service. " + error.message;
  }
}

/* Add a message safely to the chat window */
function displayChatMessage(role, text) {
  const messageElement = document.createElement("div");
  messageElement.className = `chat-message ${role}`;
  messageElement.textContent = text;
  chatWindow.appendChild(messageElement);
  chatWindow.scrollTop = chatWindow.scrollHeight;
  return messageElement;
}

/* Generate a routine from the selected products */
generateRoutineButton.addEventListener("click", async () => {
  if (selectedProducts.length === 0) {
    displayChatMessage("assistant", "Please select at least one product first.");
    return;
  }

  const productDetails = selectedProducts
    .map(
      (product) =>
        `${product.brand} ${product.name}: ${product.description}`
    )
    .join("\n");

  const routineRequest =
    "Create a personalized beauty routine using these selected products:\n" +
    productDetails +
    "\nExplain the order to use them and include a short summary.";

  await sendChatMessage(routineRequest, "Please create my personalized routine.");
});

/* Handle follow-up questions in the chatbox */
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const messageText = userInput.value;
  userInput.value = "";
  await sendChatMessage(messageText);
});

/* Start with an empty selected products list */
displaySelectedProducts();
restoreSelectedProducts();
