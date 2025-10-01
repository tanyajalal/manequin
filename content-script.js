// Simplified Manequin Content Script
// Supabase client setup for Manequin
const SUPABASE_URL = "https://dlqsdsktqjoebychjmwu.supabase.co"
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRscXNkc2t0cWpvZWJ5Y2hqbXd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkwMTI1NTYsImV4cCI6MjA3NDU4ODU1Nn0.qcm3SIfQtAxShNw8I8Up0-oxwCZIJgYcUWdCmB39nfI"

let supabase = null
if (window.supabase) {
  supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  console.log("[v0] Supabase client initialized")
} else {
  console.error("[v0] Supabase library not loaded yet")
}

async function loginWithEmail(email) {
  const { data, error } = await supabase.auth.signInWithOtp({
    email: email,
    options: {
      emailRedirectTo: "chrome-extension://lpleahmacojdoedibhfkfcgolmpiggeb/auth.html",
    },
  })

  if (error) {
    console.error("Error sending login email:", error)
    alert("Login failed: " + error.message)
  } else {
    alert("Check your email for a magic login link ✨")
  }
}

// helper functions
async function toggleLike(contentType, contentId) {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    throw new Error("Not logged in")
  }

  // check if like exists
  const { data: existing } = await supabase
    .from("likes")
    .select("*")
    .eq("user_id", user.id)
    .eq("content_type", contentType)
    .eq("content_id", contentId)

  if (existing && existing.length > 0) {
    // unlike
    await supabase.from("likes").delete().eq("id", existing[0].id)
    return { liked: false }
  } else {
    // like
    await supabase.from("likes").insert([{ user_id: user.id, content_type: contentType, content_id: contentId }])
    return { liked: true }
  }
}

async function getLikeStatus(contentType, contentId) {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { liked: false }

  const { data } = await supabase
    .from("likes")
    .select("*")
    .eq("user_id", user.id)
    .eq("content_type", contentType)
    .eq("content_id", contentId)

  return { liked: data && data.length > 0 }
}

async function getUserLikes() {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []
  const { data } = await supabase.from("likes").select("*").eq("user_id", user.id)
  return data || []
}

class ManequinExtension {
  constructor() {
    console.log("[v0] Manequin: Initializing extension...")
    this.sidebar = null
    this.isVisible = false
    this.currentUser = null
    this.isAuthenticated = false
    this.username = "there"
    this.savedItems = []
    this.productOverlay = null
    this.currentProduct = null
    this.isProductDetectionActive = false
    this.hideTimeout = null
    this.isDragging = false
    this.dragOffset = { x: 0, y: 0 }

    this.init()
  }

injectSaveButtons() {
  // Target Sephora product cards (adjust selectors for other sites)
const productCards = document.querySelectorAll(
  ".product-tile, [data-comp='ProductGridItem'], [data-comp='ProductCard'], .css-ix8km1, .css-1tu1d7g"
)


  productCards.forEach(card => {
    if (card.querySelector(".manequin-save-btn")) return // avoid duplicates

    // Create save button
    const btn = document.createElement("button")
    btn.className = "manequin-save-btn"
    btn.innerText = "Save ✨"
    btn.style.cssText = `
      position: absolute;
      top: 10px;
      right: 10px;
      background: #E91E63;
      color: white;
      border: none;
      border-radius: 4px;
      padding: 4px 8px;
      font-size: 12px;
      cursor: pointer;
      z-index: 1000;
    `

    btn.addEventListener("click", (e) => {
      e.preventDefault()
      e.stopPropagation()
      const titleEl = card.querySelector("a, h1, h2, h3")
      if (titleEl) {
        this.saveProductFromElement(titleEl)
      }
    })

    // Ensure card is positioned relative so the button sits inside
    card.style.position = "relative"
    card.appendChild(btn)
  })

  console.log("[v0] Manequin: Save buttons injected into product cards")
}

observeProductGrid() {
  const observer = new MutationObserver(() => {
    this.injectSaveButtons()
  })

  observer.observe(document.body, {
    childList: true,
    subtree: true
  })
}

shouldRunOnCurrentSite() {
  const hostname = window.location.hostname.toLowerCase()

  // Force run on Sephora for now
  if (hostname.includes("sephora.com")) {
    return true
  }

  // Keep your other domain/path logic here
  const allowedDomains = ["ulta.com", "glossier.com", "rarebeauty.com"]
  const isAllowedDomain = allowedDomains.some((domain) => hostname.includes(domain))

  return isAllowedDomain
}

async init() {
  console.log("[v0] Manequin: Starting extension initialization...")

  if (!this.shouldRunOnCurrentSite()) {
    console.log("[v0] Not running on this site")
    return
  }

  try {
    await this.checkAuthStatus()
    this.loadCSS()
    // this.initializeProductDetection()
    this.highlightProductTitles()
    this.setupMessageListener()

    // Add floating toggle button (instead of auto-open)
    this.createFloatingToggleButton()


    // Inject Save buttons inside product cards
    this.injectSaveButtons()

    this.observeProductGrid()
    
    console.log("[v0] Manequin: Extension initialization complete!")
  } catch (error) {
    console.error("[v0] Initialization failed:", error)
  }
}

  setupMessageListener() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === "toggleSidebar") {
        this.toggleSidebar()
        sendResponse({ success: true })
      }
      return true
    })
  }

  toggleSidebar() {
    console.log("[v0] Toggle sidebar called, current visibility:", this.isVisible)
    if (this.isVisible && this.sidebar) {
      this.closeSidebar()
    } else {
      this.showSidebar()
    }
  }

showSidebar() {
  console.log("[v0] Showing sidebar...")
  if (!this.sidebar) {
    this.createSidebar()
  } else {
    this.sidebar.style.display = "flex"
  }
  this.isVisible = true

  // Hide floating button while sidebar is open
  const btn = document.querySelector("#manequin-toggle-btn")
  if (btn) btn.style.display = "none"

  console.log("[v0] Sidebar is now visible")
}

  async checkAuthStatus() {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user) {
        this.currentUser = user
        this.isAuthenticated = true
        this.username = user.user_metadata?.first_name || user.email.split("@")[0]
        this.savedItems = await getUserLikes()
      }
    } catch (error) {
      console.error("[v0] Error checking auth status:", error)
    }
  }

  loadCSS() {
    console.log("[v0] Manequin: Loading CSS...")
    if (typeof chrome !== "undefined" && chrome.runtime) {
      const cssUrl = chrome.runtime.getURL("sidebar.css")
      const link = document.createElement("link")
      link.rel = "stylesheet"
      link.type = "text/css"
      link.href = cssUrl
      document.head.appendChild(link)
    }
  }

  createSidebar() {
    console.log("[v0] Manequin: Creating sidebar...")

    const existingSidebar = document.querySelector(".manequin-sidebar")
    if (existingSidebar) {
      console.log("[v0] Removing existing sidebar")
      existingSidebar.remove()
    }

    this.sidebar = document.createElement("div")
    this.sidebar.id = "manequin-sidebar"
    this.sidebar.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      width: 350px;
      height: 600px;
      background: white;
      border-radius: 16px;
      box-shadow: 0 20px 40px rgba(0,0,0,0.15);
      z-index: 10000;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      cursor: move;
      user-select: none;
    `

    if (this.isAuthenticated && this.currentUser) {
      console.log("[v0] Manequin: User authenticated, showing main interface")
      this.sidebar.innerHTML = this.createMainHTML()
    } else {
      console.log("[v0] Manequin: User not authenticated, showing login")
      this.sidebar.innerHTML = this.createAuthHTML()
    }

    document.body.appendChild(this.sidebar)
    console.log("[v0] Sidebar appended to body")

    this.attachEventListeners()
    this.attachDragListeners()

    if (this.isAuthenticated && this.currentUser) {
      this.attachChatListeners()
    }

    console.log("[v0] Manequin: Sidebar created and added to DOM")
  }
createFloatingToggleButton() {
  // If button already exists, don’t duplicate
  if (document.querySelector("#manequin-toggle-btn")) return

  const btn = document.createElement("button")
  btn.id = "manequin-toggle-btn"
  btn.innerText = "☰"

  btn.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    width: 48px;
    height: 48px;
    border-radius: 50%;
    border: none;
    background: #E91E63;
    color: white;
    font-size: 20px;
    font-weight: bold;
    box-shadow: 0 4px 10px rgba(0,0,0,0.2);
    cursor: pointer;
    z-index: 10001;
    display: flex;
    align-items: center;
    justify-content: center;
  `

  btn.addEventListener("click", () => this.toggleSidebar())

  document.body.appendChild(btn)
}

  attachDragListeners() {
    this.sidebar.addEventListener("mousedown", (e) => this.startDrag(e))
    document.addEventListener("mousemove", (e) => this.drag(e))
    document.addEventListener("mouseup", () => this.stopDrag())
  }

  startDrag(e) {
    // Don't start drag if clicking on interactive elements
    if (e.target.matches("button, input, textarea, a, .nav-tab, .auth-tab, .chat-send-btn, .remove-favorite")) {
      return
    }

    this.isDragging = true
    this.sidebar.style.cursor = "grabbing"

    const rect = this.sidebar.getBoundingClientRect()
    this.dragOffset.x = e.clientX - rect.left
    this.dragOffset.y = e.clientY - rect.top

    e.preventDefault()
  }

  drag(e) {
    if (!this.isDragging) return

    e.preventDefault()

    const newX = e.clientX - this.dragOffset.x
    const newY = e.clientY - this.dragOffset.y

    // Keep sidebar within viewport bounds
    const maxX = window.innerWidth - this.sidebar.offsetWidth
    const maxY = window.innerHeight - this.sidebar.offsetHeight

    const constrainedX = Math.max(0, Math.min(newX, maxX))
    const constrainedY = Math.max(0, Math.min(newY, maxY))

    this.sidebar.style.left = `${constrainedX}px`
    this.sidebar.style.top = `${constrainedY}px`
    this.sidebar.style.right = "auto" // Remove right positioning
  }

  stopDrag() {
    if (this.isDragging) {
      this.isDragging = false
      this.sidebar.style.cursor = "move"
    }
  }

  createAuthHTML() {
    return `
      <div class="auth-container">
        <div class="auth-header">
          <div class="brand-logo">
            <img src="${chrome.runtime.getURL("icon-128-header.png")}" alt="Manequin" class="logo-icon" width="32" height="32">
          </div>
          <button class="manequin-close">×</button>
        </div>
        
        <div class="auth-content">
          <div class="auth-tabs">
            <button class="auth-tab active" data-auth-tab="login">Sign In</button>
            <button class="auth-tab" data-auth-tab="signup">Sign Up</button>
          </div>
          
          <div class="auth-forms">
            <div class="auth-form active" id="login-form">
              <div class="form-fields">
                <div class="input-group">
                  <input type="email" id="login-email" placeholder="Email" required>
                </div>
                <div class="input-group">
                  <input type="password" id="login-password" placeholder="Password" required>
                </div>
              </div>
              <button class="auth-btn" id="login-btn">Sign In</button>
            </div>
            
            <div class="auth-form" id="signup-form">
              <div class="form-fields">
                <div class="input-group">
                  <input type="text" id="signup-firstname" placeholder="First Name" required>
                </div>
                <div class="input-group">
                  <input type="text" id="signup-lastname" placeholder="Last Name" required>
                </div>
                <div class="input-group">
                  <input type="email" id="signup-email" placeholder="Email" required>
                </div>
                <div class="input-group">
                  <input type="password" id="signup-password" placeholder="Password" required>
                </div>
              </div>
              <button class="auth-btn" id="signup-btn">Sign Up</button>
            </div>
          </div>
        </div>
      </div>
    `
  }

  createMainHTML() {
    return `
      <div class="manequin-header">
        <div class="header-content">
          <div class="brand-logo">
            <img src="${chrome.runtime.getURL("icon-128-header.png")}" alt="Manequin" class="logo-icon" width="32" height="32">
          </div>
        </div>
<div class="header-actions">
  <button class="save-current-btn" title="Save this page">♡</button>
  <button class="sign-out-btn" title="Sign Out"> … </button>
  <button class="manequin-close">×</button>
</div>

      </div>
      
      <div class="main-nav">
        <button class="nav-tab active" data-page="chat">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
          Chat
        </button>
        <button class="nav-tab" data-page="favorites">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
          </svg>
          Favorites
        </button>
      </div>
      
      <div class="page-container">
        <div class="page active" id="chat-page">
          <div class="chat-container">
            <div id="chat-history" class="chat-history">
              <div class="welcome-message">
                <div class="welcome-icon">🌸</div>
                <h3>Hello ${this.username}!</h3>
                <p>I'm here to help you develop self-care rituals and discover wellness habits that nurture your mind, body, and spirit.</p>
                <div class="feature-highlight">
                  <p><strong>✨ New:</strong> Hover over any product on this page to save it to your collection!</p>
                </div>
              </div>
            </div>
            
            <div class="chat-input-area">
              <div class="chat-input-container">
                <input type="text" id="chat-input" placeholder="Ask me about self-care routines, beauty rituals, or wellness habits..." />
                <button id="chat-send" class="chat-send-btn">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="22" y1="2" x2="11" y2="13"></line>
                    <polygon points="22,2 15,22 11,13 2,9 22,2"></polygon>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
        
        <div class="page" id="favorites-page">
          <div class="page-content">
            <div class="page-header">
              <h2>Wellness Collection</h2>
              <p>Your personal sanctuary of self-care discoveries and saved products</p>
            </div>
            <div class="favorites-collection" id="favorites-grid">
              <div class="loading-state">Loading your collection...</div>
            </div>
          </div>
        </div>
      </div>
    `
  }

  attachEventListeners() {
    console.log("[v0] Attaching event listeners...")

    this.sidebar.addEventListener("click", async (e) => {
      console.log("[v0] Click detected on:", e.target)

      if (e.target.classList.contains("manequin-close")) {
        console.log("[v0] Closing sidebar")
        this.closeSidebar()
        return
      }

      if (e.target.classList.contains("sign-out-btn") || e.target.closest(".sign-out-btn")) {
        console.log("[v0] Signing out user")
        await this.handleSignOut()
        return
      }

      if (e.target.classList.contains("save-current-btn") || e.target.closest(".save-current-btn")) {
  console.log("[v0] Save current page clicked")
  this.saveCurrentPage()
  return
}

      if (e.target.classList.contains("nav-tab") || e.target.closest(".nav-tab")) {
        const tab = e.target.closest(".nav-tab")
        const targetPage = tab.dataset.page
        this.switchPage(targetPage)
        return
      }

      if (e.target.classList.contains("remove-favorite")) {
        const itemId = e.target.dataset.id
        this.removeFavorite(itemId)
        return
      }

      if (e.target.id === "login-btn") {
        this.handleLogin()
        return
      }

      if (e.target.id === "signup-btn") {
        this.handleSignup()
        return
      }

      if (e.target.classList.contains("auth-tab")) {
        const targetTab = e.target.dataset.authTab
        this.switchAuthTab(targetTab)
        return
      }
    })

    console.log("[v0] Event listeners attached successfully")
  }

  switchAuthTab(tabName) {
    this.sidebar.querySelectorAll(".auth-tab").forEach((tab) => tab.classList.remove("active"))
    this.sidebar.querySelector(`[data-auth-tab="${tabName}"]`).classList.add("active")

    this.sidebar.querySelectorAll(".auth-form").forEach((form) => form.classList.remove("active"))
    this.sidebar.querySelector(`#${tabName}-form`).classList.add("active")
  }

  switchPage(pageName) {
    console.log(`[v0] Switching to page: ${pageName}`)
    this.sidebar.querySelectorAll(".nav-tab").forEach((tab) => tab.classList.remove("active"))
    this.sidebar.querySelector(`[data-page="${pageName}"]`).classList.add("active")

    this.sidebar.querySelectorAll(".page").forEach((page) => page.classList.remove("active"))
    this.sidebar.querySelector(`#${pageName}-page`).classList.add("active")

    if (pageName === "chat") {
      this.attachChatListeners()
    } else if (pageName === "favorites") {
      this.loadFavorites()
    }
  }

  async loadFavorites() {
    console.log("[v0] Loading favorites...")
    const favoritesGrid = this.sidebar.querySelector("#favorites-grid")
    if (!favoritesGrid) return

    try {
      // Show loading state
      favoritesGrid.innerHTML = '<div class="loading-state">Loading your collection...</div>'

      // Refresh saved items from database
      this.savedItems = await getUserLikes()
      console.log("[v0] Loaded saved items:", this.savedItems)

      // Render favorites
      const favoritesHTML = await this.renderFavorites()
      favoritesGrid.innerHTML = favoritesHTML

      console.log("[v0] Favorites loaded successfully")
    } catch (error) {
      console.error("[v0] Error loading favorites:", error)
      favoritesGrid.innerHTML = `
        <div class="empty-state">
          <div class="empty-illustration">⚠️</div>
          <h3>Unable to Load Collection</h3>
          <p>There was an error loading your saved items. Please try again.</p>
        </div>
      `
    }
  }

  async removeFavorite(itemId) {
    try {
      // Delete the like from the database
      const { error } = await supabase.from("likes").delete().eq("id", itemId)

      if (error) {
        console.error("[v0] Error deleting favorite:", error)
        alert("Failed to remove item from favorites. Please try again.")
        return
      }

      // Remove from local array
      this.savedItems = this.savedItems.filter((item) => item.id !== itemId)

      // Update UI
      const favoritesGrid = this.sidebar.querySelector("#favorites-grid")
      if (favoritesGrid) {
        if (this.savedItems.length === 0) {
          favoritesGrid.innerHTML = `
            <div class="empty-state">
              <div class="empty-illustration">
                ☀️
              </div>
              <h3>Your Wellness Journey Begins</h3>
              <p>Start collecting wellness products that resonate with your soul by hovering over items on beauty websites</p>
            </div>
          `
        } else {
          const itemElement = favoritesGrid.querySelector(`[data-id="${itemId}"]`)
          if (itemElement) {
            itemElement.remove()
          }
        }
      }

      console.log("[v0] Favorite removed successfully")
    } catch (error) {
      console.error("[v0] Error removing favorite:", error)
      alert("Failed to remove item from favorites. Please try again.")
    }
  }

closeSidebar() {
  console.log("[v0] Closing sidebar")
  if (this.sidebar) {
    this.sidebar.style.display = "none"
  }
  this.isVisible = false

  // Show floating button again when sidebar is closed
  const btn = document.querySelector("#manequin-toggle-btn")
  if (btn) btn.style.display = "flex"

  console.log("[v0] Sidebar closed")
}

  async handleSignOut() {
    console.log("[v0] Handling sign out...")

    try {
      await supabase.auth.signOut()
    } catch (error) {
      console.error("[v0] Error signing out:", error)
    }

    this.currentUser = null
    this.isAuthenticated = false
    this.username = "there"
    this.savedItems = []

    this.sidebar.innerHTML = this.createAuthHTML()
    this.attachEventListeners()
    console.log("[v0] Sign out successful, auth interface loaded")
  }
// Save the *entire page* (fallback option)
async saveCurrentPage() {
  if (!this.isAuthenticated) {
    alert("Please log in to save items.")
    return
  }

  const product = {
    title: document.title,
    product_url: window.location.href,
    site_name: window.location.hostname,
    image_url: document.querySelector("img")?.src || null,
    brand: null,
    price: null
  }

  try {
    const { data: productData, error: productError } = await supabase
      .from("products")
      .insert([product])
      .select()
      .single()

    if (productError) throw productError

    await toggleLike("product", productData.id)

    alert("Saved this page to your collection ✨")
    console.log("[v0] Page saved:", productData)
  } catch (err) {
    console.error("[v0] Error saving page:", err)
    alert("Could not save this page, please try again.")
  }
}

// Save a product from a clicked element (e.g. title, link, image)
async saveProductFromElement(el) {
  if (!this.isAuthenticated) {
    alert("Please log in to save items.")
    return
  }

  const product = {
    title: el.innerText.trim(),
    product_url: el.href || window.location.href,
    site_name: window.location.hostname,
    image_url: el.closest("article, div")?.querySelector("img")?.src || null
  }

  try {
    const { data: productData, error } = await supabase
      .from("products")
      .insert([product])
      .select()
      .single()

    if (error) throw error

    await toggleLike("product", productData.id)

    alert(`Saved "${product.title}" to your collection ✨`)
    console.log("[v0] Product saved:", productData)
  } catch (err) {
    console.error("[v0] Error saving product:", err)
    alert("Could not save item, please try again.")
  }
}

  attachChatListeners() {
    const sendBtn = this.sidebar.querySelector("#chat-send")
    const input = this.sidebar.querySelector("#chat-input")
    const history = this.sidebar.querySelector("#chat-history")

    if (!sendBtn || !input || !history) {
      console.warn("[Manequin] Chat UI elements not found")
      return
    }

    sendBtn.addEventListener("click", async () => {
      const message = input.value.trim()
      if (!message) return

      this.addChatBubble(history, "user", message)
      input.value = ""

      try {
        console.log("[v0] Sending message to backend:", message)

        const response = await fetch("https://manequin-backend.vercel.app/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: message,
            context:
              "You are a helpful wellness assistant for the Manequin app focused on self-care rituals, beauty practices, and wellness habits. Provide gentle, nurturing advice about skincare routines, mindfulness practices, beauty rituals, gentle movement, nutrition, and sleep wellness. Keep responses warm, supportive, and encouraging for someone's wellness journey.",
          }),
        })

        console.log("[v0] Response status:", response.status)

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        const data = await response.json()
        console.log("[v0] Response data:", data)

        const reply =
          data.response ||
          data.message ||
          "Hi! I'm Manequin AI, and I'm here to help you develop self-care rituals and discover wellness habits that nurture your mind and body!"
        this.addChatBubble(history, "ai", reply)
      } catch (err) {
        console.error("[v0] Chat error:", err)
        this.addChatBubble(
          history,
          "ai",
          "Hi! I'm Manequin AI, and I'm having trouble connecting right now. Try asking me about self-care routines, beauty rituals, or wellness practices that can nurture your mind and body!",
        )
      }
    })

    input.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        sendBtn.click()
      }
    })
  }

  addChatBubble(container, sender, text) {
    const bubble = document.createElement("div")
    bubble.className = `chat-bubble ${sender}`

    if (sender === "ai") {
      const nameSpan = document.createElement("span")
      nameSpan.className = "chat-name"
      nameSpan.textContent = "Manequin AI"

      const messageSpan = document.createElement("span")
      messageSpan.textContent = text

      bubble.appendChild(nameSpan)
      bubble.appendChild(messageSpan)
    } else {
      bubble.textContent = text
    }

    container.appendChild(bubble)
    container.scrollTop = container.scrollHeight
  }

  async handleLogin() {
    console.log("[v0] Handling login...")
    const email = this.sidebar.querySelector("#login-email").value
    const password = this.sidebar.querySelector("#login-password").value

    if (!email || !password) {
      alert("Please fill in all fields")
      return
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error

      this.currentUser = data.user
      this.isAuthenticated = true
      this.username = data.user.user_metadata?.first_name || data.user.email.split("@")[0]
      this.savedItems = await getUserLikes()

      this.sidebar.innerHTML = this.createMainHTML()
      this.attachEventListeners()
      this.attachChatListeners()
      this.attachDragListeners()
      console.log("[v0] Login successful, main interface loaded")
    } catch (error) {
      console.error("[v0] Login error:", error)
      alert("Login failed: " + error.message)
    }
  }

  async handleSignup() {
    const firstName = this.sidebar.querySelector("#signup-firstname").value
    const lastName = this.sidebar.querySelector("#signup-lastname").value
    const email = this.sidebar.querySelector("#signup-email").value
    const password = this.sidebar.querySelector("#signup-password").value

    if (!firstName || !lastName || !email || !password) {
      alert("Please fill in all fields")
      return
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: firstName,
            last_name: lastName,
          },
        },
      })

      if (error) throw error

      if (data.user) {
        alert("Please check your email to confirm your account before signing in.")
      }
    } catch (error) {
      console.error("[v0] Signup error:", error)
      alert("Signup failed: " + error.message)
    }
  }

  async handleProductLike() {
    if (!this.currentProduct || !this.isAuthenticated) return

    try {
      // First, save the product to the products table
      const { data: productData, error: productError } = await supabase
        .from("products")
        .insert([this.currentProduct])
        .select()
        .single()

      if (productError) throw productError

      // Then, create a like entry
      const result = await toggleLike("product", productData.id)

      // Update overlay appearance
      if (result.liked) {
        this.productOverlay.style.background = "rgba(233, 30, 99, 0.1)"
        this.productOverlay.style.borderColor = "#E91E63"
        this.productOverlay.innerHTML = `
          <div style="display: flex; align-items: center; gap: 6px;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="#E91E63" stroke="#E91E63" stroke-width="2">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
            </svg>
            Saved!
          </div>
        `

        // Show success message
        setTimeout(() => {
          this.hideProductOverlay()
        }, 1500)
      }

      console.log("[v0] Product liked successfully:", productData)
    } catch (error) {
      console.error("[v0] Error liking product:", error)
      alert("Failed to save product. Please try again.")
    }
  }

  async renderFavorites() {
    if (this.savedItems.length === 0) {
      return `
        <div class="empty-state">
          <div class="empty-illustration">
            ☀️
          </div>
          <h3>Your Wellness Journey Begins</h3>
          <p>Start collecting wellness products that resonate with your soul by hovering over items on beauty websites</p>
        </div>
      `
    }

    const productLikes = this.savedItems.filter((item) => item.content_type === "product")
    let products = []

    if (productLikes.length > 0) {
      const productIds = productLikes.map((like) => like.content_id)
      const { data } = await supabase.from("products").select("*").in("id", productIds)
      products = data || []
    }

    if (products.length === 0) {
      return `
        <div class="empty-state">
          <div class="empty-illustration">
            ☀️
          </div>
          <h3>Your Wellness Journey Begins</h3>
          <p>Start collecting wellness products that resonate with your soul by hovering over items on beauty websites</p>
        </div>
      `
    }

    const productItems = products
      .map((product) => {
        const like = productLikes.find((like) => like.content_id === product.id)
        return `
        <article class="favorite-piece product-item" data-id="${like.id}">
          <div class="piece-visual">
            ${product.image_url ? `<img src="${product.image_url}" alt="${product.title}" class="product-image">` : '<div class="product-placeholder">📦</div>'}
            <button class="remove-favorite" data-id="${like.id}" title="Remove from collection">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          <div class="piece-details">
            <h4>${product.title}</h4>
            ${product.price ? `<p class="product-price">${product.price}</p>` : ""}
            <p class="product-brand">${product.brand || product.site_name}</p>
            <p class="save-date">Saved on ${new Date(like.created_at).toLocaleDateString()}</p>
            ${product.product_url ? `<a href="${product.product_url}" target="_blank" class="view-product-btn">View Product</a>` : ""}
          </div>
        </article>
      `
      })
      .join("")

    return productItems
  }

highlightProductTitles() {
  // grab all anchor tags and headings that could be product titles
  const titles = document.querySelectorAll("a, h1, h2, h3")

  titles.forEach(title => {
    if (title.dataset.manequinBound) return // prevent double-binding
    title.dataset.manequinBound = "true"

    title.addEventListener("click", (e) => {
      // only trigger save when holding ctrl (Windows) or cmd (Mac)
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        this.saveProductFromElement(title)
      }
    })
  })

  console.log("[v0] Manequin: Product titles bound with save shortcut")
}

  async handleProductHover(e) {
    if (!this.isAuthenticated || !this.productOverlay) return

    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout)
      this.hideTimeout = null
    }

    const product = this.detectProduct(e.target)
    if (product) {
      this.currentProduct = product
      const isAlreadySaved = await this.isProductAlreadySaved(this.currentProduct)
      if (!isAlreadySaved) {
        this.showProductOverlay(e.target)
      }
    }
  }

  handleProductLeave(e) {
    if (!this.productOverlay) return

    const relatedTarget = e.relatedTarget
    if (relatedTarget && (relatedTarget === this.productOverlay || this.productOverlay.contains(relatedTarget))) {
      return // Don't hide if moving to overlay
    }

    this.scheduleHideOverlay()
  }

  scheduleHideOverlay() {
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout)
    }

    this.hideTimeout = setTimeout(() => {
      this.hideProductOverlay()
      this.hideTimeout = null
    }, 300) // 300ms delay gives users time to move cursor to overlay
  }


detectProduct(element) {
  const productSelectors = [
    '[data-comp="ProductGridItem "]',
    '[data-comp="ProductCard "]',
    '[class*="css-"]',
    'a[href*="/product/"]',
    ".product-tile",
    ".css-1tu1d7g"
  ]

  let productElement = element
  for (let i = 0; i < 5; i++) {
    if (!productElement) break
    if (productSelectors.some(selector => productElement.matches?.(selector))) {
      // Build product object
      const titleEl = productElement.querySelector("h1, h2, h3, a")
      const imgEl = productElement.querySelector("img")
      const priceEl = productElement.querySelector("[class*='Price']")

      return {
        title: titleEl?.innerText || document.title,
        product_url: titleEl?.href || window.location.href,
        site_name: window.location.hostname,
        image_url: imgEl?.src || null,
        price: priceEl?.innerText || null,
        brand: null
      }
    }
    productElement = productElement.parentElement
  }

  return null
}


  extractProductInfo(element) {
    try {
      // Extract product information from the element
      const title = this.findText(element, [
        '[data-testid*="title"]',
        ".product-title",
        ".item-title",
        "h1",
        "h2",
        "h3",
        '[class*="title"]',
        '[class*="name"]',
      ])

      const price = this.findText(element, ['[data-testid*="price"]', ".price", '[class*="price"]', '[class*="cost"]'])

      const image = this.findImage(element)
      const link = this.findLink(element)

      if (!title && !image) return null // Must have at least title or image

      return {
        title: title || "Product",
        price: price || "",
        image_url: image || "",
        product_url: link || window.location.href,
        brand: this.extractBrand(),
        description: "",
        site_name: window.location.hostname,
      }
    } catch (error) {
      console.error("[v0] Error extracting product info:", error)
      return null
    }
  }

  findText(element, selectors) {
    for (const selector of selectors) {
      const found = element.querySelector(selector)
      if (found && found.textContent.trim()) {
        return found.textContent.trim()
      }
    }
    return ""
  }

  findImage(element) {
    const img = element.querySelector("img")
    if (img && img.src) {
      return img.src.startsWith("http") ? img.src : new URL(img.src, window.location.origin).href
    }
    return ""
  }

  findLink(element) {
    const link = element.querySelector("a[href]") || element.closest("a[href]")
    if (link && link.href) {
      return link.href
    }
    return window.location.href
  }

  extractBrand() {
    // Try to extract brand from page title, meta tags, or URL
    const siteName =
      document.querySelector('meta[property="og:site_name"]')?.content ||
      document.querySelector('meta[name="application-name"]')?.content ||
      document.title.split(" ")[0] ||
      window.location.hostname.replace("www.", "")

    return siteName
  }

  async isProductAlreadySaved(product) {
    if (!product || !this.isAuthenticated) return false

    try {
      // Check if a product with the same URL or title already exists
      const { data: existingProducts } = await supabase
        .from("products")
        .select("id")
        .or(`product_url.eq.${product.product_url},title.eq.${product.title}`)
        .eq("site_name", product.site_name)

      if (existingProducts && existingProducts.length > 0) {
        // Check if user has liked any of these products
        const productIds = existingProducts.map((p) => p.id)
        const { data: userLikes } = await supabase
          .from("likes")
          .select("content_id")
          .eq("user_id", this.currentUser.id)
          .eq("content_type", "product")
          .in("content_id", productIds)

        return userLikes && userLikes.length > 0
      }

      return false
    } catch (error) {
      console.error("[v0] Error checking if product is saved:", error)
      return false
    }
  }
}

if (typeof window !== "undefined") {
  console.log("[v0] Initializing Manequin Extension...")
  const manequinExtension = new ManequinExtension()
}
