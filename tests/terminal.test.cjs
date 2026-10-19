const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const { webcrypto } = require("node:crypto");

class FakeClassList {
  constructor() { this.values = new Set(); }
  add(value) { this.values.add(value); }
  remove(value) { this.values.delete(value); }
  contains(value) { return this.values.has(value); }
  toggle(value, force) {
    const enabled = force === undefined ? !this.values.has(value) : Boolean(force);
    if (enabled) this.values.add(value); else this.values.delete(value);
    return enabled;
  }
}

class FakeElement {
  constructor(selector, document) {
    this.selector = selector;
    this.document = document;
    this.listeners = new Map();
    this.children = [];
    this.classList = new FakeClassList();
    this.dataset = {};
    this.style = {};
    this.files = [];
    this.value = "";
    this.textContent = "";
    this.innerHTML = "";
    this.open = false;
    this.attributes = {};
  }
  addEventListener(type, fn) {
    const current = this.listeners.get(type) || [];
    current.push(fn);
    this.listeners.set(type, current);
  }
  dispatch(type, extra = {}) {
    let prevented = false;
    const event = {
      type,
      currentTarget: this,
      target: this,
      preventDefault() { prevented = true; },
      ...extra
    };
    for (const fn of this.listeners.get(type) || []) fn(event);
    return { event, defaultPrevented: prevented };
  }
  append(child) { this.children.push(child); child.parent = this; }
  replaceChildren(...children) { this.children = [...children]; }
  remove() {
    if (this.parent) this.parent.children = this.parent.children.filter(x => x !== this);
  }
  get firstChild() { return this.children[0] || null; }
  focus() { this.document.activeElement = this; }
  setAttribute(key, value) { this.attributes[key] = String(value); }
  setSelectionRange() {}
  showModal() { this.open = true; }
  close() { this.open = false; }
  querySelector(selector) { return this.document.getElement(selector); }
  querySelectorAll(selector) { return this.document.querySelectorAll(selector); }
}

class FakeDocument {
  constructor() {
    this.elements = new Map();
    this.lists = new Map();
    this.listeners = new Map();
    this.activeElement = null;
    this.documentElement = new FakeElement("documentElement", this);
    this.documentElement.dataset = {};
  }
  getElement(selector) {
    if (!this.elements.has(selector)) this.elements.set(selector, new FakeElement(selector, this));
    return this.elements.get(selector);
  }
  querySelector(selector) { return this.getElement(selector); }
  querySelectorAll(selector) {
    if (!this.lists.has(selector)) this.lists.set(selector, []);
    return this.lists.get(selector);
  }
  createElement(tag) { return new FakeElement(tag, this); }
  addEventListener(type, fn) {
    const current = this.listeners.get(type) || [];
    current.push(fn);
    this.listeners.set(type, current);
  }
}

function makeStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
    clear() { values.clear(); }
  };
}

test("terminal form handles help on submit and prevents native page reload", async () => {
  const document = new FakeDocument();
  for (const selector of [".nav-item", ".side-logo", ".auth-tab", "[data-close-auth]", "[data-close-letter]"]) {
    document.lists.set(selector, []);
  }
  document.lists.set(".nav-item", [document.getElement(".nav-home"), document.getElement(".nav-friends")]);
  document.lists.set(".side-logo", [document.getElement(".side-logo-1")]);
  document.lists.set(".auth-tab", [document.getElement(".auth-login"), document.getElement(".auth-register")]);
  document.getElement("#terminalInput").value = "help";

  const context = {
    document,
    window: { SHORTY_CONFIG: {} },
    localStorage: makeStorage(),
    sessionStorage: makeStorage(),
    crypto: webcrypto,
    TextEncoder,
    Intl,
    console,
    setInterval: () => 1,
    clearInterval: () => {},
    setTimeout,
    clearTimeout
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync("app.js", "utf8"), context, { filename: "app.js" });
  await new Promise(resolve => setTimeout(resolve, 0));

  const form = document.getElement("#terminalForm");
  const output = document.getElement("#terminalOutput");
  assert.ok((form.listeners.get("submit") || []).length > 0, "terminal submit listener must be registered");

  const result = form.dispatch("submit");
  assert.equal(result.defaultPrevented, true, "submit must prevent the browser's default form navigation");
  assert.equal(document.getElement("#terminalInput").value, "", "command input should clear after execution");

  const outputText = output.children.map(node => node.textContent).join("\n");
  assert.match(outputText, /COMMANDS:/, "help should print the command list");
  assert.match(outputText, /login\s+open identity portal/, "help should include the login command");
  assert.match(outputText, /clear\s+clear terminal/, "help should include the clear command");
});
