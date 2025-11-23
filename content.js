// Create the floating button element
let highlightBtn = document.createElement("button");
highlightBtn.innerText = "Save Highlight 🖍️";
highlightBtn.style.position = "absolute";
highlightBtn.style.display = "none";
highlightBtn.style.zIndex = "999999";
highlightBtn.style.backgroundColor = "#2563eb";
highlightBtn.style.color = "white";
highlightBtn.style.border = "none";
highlightBtn.style.padding = "8px 12px";
highlightBtn.style.borderRadius = "5px";
highlightBtn.style.cursor = "pointer";
highlightBtn.style.boxShadow = "0 2px 5px rgba(0,0,0,0.2)";
highlightBtn.style.fontFamily = "sans-serif";
highlightBtn.style.fontSize = "13px";
highlightBtn.style.fontWeight = "bold";
document.body.appendChild(highlightBtn);

// Variable to store current selection
let currentSelection = "";

// Listen for mouseup to detect text selection
document.addEventListener("mouseup", (e) => {
  const selection = window.getSelection();
  const selectedText = selection.toString().trim();

  if (selectedText.length > 0) {
    currentSelection = selectedText;

    // Calculate position to show button right above the selection
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    const top = rect.top + window.scrollY - 40;
    const left = rect.left + window.scrollX;

    highlightBtn.style.top = `${top}px`;
    highlightBtn.style.left = `${left}px`;
    highlightBtn.style.display = "block";
  } else {
    highlightBtn.style.display = "none";
  }
});

// Hide button on mousedown (when starting a new selection)
document.addEventListener("mousedown", (e) => {
  if (e.target !== highlightBtn) {
    highlightBtn.style.display = "none";
  }
});

// Handle Save Click
highlightBtn.addEventListener("click", async () => {
  if (!currentSelection) return;

  const newHighlight = {
    id: Date.now(),
    text: currentSelection,
    url: window.location.href,
    title: document.title,
    date: new Date().toLocaleDateString(),
  };

  // Get existing highlights
  chrome.storage.local.get(["highlights"], (result) => {
    const highlights = result.highlights || [];
    highlights.push(newHighlight);

    // Save back to storage
    chrome.storage.local.set({ highlights: highlights }, () => {
      const originalText = highlightBtn.innerText;
      highlightBtn.innerText = "Saved! ✅";
      highlightBtn.style.backgroundColor = "#10b981";

      setTimeout(() => {
        highlightBtn.innerText = originalText;
        highlightBtn.style.backgroundColor = "#2563eb";
        highlightBtn.style.display = "none";
        window.getSelection().removeAllRanges();
      }, 1500);
    });
  });
});
