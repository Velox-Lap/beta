const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const DB = "shorty-demo-v1";
const defaultState = {
  profile: { name: "Guest user", bio: "Still writing my lore...", avatar: "" },
  startDate: "",
  memories: [],
  friends: [{ name: "Pixel Pal", bio: "Demo friend · not a real account", avatar: "" }],
  pairingCode: "",
  paired: false,
  lettersOpened: []
};
let state = readState();
let toastTimer;

function readState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(DB));
    return parsed && typeof parsed === "object"
      ? { ...structuredClone(defaultState), ...parsed, profile: { ...defaultState.profile, ...(parsed.profile || {}) } }
      : structuredClone(defaultState);
  } catch { return structuredClone(defaultState); }
}
function persist() {
  try { localStorage.setItem(DB, JSON.stringify(state)); return true; }
  catch { showToast("Storage is full. Try a smaller profile image."); return false; }
}
function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
}
function safeText(tag, text, className) {
  const el = document.createElement(tag);
  el.textContent = text;
  if (className) el.className = className;
  return el;
}
function addTerminalLine(text, cls = "") {
  const line = safeText("p", text, cls);
  $("#terminal-output").append(line);
  $("#terminal-output").scrollTop = $("#terminal-output").scrollHeight;
}
function enterApp() {
  $("#terminal-screen").classList.add("hidden");
  $("#app-shell").classList.remove("hidden");
  updateProfileUI();
  renderMemories();
  renderFriends();
  renderLetters();
  updateCounter();
  updatePairUI();
  showView("home");
}
$("#terminal-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const input = $("#terminal-input");
  const command = input.value.trim();
  if (!command) return;
  addTerminalLine(`guest@shorty:~$ ${command}`);
  input.value = "";
  const lower = command.toLowerCase();
  if (lower === "help") {
    addTerminalLine("AVAILABLE COMMANDS:");
    addTerminalLine("  help                 show this menu");
    addTerminalLine("  login -u baby        enter the demo universe");
    addTerminalLine("  execute love.sh      execute extremely cute code");
    addTerminalLine("  run meow_memories.exe open the memory archive");
    addTerminalLine("  load shorty_pics     open the dashboard");
    addTerminalLine("  clear                clear terminal output");
  } else if (lower === "login -u baby" || lower === "execute love.sh" || lower === "load shorty_pics") {
    addTerminalLine("[OK] identity accepted · welcome to your little universe", "green");
    setTimeout(enterApp, 350);
  } else if (lower === "run meow_memories.exe") {
    addTerminalLine("[OK] memory module loaded", "green");
    setTimeout(() => { enterApp(); showView("memories"); }, 350);
  } else if (lower === "clear") {
    $("#terminal-output").replaceChildren();
  } else {
    addTerminalLine(`[ERR] command not found: ${command}`);
    addTerminalLine("Type 'help' to see available commands.");
  }
});
$("#terminal-input").addEventListener("keydown", (e) => {
  if (e.key === "Tab") { e.preventDefault(); $("#terminal-input").value = "login -u baby"; }
});

const viewTitles = {
  home: "Your little universe",
  letters: "Open when...",
  memories: "Memory archive",
  people: "People & friends",
  pair: "Pair our accounts"
};
function showView(view) {
  if (!viewTitles[view]) return;
  $$(".view").forEach(el => el.classList.add("hidden"));
  $(`#view-${view}`).classList.remove("hidden");
  $$(".nav-item").forEach(el => el.classList.toggle("active", el.dataset.view === view));
  $("#view-title").innerHTML = `${viewTitles[view]}<span class="pink">.</span>`;
  window.scrollTo({ top: 0, behavior: "smooth" });
}
$$("[data-view]").forEach(button => button.addEventListener("click", () => showView(button.dataset.view)));
$("#logout-button").addEventListener("click", () => {
  $("#app-shell").classList.add("hidden");
  $("#terminal-screen").classList.remove("hidden");
  $("#terminal-input").focus();
  showToast("Logged out of this demo session.");
});
$("#profile-open").addEventListener("click", () => showView("people"));

function updateProfileUI() {
  const name = state.profile.name || "Guest user";
  $("#mini-name").textContent = name;
  $("#top-name").textContent = name;
  $("#welcome-name").textContent = name.split(" ")[0];
  $("#profile-name-heading").textContent = name;
  $("#profile-bio").textContent = state.profile.bio || "Still writing my lore...";
  $("#profile-name").value = name === "Guest user" ? "" : name;
  $("#profile-bio-input").value = state.profile.bio === "Still writing my lore..." ? "" : state.profile.bio;
  ["#mini-avatar", "#top-avatar", "#profile-preview"].forEach(selector => {
    const el = $(selector);
    el.replaceChildren();
    if (state.profile.avatar) {
      const img = document.createElement("img");
      img.src = state.profile.avatar;
      img.alt = "Profile photo";
      el.append(img);
      el.classList.remove("avatar-placeholder");
    } else {
      el.textContent = "♡";
      el.classList.add("avatar-placeholder");
    }
  });
}
$("#profile-form").addEventListener("submit", e => {
  e.preventDefault();
  state.profile.name = $("#profile-name").value.trim() || "Guest user";
  state.profile.bio = $("#profile-bio-input").value.trim() || "Still writing my lore...";
  if (persist()) { updateProfileUI(); showToast("Profile saved on this device."); }
});
$("#avatar-upload").addEventListener("change", e => {
  const file = e.target.files?.[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) return showToast("Choose an image file.");
  if (file.size > 700 * 1024) return showToast("Please choose an image under 700 KB for this demo.");
  const reader = new FileReader();
  reader.onload = () => {
    const previous = state.profile.avatar;
    state.profile.avatar = reader.result;
    if (persist()) updateProfileUI();
    else state.profile.avatar = previous;
  };
  reader.readAsDataURL(file);
});

$("#set-date-button").addEventListener("click", () => {
  const answer = prompt("Enter your special date (YYYY-MM-DD):", state.startDate || "");
  if (answer === null) return;
  if (answer && !/^\d{4}-\d{2}-\d{2}$/.test(answer)) return showToast("Use YYYY-MM-DD format.");
  state.startDate = answer;
  persist();
  updateCounter();
});
function updateCounter() {
  if (!state.startDate) {
    $("#together-counter").textContent = "Set your date";
    $("#together-sub").textContent = "Every moment counts";
    return;
  }
  const start = new Date(`${state.startDate}T00:00:00`);
  if (Number.isNaN(start.getTime()) || start > new Date()) {
    $("#together-counter").textContent = "Check date";
    $("#together-sub").textContent = "Enter a date in the past";
    return;
  }
  const days = Math.floor((new Date() - start) / 86400000);
  $("#together-counter").textContent = `${days.toLocaleString()} days`;
  $("#together-sub").textContent = `Since ${start.toLocaleDateString()}`;
}
const movies = [
  ["Arrival", "Sci-fi · thoughtful and a little emotional"],
  ["Knives Out", "Mystery · everyone is suspicious"],
  ["Spider-Man: Into the Spider-Verse", "Animation · colorful chaos"],
  ["The Martian", "Sci-fi · problem-solving on Mars"],
  ["Enola Holmes", "Mystery · clever clues and adventure"],
  ["Interstellar", "Sci-fi · space, time, and big feelings"],
  ["The Grand Budapest Hotel", "Comedy · stylish, strange, delightful"],
  ["A Quiet Place", "Thriller · maybe keep the lights on"]
];
$("#movie-button").addEventListener("click", () => {
  const movie = movies[Math.floor(Math.random() * movies.length)];
  $("#movie-result").replaceChildren(
    safeText("span", "YOUR RANDOM PICK", "movie-tag"),
    safeText("h2", movie[0]),
    safeText("p", movie[1])
  );
});
const messages = [
  "You make the ordinary parts of life feel a little more magical.",
  "Reminder: you don't have to solve everything today.",
  "Someone is very lucky to know the real you.",
  "Tiny progress is still progress. Please be kind to yourself.",
  "Your laugh belongs in the world's best sound collection.",
  "Drink some water. Unclench your jaw. You are doing okay.",
  "You deserve the same patience you give to everyone else."
];
$("#message-button").addEventListener("click", () => {
  const current = $("#daily-message").textContent;
  const choices = messages.filter(m => m !== current);
  $("#daily-message").textContent = choices[Math.floor(Math.random() * choices.length)];
});
const mascotLines = [
  "meow.exe says: you are doing purr-fectly.",
  "Shorty has scanned the room. Cuteness levels: HIGH.",
  "Reminder from your pixel cat: take a tiny break.",
  "Error 404: a reason not to smile was not found.",
  "Shorty would like one (1) virtual head pat."
];
$("#mascot").addEventListener("click", () => {
  showToast(mascotLines[Math.floor(Math.random() * mascotLines.length)]);
  $("#mascot .mascot-face").textContent = "ฅ(=˃ᆺ˂=)ฅ";
  setTimeout(() => $("#mascot .mascot-face").textContent = "ฅ^•ﻌ•^ฅ", 1000);
});
$("#pet-companion").addEventListener("click", () => $("#mascot").click());

const letters = [
  { title: "Open when you're tired", hint: "You don't need to be productive every second.", body: "Hey you. It's okay to pause. You don't have to earn your rest, and you don't have to be impressive every day. Get comfortable, take a breath, and let today be enough. I'm rooting for you, even on the quiet days. ♡" },
  { title: "Open when you miss me", hint: "A small hug, delivered in pixels.", body: "If I could send a little hug through this screen, I'd send one that lasts until your shoulders relax. Until then, remember: the distance between messages doesn't measure how much someone cares. You're on my mind. ♡" },
  { title: "Open when you're stressed", hint: "One thing at a time. Seriously.", body: "You don't need to solve the whole week in one afternoon. Pick one small thing, do what you can, and let the rest wait its turn. You are a person, not a machine. Breathe. I'm proud of you for trying." },
  { title: "Open when you need a smile", hint: "Warning: low-level silliness detected.", body: "Official notice from the Department of Cute Things: you have been sentenced to one smile, three deep breaths, and an unnecessary amount of affection. This ruling is final. ฅ^•ﻌ•^ฅ" }
];
function renderLetters() {
  const grid = $("#letter-grid");
  grid.replaceChildren();
  letters.forEach((letter, index) => {
    const button = document.createElement("button");
    button.className = "letter-card";
    button.type = "button";
    const envelope = safeText("span", "✉", "envelope");
    const copy = document.createElement("span");
    copy.append(safeText("h3", letter.title), safeText("p", letter.hint));
    button.append(envelope, copy, safeText("span", "↗", "letter-arrow"));
    button.addEventListener("click", () => openLetter(index));
    grid.append(button);
  });
}
function openLetter(index) {
  const letter = letters[index];
  $("#letter-modal-title").textContent = letter.title;
  $("#letter-modal-body").textContent = letter.body;
  $("#letter-modal").classList.remove("hidden");
  state.lettersOpened = [...new Set([...(state.lettersOpened || []), index])];
  persist();
}
function closeLetter() { $("#letter-modal").classList.add("hidden"); }
$("#close-letter").addEventListener("click", closeLetter);
$("#letter-done").addEventListener("click", closeLetter);
$("#letter-modal").addEventListener("click", e => { if (e.target.id === "letter-modal") closeLetter(); });
document.addEventListener("keydown", e => { if (e.key === "Escape") closeLetter(); });

$("#memory-form").addEventListener("submit", e => {
  e.preventDefault();
  const title = $("#memory-title").value.trim();
  const body = $("#memory-body").value.trim();
  if (!title || !body) return;
  state.memories.unshift({ id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()), title, body, date: $("#memory-date").value || new Date().toISOString().slice(0, 10) });
  if (persist()) { renderMemories(); e.target.reset(); showToast("Memory saved to this browser."); }
});
function renderMemories() {
  const list = $("#memory-list");
  list.replaceChildren();
  if (!state.memories.length) {
    list.append(safeText("p", "No memories yet. Save a small moment above.", "empty-state"));
    return;
  }
  state.memories.forEach(memory => {
    const card = document.createElement("article");
    card.className = "memory-item";
    const date = safeText("time", memory.date || "");
    const title = safeText("h3", memory.title);
    const body = safeText("p", memory.body);
    const remove = safeText("button", "Delete memory", "delete-button");
    remove.type = "button";
    remove.addEventListener("click", () => {
      state.memories = state.memories.filter(item => item.id !== memory.id);
      persist(); renderMemories(); showToast("Memory deleted.");
    });
    card.append(date, title, body, remove);
    list.append(card);
  });
}
$("#friend-form").addEventListener("submit", e => {
  e.preventDefault();
  const name = $("#friend-name").value.trim();
  if (!name) return;
  if (state.friends.some(f => f.name.toLowerCase() === name.toLowerCase())) return showToast("That name is already on your list.");
  state.friends.push({ name, bio: "Local demo contact", avatar: "" });
  if (persist()) { renderFriends(); e.target.reset(); showToast("Added to your local friends list."); }
});
function renderFriends() {
  const list = $("#friend-list");
  list.replaceChildren();
  $("#friend-count").textContent = `${state.friends.length} FRIEND${state.friends.length === 1 ? "" : "S"}`;
  if (!state.friends.length) list.append(safeText("p", "No friends added yet."));
  state.friends.forEach((friend, index) => {
    const card = document.createElement("div");
    card.className = "friend-card";
    const avatar = safeText("div", "♡", "avatar");
    const info = document.createElement("div");
    info.className = "friend-info";
    info.append(safeText("strong", friend.name), safeText("small", friend.bio || "Local demo contact"));
    const remove = safeText("button", "Remove");
    remove.type = "button";
    remove.addEventListener("click", () => {
      state.friends.splice(index, 1);
      persist(); renderFriends();
    });
    card.append(avatar, info, remove);
    list.append(card);
  });
}
function updatePairUI() {
  $("#pair-code").textContent = state.pairingCode || "------";
  $("#pair-status").textContent = state.paired ? "Pair connected ♡" : "Not paired yet";
  $("#pair-sub").textContent = state.paired ? "Demo connection saved on this device" : "Two accounts, one little universe";
}
$("#generate-code").addEventListener("click", () => {
  state.pairingCode = Array.from({ length: 6 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]).join("");
  state.paired = false;
  persist(); updatePairUI();
  showToast("Code generated. Share it manually for this demo.");
});
$("#copy-code").addEventListener("click", async () => {
  if (!state.pairingCode) return showToast("Generate a code first.");
  try { await navigator.clipboard.writeText(state.pairingCode); showToast("Pairing code copied."); }
  catch { showToast(`Your code is ${state.pairingCode}`); }
});
$("#join-pair-form").addEventListener("submit", e => {
  e.preventDefault();
  const code = $("#join-code").value.trim().toUpperCase();
  if (!state.pairingCode) {
    $("#pair-feedback").textContent = "This local demo has no shared server to verify another person's code.";
    return;
  }
  if (code === state.pairingCode) {
    state.paired = true;
    persist(); updatePairUI();
    $("#pair-feedback").textContent = "Demo pairing enabled on this browser.";
    showToast("Paired locally. This does not connect another account.");
  } else {
    $("#pair-feedback").textContent = "Code not found in this browser. Real cross-account pairing needs a backend.";
  }
});
