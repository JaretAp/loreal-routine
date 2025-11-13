const API_URL = (() => {
  const url = window.APP_SECRETS?.getWorkerUrl?.();
  if (!url) {
    console.error("Missing Cloudflare worker URL. Ensure secrets.js is loaded before script.js.");
    return "";
  }
  if (window.APP_SECRETS?.destroy) {
    window.APP_SECRETS.destroy();
  }
  return url;
})();
const SELECTED_STORAGE_KEY = "loreal-selected-products";
const RTL_STORAGE_KEY = "loreal-rtl-pref";
const ROUTINE_CHARACTER_LIMIT = 1800;
const YES_FOLLOW_UP_PATTERN = /^\s*yes\s*$/i;

const categoryFilter = document.getElementById("categoryFilter");
const productSearchInput = document.getElementById("productSearch");
const productsContainer = document.getElementById("productsContainer");
const selectedProductsList = document.getElementById("selectedProductsList");
const selectedSummary = document.getElementById("selectedSummary");
const clearSelectionsBtn = document.getElementById("clearSelections");
const generateRoutineBtn = document.getElementById("generateRoutine");
const webSearchToggle = document.getElementById("webSearchToggle");
const rtlToggle = document.getElementById("rtlToggle");
const chatForm = document.getElementById("chatForm");
const chatWindow = document.getElementById("chatWindow");
const userInput = document.getElementById("userInput");

const state = {
  allProducts: [],
  filteredProducts: [],
  selectedProducts: new Map(),
  conversationHistory: [],
};

init();

// ---------- Setup & hydration ----------
function init() {
  productsContainer.innerHTML = placeholderTemplate("Select a category or use the search box to view products.");
  attachEventListeners();
  hydrateRtlPreference();
  loadProducts();
}

function attachEventListeners() {
  categoryFilter.addEventListener("change", applyFilters);
  productSearchInput.addEventListener("input", applyFilters);

  productsContainer.addEventListener("click", handleProductCardClick);
  productsContainer.addEventListener("keydown", (event) => {
    if (!event.target.classList.contains("product-card")) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      const cardId = Number(event.target.dataset.productId);
      toggleProductSelection(cardId);
    }
  });

  selectedProductsList.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-remove-id]");
    if (!button) return;
    const productId = Number(button.dataset.removeId);
    toggleProductSelection(productId);
  });

  clearSelectionsBtn.addEventListener("click", () => {
    state.selectedProducts.clear();
    persistSelectedProducts();
    updateSelectionDisplay();
    applyFilters();
  });

  generateRoutineBtn.addEventListener("click", handleRoutineGeneration);
  rtlToggle.addEventListener("change", () => applyRtlPreference(rtlToggle.checked));

  chatForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const message = userInput.value.trim();
    if (!message) return;
    appendChatMessage("user", message);
    userInput.value = "";
    const outboundMessage = YES_FOLLOW_UP_PATTERN.test(message)
      ? "Yes, please share the additional steps or PM routine you offered earlier for my selected products."
      : message;
    await sendMessageToWorker(outboundMessage, { searchQuery: message });
  });
}

async function loadProducts() {
  try {
    const response = await fetch("products.json");
    const data = await response.json();
    state.allProducts = data.products;
    hydrateSelectedProducts();
    applyFilters();
  } catch (error) {
    console.error("Product load failed", error);
    productsContainer.innerHTML = placeholderTemplate("Unable to load products right now. Please try again later.");
  }
}

// ---------- Product filtering & display ----------
function applyFilters() {
  if (!state.allProducts.length) return;

  const category = categoryFilter.value;
  const searchTerm = productSearchInput.value.trim().toLowerCase();

  let nextProducts = state.allProducts.filter((product) => {
    const categoryMatch = category ? product.category === category : true;
    return categoryMatch;
  });

  if (searchTerm) {
    nextProducts = nextProducts.filter((product) => {
      return (
        product.name.toLowerCase().includes(searchTerm) ||
        product.brand.toLowerCase().includes(searchTerm) ||
        product.description.toLowerCase().includes(searchTerm)
      );
    });
  }

  if (!category && !searchTerm) {
    productsContainer.innerHTML = placeholderTemplate("Choose a category or search to explore products.");
    state.filteredProducts = [];
    return;
  }

  if (!nextProducts.length) {
    productsContainer.innerHTML = placeholderTemplate("No products matched your filters yet.");
    state.filteredProducts = [];
    return;
  }

  state.filteredProducts = nextProducts;
  renderProducts(nextProducts);
}

function renderProducts(products) {
  productsContainer.innerHTML = products
    .map((product) => {
      const isSelected = state.selectedProducts.has(product.id);
      const name = escapeHtml(product.name);
      const brand = escapeHtml(product.brand);
      const description = escapeHtml(product.description);
      const categoryLabel = escapeHtml(capitalize(product.category));
      return `
        <article class="product-card ${isSelected ? "selected" : ""}" data-product-id="${product.id}" tabindex="0" aria-pressed="${isSelected}">
          <img src="${product.image}" alt="${name}">
          <div class="product-info">
            <h3>${name}</h3>
            <p>${brand}</p>
            <small>${categoryLabel}</small>
          </div>
          <button class="description-toggle" type="button" aria-expanded="false" aria-controls="desc-${product.id}">Details</button>
          <p id="desc-${product.id}" class="product-description">${description}</p>
          <small>${isSelected ? "Selected" : "Tap to select"}</small>
        </article>
      `;
    })
    .join("");
}

function handleProductCardClick(event) {
  const descriptionButton = event.target.closest(".description-toggle");
  if (descriptionButton) {
    event.stopPropagation();
    const container = descriptionButton.closest(".product-card");
    const description = container.querySelector(".product-description");
    const isOpen = description.classList.toggle("open");
    descriptionButton.setAttribute("aria-expanded", isOpen);
    return;
  }

  const card = event.target.closest(".product-card");
  if (!card) return;
  const productId = Number(card.dataset.productId);
  toggleProductSelection(productId);
}

// ---------- Selection management & persistence ----------
function toggleProductSelection(productId) {
  const product = state.allProducts.find((item) => item.id === productId);
  if (!product) return;

  if (state.selectedProducts.has(productId)) {
    state.selectedProducts.delete(productId);
  } else {
    state.selectedProducts.set(productId, product);
  }

  persistSelectedProducts();
  updateSelectionDisplay();
  if (state.filteredProducts.length) {
    renderProducts(state.filteredProducts);
  }
}

function hydrateSelectedProducts() {
  const stored = JSON.parse(localStorage.getItem(SELECTED_STORAGE_KEY) || "[]");
  stored.forEach((id) => {
    const product = state.allProducts.find((item) => item.id === id);
    if (product) {
      state.selectedProducts.set(product.id, product);
    }
  });
  updateSelectionDisplay();
}

function persistSelectedProducts() {
  const ids = Array.from(state.selectedProducts.keys());
  localStorage.setItem(SELECTED_STORAGE_KEY, JSON.stringify(ids));
}

function updateSelectionDisplay() {
  const items = Array.from(state.selectedProducts.values());

  if (!items.length) {
    selectedProductsList.innerHTML = '<p class="empty-selection">Choose a product to see it here.</p>';
  } else {
    selectedProductsList.innerHTML = items
      .map(
        (product) => `
          <div class="selected-chip">
            <span>${escapeHtml(product.name)}</span>
            <button type="button" aria-label="Remove ${escapeHtml(product.name)}" data-remove-id="${product.id}">&times;</button>
          </div>
        `
      )
      .join("");
  }

  updateSelectedSummary();
  updateSelectionButtons();
}

function updateSelectedSummary() {
  const count = state.selectedProducts.size;
  selectedSummary.textContent = count
    ? `${count} product${count > 1 ? "s" : ""} selected. Tap a card or the × icon to remove.`
    : "No products selected yet.";
}

function updateSelectionButtons() {
  const hasSelection = state.selectedProducts.size > 0;
  clearSelectionsBtn.disabled = !hasSelection;
  generateRoutineBtn.disabled = !hasSelection;
  generateRoutineBtn.setAttribute("aria-disabled", String(!hasSelection));
}

// ---------- RTL preference ----------
function hydrateRtlPreference() {
  const storedPreference = JSON.parse(localStorage.getItem(RTL_STORAGE_KEY) || "false");
  rtlToggle.checked = storedPreference;
  applyRtlPreference(storedPreference);
}

function applyRtlPreference(value) {
  const isRtl = typeof value === "boolean" ? value : rtlToggle.checked;
  document.body.classList.toggle("rtl-active", isRtl);
  localStorage.setItem(RTL_STORAGE_KEY, JSON.stringify(isRtl));
}

// ---------- Routine + chat handling ----------
async function handleRoutineGeneration() {
  if (!state.selectedProducts.size) {
    appendChatMessage("system", "Select at least one product to generate a personalized routine.");
    return;
  }

  state.conversationHistory = [];
  const productLines = Array.from(state.selectedProducts.values()).map(
    (product, index) => `${index + 1}. ${product.name} (${capitalize(product.category)}) - ${product.description}`
  );
  const detailedRequest = `I have selected these L'Oréal group products:\n${productLines.join(
    "\n"
  )}\nCreate a personalized routine that uses them thoughtfully. For now, only describe the AM routine and conclude by inviting the user to type YES if they'd like the PM routine or more recommendations. Explain why each AM step matters and suggest helpful tips if a step is missing. Keep the entire response under ${ROUTINE_CHARACTER_LIMIT} characters by limiting each step to two concise sentences.`;

  appendChatMessage("user", "Please build a personalized routine for my selected products.");
  setRoutineButtonLoading(true);
  await sendMessageToWorker(detailedRequest, {
    searchQuery: Array.from(state.selectedProducts.values())
      .map((item) => item.name)
      .join(" "),
  });
  setRoutineButtonLoading(false);
  updateSelectionButtons();
}

function setRoutineButtonLoading(isLoading) {
  if (isLoading) {
    generateRoutineBtn.disabled = true;
    generateRoutineBtn.setAttribute("aria-disabled", "true");
    generateRoutineBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Building routine...';
  } else {
    generateRoutineBtn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Generate Routine';
  }
}

function appendChatMessage(role, message) {
  if (!message) return;
  clearChatPlaceholder();
  const messageElement = document.createElement("div");
  messageElement.className = `chat-message ${role}`;
  messageElement.innerHTML = formatTextWithLinks(message);
  chatWindow.appendChild(messageElement);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

function clearChatPlaceholder() {
  const placeholder = chatWindow.querySelector(".placeholder-message");
  if (placeholder) placeholder.remove();
}

function formatTextWithLinks(text) {
  let html = escapeHtml(text);
  html = applyBasicMarkdown(html);
  html = html.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
  return html.replace(/\n/g, "<br>");
}

function showThinkingMessage() {
  clearChatPlaceholder();
  const placeholder = document.createElement("div");
  placeholder.className = "chat-message assistant";
  placeholder.id = `thinking-${Date.now()}`;
  placeholder.textContent = "Thinking...";
  chatWindow.appendChild(placeholder);
  chatWindow.scrollTop = chatWindow.scrollHeight;
  return placeholder.id;
}

function removeThinkingMessage(id) {
  const node = document.getElementById(id);
  if (node) node.remove();
}

async function sendMessageToWorker(userContent, options = {}) {
  if (!API_URL) {
    appendChatMessage(
      "system",
      "Worker URL is not configured. Add your Cloudflare worker URL to secrets.js and reload the page."
    );
    return;
  }

  const loaderId = showThinkingMessage();
  const historyWithUser = [...state.conversationHistory, { role: "user", content: userContent }];

  const shouldSearch = webSearchToggle.checked;
  const searchQuery = (options && options.searchQuery) || userContent;
  const sources = shouldSearch ? await fetchSearchResults(searchQuery) : [];

  const messages = buildMessages(historyWithUser, sources);

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages }),
    });

    if (!response.ok) {
      throw new Error("API request failed");
    }

    const data = await response.json();
    const choice = data?.choices?.[0];
    const content = choice?.message?.content?.trim();

    if (!content) {
      throw new Error("No response from AI");
    }

    removeThinkingMessage(loaderId);
    let displayContent = content;
    if (sources.length) {
      const sourcesList = sources
        .map((source, index) => `(${index + 1}) ${source.title} - ${source.url}`)
        .join("\n");
      displayContent += `\n\nSources:\n${sourcesList}`;
    }

    state.conversationHistory = [...historyWithUser, { role: "assistant", content }];
    appendChatMessage("assistant", displayContent);

    if (choice?.finish_reason === "length") {
      appendChatMessage(
        "system",
        "Heads up: that response was cut off when it hit the current token limit. Try a shorter request or reduce the number of selected products."
      );
    }
  } catch (error) {
    console.error(error);
    removeThinkingMessage(loaderId);
    appendChatMessage("system", "I ran into an issue reaching the advisor. Please try again.");
  }
}

function buildMessages(historyWithUser, sources) {
  const messages = [
    {
      role: "system",
      content:
        "You are an expert L'Oréal beauty advisor. Reference the user's selected products, keep explanations concise, and remember previous exchanges.",
    },
    ...historyWithUser,
  ];

  if (sources.length) {
    messages.push({
      role: "system",
      content: formatSourcesForPrompt(sources),
    });
  }

  return messages;
}

function formatSourcesForPrompt(sources) {
  const list = sources
    .map((source, index) => `${index + 1}. ${source.title} - ${source.url} :: ${source.snippet}`)
    .join("\n");
  return `Use these live references when answering. Cite the source numbers (for example, (1)) next to the facts they support and finish with a Sources section listing the same URLs.\n${list}`;
}

async function fetchSearchResults(query) {
  if (!query) return [];
  try {
    const endpoint = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
    const response = await fetch(endpoint);
    const data = await response.json();
    const results = [];

    (data.Results || []).forEach((item) => {
      if (item.FirstURL && item.Text) {
        results.push({ title: item.Text, url: item.FirstURL, snippet: item.Text });
      }
    });

    (data.RelatedTopics || []).forEach((item) => {
      if (item.FirstURL && item.Text) {
        results.push({ title: item.Text, url: item.FirstURL, snippet: item.Text });
      }
      if (Array.isArray(item.Topics)) {
        item.Topics.forEach((topic) => {
          if (topic.FirstURL && topic.Text) {
            results.push({ title: topic.Text, url: topic.FirstURL, snippet: topic.Text });
          }
        });
      }
    });

    return results.slice(0, 3);
  } catch (error) {
    console.error("Web search failed", error);
    return [];
  }
}


// ---------- Helpers ----------
function placeholderTemplate(message) {
  return `<div class="placeholder-message">${message}</div>`;
}

function capitalize(text) {
  if (!text) return "";
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function escapeHtml(text = "") {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function applyBasicMarkdown(html) {
  const codeSnippets = [];

  html = html.replace(/`([^`]+)`/g, (_, codeText) => {
    const token = `@@CODE_${codeSnippets.length}@@`;
    codeSnippets.push(`<code>${codeText}</code>`);
    return token;
  });

  html = html
    .replace(/\*\*([\s\S]+?)\*\*/g, "<strong>$1</strong>")
    .replace(/__([\s\S]+?)__/g, "<strong>$1</strong>")
    .replace(/(^|[\s>_])\*([\s\S]+?)\*(?=[\s<._]|$)/g, (_, prefix, content) => `${prefix}<em>${content}</em>`)
    .replace(/(^|[\s>])_([\s\S]+?)_(?=[\s<]|$)/g, "$1<em>$2</em>")
    .replace(/^> (.+)$/gm, "<blockquote>$1</blockquote>");

  return codeSnippets.reduce((result, snippet, index) => {
    return result.replace(`@@CODE_${index}@@`, snippet);
  }, html);
}




