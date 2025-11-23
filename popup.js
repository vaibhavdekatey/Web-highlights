document.addEventListener("DOMContentLoaded", () => {
  loadHighlights();
  checkApiKeyStatus();

  // Handle API Key saving
  document.getElementById("save-key-btn").addEventListener("click", () => {
    const keyInput = document.getElementById("api-key-input");
    const key = keyInput.value.trim();

    if (key) {
      chrome.storage.local.set({ gemini_key: key }, () => {
        checkApiKeyStatus(); // Refresh UI state
      });
    }
  });

  // Handle API Key deletion
  document.getElementById("delete-key-btn").addEventListener("click", () => {
    chrome.storage.local.remove(["gemini_key"], () => {
      document.getElementById("api-key-input").value = ""; // Clear input
      checkApiKeyStatus(); // Refresh UI state
    });
  });
});

// New function to toggle UI based on key existence
function checkApiKeyStatus() {
  const inputContainer = document.getElementById("api-input-container");
  const savedContainer = document.getElementById("api-saved-container");

  chrome.storage.local.get(["gemini_key"], (result) => {
    if (result.gemini_key) {
      // Key exists: Hide input, show delete option
      inputContainer.style.display = "none";
      savedContainer.style.display = "flex";
    } else {
      // No key: Show input, hide delete option
      inputContainer.style.display = "flex";
      savedContainer.style.display = "none";
    }
  });
}

function loadHighlights() {
  const container = document.getElementById("list-container");
  container.innerHTML = "";

  chrome.storage.local.get(["highlights"], (result) => {
    const highlights = result.highlights || [];

    if (highlights.length === 0) {
      container.innerHTML =
        '<div id="empty-state">No highlights saved yet.<br>Select text on any page to start!</div>';
      return;
    }

    highlights.reverse().forEach((item) => {
      const card = createHighlightCard(item);
      container.appendChild(card);
    });
  });
}

function createHighlightCard(item) {
  const div = document.createElement("div");
  div.className = "highlight-card";
  div.id = `card-${item.id}`;

  // Check if summary exists to display it immediately
  const summaryStyle = item.summary ? "display: block;" : "";
  const summaryContent = item.summary ? "✨ " + item.summary : "";

  div.innerHTML = `
        <div class="meta-info">
            <span>${new URL(item.url).hostname}</span>
            <span>${item.date}</span>
        </div>
        <div class="highlight-text">${escapeHtml(item.text)}</div>
        <div class="summary-box" id="summary-${
          item.id
        }" style="${summaryStyle}">${summaryContent}</div>
        <div class="actions">
            <a href="${
              item.url
            }" target="_blank" class="btn-visit" style="margin-right:auto; align-self:center;">Visit Page</a>
            <button class="btn-summarize" data-id="${
              item.id
            }">Summarize AI</button>
            <button class="btn-delete" data-id="${item.id}">Delete</button>
        </div>
    `;

  div
    .querySelector(".btn-delete")
    .addEventListener("click", () => deleteHighlight(item.id));
  div
    .querySelector(".btn-summarize")
    .addEventListener("click", () => summarizeHighlight(item.id, item.text));

  return div;
}

function deleteHighlight(id) {
  chrome.storage.local.get(["highlights"], (result) => {
    const updated = result.highlights.filter((h) => h.id !== id);
    chrome.storage.local.set({ highlights: updated }, () => {
      loadHighlights();
    });
  });
}

async function summarizeHighlight(id, text) {
  const summaryBox = document.getElementById(`summary-${id}`);
  const btn = document.querySelector(`button[data-id="${id}"].btn-summarize`);

  const stored = await chrome.storage.local.get(["gemini_key"]);
  const apiKey = stored.gemini_key;

  if (!apiKey) {
    alert("Please enter a Google Gemini API Key in the top section first.");
    return;
  }

  summaryBox.style.display = "block";
  summaryBox.innerText = "Thinking...";
  btn.disabled = true;

  // Helper function to call API
  const callGemini = async (modelName) => {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
    return fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text:
                  "Summarize the following text in one concise sentence: " +
                  text,
              },
            ],
          },
        ],
      }),
    });
  };

  try {
    // 1. Try the requested model: Gemini 2.5 Flash
    let response = await callGemini("gemini-2.5-flash");

    // 2. If 404/400 (Model Not Found/Supported), switch to backup (Gemini 1.5 Flash)
    if (!response.ok && (response.status === 404 || response.status === 400)) {
      console.log(
        "Gemini 2.5 Flash not found, switching to Gemini 1.5 Flash fallback..."
      );
      response = await callGemini("gemini-1.5-flash");
    }

    const data = await response.json();

    if (data.error) {
      if (data.error.code === 429) {
        summaryBox.innerText =
          "Error: Too many requests. Please wait a moment.";
      } else {
        summaryBox.innerText =
          "Error: " + (data.error.message || "Unknown error");
      }
    } else {
      const summary = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (summary) {
        summaryBox.innerText = "✨ " + summary;

        // Save Summary Logic
        chrome.storage.local.get(["highlights"], (result) => {
          const highlights = result.highlights || [];
          const index = highlights.findIndex((h) => h.id === id);
          if (index !== -1) {
            highlights[index].summary = summary;
            chrome.storage.local.set({ highlights: highlights });
          }
        });
      } else {
        summaryBox.innerText = "Error: No summary generated.";
      }
    }
  } catch (error) {
    summaryBox.innerText = "Network Error: Could not reach Google API.";
    console.error(error);
  } finally {
    btn.disabled = false;
  }
}

function escapeHtml(text) {
  const map = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, function (m) {
    return map[m];
  });
}
