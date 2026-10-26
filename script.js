const DAYS = [
  "sunday", "monday", "tuesday", "wednesday",
  "thursday", "friday", "saturday"
];

const TIME_ZONE = "Europe/London";

// Load JSON files
async function loadJSON(filename) {
  const response = await fetch(filename);

  if (!response.ok) {
    throw new Error(`Could not load ${filename}`);
  }

  return response.json();
}

// Get the current day and time in Oxford
function getOxfordTime() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE,
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(new Date());

  const get = type =>
    parts.find(part => part.type === type).value;

  return {
    day: get("weekday").toLowerCase(),
    time: `${get("hour")}:${get("minute")}`
  };
}

// Display opening hours
function displayHours(hours) {
  const container = document.getElementById("opening-hours");
  const status = document.getElementById("shop-status");

  const { day, time } = getOxfordTime();

  const table = document.createElement("table");
  table.className = "hours-table";

  // Display Monday to Sunday
  const orderedDays = [...DAYS.slice(1), DAYS[0]];

  orderedDays.forEach(name => {
    const sessions = hours[name] || [];

    const row = document.createElement("tr");

    if (name === day) {
      row.className = "today";
    }

    const dayCell = document.createElement("td");
    dayCell.textContent =
      name.charAt(0).toUpperCase() + name.slice(1);

    const timeCell = document.createElement("td");

    timeCell.textContent = sessions.length
      ? sessions.map(s => `${s.open} - ${s.close}`).join(", ")
      : "Closed";

    row.append(dayCell, timeCell);
    table.appendChild(row);
  });

  container.replaceChildren(table);

  // Check if currently open
  const todaySessions = hours[day] || [];

  const isOpen = todaySessions.some(session =>
    time >= session.open && time < session.close
  );

  status.textContent = isOpen
    ? "● Open Now"
    : "● Currently Closed";

  status.className = `status ${isOpen ? "open" : "closed"}`;
}

// Display products without categories
function displayItems(items) {
  const container = document.getElementById("products");
  container.replaceChildren();

  items.forEach(item => {
    const card = document.createElement("div");
    card.className = "product-card";

    if (item.available === false) {
      card.classList.add("unavailable");
    }

    const image = document.createElement("img");
    image.src = item.image;
    image.alt = item.name;
    image.loading = "lazy";

    const name = document.createElement("h3");
    name.textContent = item.name;

    const price = document.createElement("p");
    price.className = "price";
    price.textContent = `£${Number(item.price).toFixed(2)}`;

    card.append(image, name, price);

    if (item.available === false) {
      const stock = document.createElement("p");
      stock.className = "stock";
      stock.textContent = "Out of stock";
      card.appendChild(stock);
    }

    container.appendChild(card);
  });
}

// Initialise website
async function init() {
  try {
    const [items, hours] = await Promise.all([
      loadJSON("items.json"),
      loadJSON("hours.json")
    ]);

    displayItems(items);
    displayHours(hours);

    // Update the open/closed indicator every minute
    setInterval(() => displayHours(hours), 60000);

  } catch (error) {
    console.error(error);

    document.getElementById("products").textContent =
      "Unable to load products.";

    const status = document.getElementById("shop-status");
    status.textContent = "Opening hours unavailable";
    status.className = "status unknown";
  }
}

init();