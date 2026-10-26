
const REPO = "orieljcrtreasurer/oriel-jcr-tuck-shop";
const API = `https://api.github.com/repos/${REPO}/contents/`;

const DAYS = [
  "monday", "tuesday", "wednesday", "thursday",
  "friday", "saturday", "sunday"
];

let token = localStorage.getItem("github_token") || "";
let items = [];
let hours = {};
let itemSha = "";
let hoursSha = "";
let editingIndex = -1;

const $ = id => document.getElementById(id);

function message(text) {
  $("message").textContent = text;
}

function encodeBase64(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function decodeBase64(text) {
  const binary = atob(text.replace(/\s/g, ""));
  const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

async function github(path, method = "GET", body = null) {
  const response = await fetch(API + path, {
    method,
    headers: {
      "Accept": "application/vnd.github+json",
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      `${response.status}: ${error.message || "GitHub request failed"}`
    );
  }

  return response.json();
}

async function loadFile(path) {
  const result = await github(path);
  return {
    data: JSON.parse(decodeBase64(result.content)),
    sha: result.sha
  };
}

async function connect() {
  const enteredToken = $("token").value.trim();

  if (enteredToken) {
    token = enteredToken;
  }

  if (!token) {
    return message("Please enter a token.");
  }

  try {
    message("Connecting...");

    const [products, opening] = await Promise.all([
      loadFile("items.json"),
      loadFile("hours.json")
    ]);

    if (!Array.isArray(products.data)) {
      throw new Error("items.json must contain an array.");
    }

    items = products.data;
    hours = opening.data;
    itemSha = products.sha;
    hoursSha = opening.sha;

    // Remember token after successful connection
    localStorage.setItem("github_token", token);

    $("token").value = "";
    $("editor").hidden = false;

    renderItems();
    renderHours();

    message("Connected to GitHub.");
  } catch (error) {
    token = "";
    localStorage.removeItem("github_token");
    $("editor").hidden = true;
    message(error.message);
  }
}

function disconnect() {
  token = "";

  // Forget the saved token
  localStorage.removeItem("github_token");

  items = [];
  hours = {};

  $("token").value = "";
  $("editor").hidden = true;

  message("Disconnected. Saved token removed.");
}

function clearItem() {
  editingIndex = -1;
  $("item-form").reset();
  $("image").value = "";
}

function renderItems() {
  const container = $("items-list");
  container.replaceChildren();

  items.forEach((item, index) => {
    const row = document.createElement("div");
    row.className = "item";

    const image = document.createElement("img");
    image.src = "../" + item.image || "";
    image.alt = "";

    const label = document.createElement("span");
    label.textContent =
      ` ${item.name} - £${Number(item.price).toFixed(2)}` +
      (item.available === false ? " (Out of stock)" : "");

    const edit = document.createElement("button");
    edit.textContent = "Edit";
    edit.onclick = () => {
      editingIndex = index;
      $("name").value = item.name;
      $("price").value = item.price;
      $("image").value = item.image || "";
      $("available").checked = item.available !== false;
      $("item-form").scrollIntoView({ behavior: "smooth" });
    };

    const remove = document.createElement("button");
    remove.textContent = "Delete";
    remove.onclick = () => {
      if (!confirm(`Delete ${item.name}?`)) return;
      items.splice(index, 1);
      clearItem();
      renderItems();
    };

    row.append(image, label, edit, remove);
    container.appendChild(row);
  });
}

function saveProduct(event) {
  event.preventDefault();

  const item = {
    name: $("name").value.trim(),
    price: Number($("price").value),
    image: $("image").value.trim(),
    available: $("available").checked
  };

  if (!item.name || !Number.isFinite(item.price) ||
      item.price < 0) {
    return message("Enter a valid name and price.");
  }

  if (editingIndex === -1) {
    items.push(item);
  } else {
    items[editingIndex] = item;
  }

  clearItem();
  renderItems();
  message("Product updated locally. Click Publish to save to GitHub.");
}

function renderHours() {
  const container = $("hours-list");
  container.replaceChildren();

  DAYS.forEach(day => {
    const block = document.createElement("div");
    block.className = "day";

    const heading = document.createElement("h3");
    heading.textContent = day[0].toUpperCase() + day.slice(1);

    const sessions = document.createElement("div");

    function drawSessions() {
      sessions.replaceChildren();

      (hours[day] || []).forEach((session, index) => {
        const row = document.createElement("div");
        row.className = "session";

        for (const field of ["open", "close"]) {
          const input = document.createElement("input");
          input.type = "time";
          input.value = session[field];
          input.setAttribute("aria-label", `${day} ${field}`);
          input.onchange = () => session[field] = input.value;
          row.appendChild(input);
        }

        const remove = document.createElement("button");
        remove.textContent = "Remove";
        remove.onclick = () => {
          hours[day].splice(index, 1);
          drawSessions();
        };

        row.appendChild(remove);
        sessions.appendChild(row);
      });
    }

    const add = document.createElement("button");
    add.textContent = "+ Add Session";
    add.onclick = () => {
      if (!Array.isArray(hours[day])) hours[day] = [];
      hours[day].push({ open: "20:00", close: "22:00" });
      drawSessions();
    };

    block.append(heading, sessions, add);
    container.appendChild(block);
    drawSessions();
  });
}

async function publish(path, data, sha) {
  const result = await github(path, "PUT", {
    message: `Update tuck shop ${path}`,
    content: encodeBase64(JSON.stringify(data, null, 2) + "\n"),
    sha,
    branch: "main"
  });

  return result.content.sha;
}

async function saveItems() {
  try {
    $("save-items").disabled = true;
    message("Publishing products...");
    itemSha = await publish("items.json", items, itemSha);
    message("Products published successfully.");
  } catch (error) {
    message("Failed to publish products: " + error.message);
  } finally {
    $("save-items").disabled = false;
  }
}

async function saveHours() {
  for (const day of DAYS) {
    for (const session of hours[day] || []) {
      if (!session.open || !session.close ||
          session.open >= session.close) {
        return message(`Invalid opening session on ${day}.`);
      }
    }
  }

  try {
    $("save-hours").disabled = true;
    message("Publishing opening hours...");
    hoursSha = await publish("hours.json", hours, hoursSha);
    message("Opening hours published successfully.");
  } catch (error) {
    message("Failed to publish opening hours: " + error.message);
  } finally {
    $("save-hours").disabled = false;
  }
}

$("connect").onclick = connect;
$("disconnect").onclick = disconnect;
$("item-form").onsubmit = saveProduct;
$("clear-item").onclick = clearItem;
$("save-items").onclick = saveItems;
$("save-hours").onclick = saveHours;
if (token){
    connect();
}