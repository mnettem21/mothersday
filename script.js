const timeline = document.getElementById("timeline");
const giftModal = document.getElementById("gift-modal");
const giftTrigger = document.getElementById("gift-trigger");
const closeModal = document.getElementById("close-modal");
const giftReveal = document.getElementById("gift-reveal");
const music = document.getElementById("bg-music");
const photoLightbox = document.getElementById("photo-lightbox");
const photoLightboxImg = document.getElementById("photo-lightbox-img");
const photoLightboxCaption = document.getElementById("photo-lightbox-caption");
const photoLightboxClose = document.getElementById("photo-lightbox-close");

/** @typedef {{ image: string; caption: string; taken?: string }} Memory */

/** ISO-ish timestamps; trim extra fractional digits so Date.parse behaves consistently. */
function parseTakenMs(taken) {
  if (!taken) return 0;
  const s = String(taken).replace(/(\.\d{3})\d+/, "$1");
  const ms = Date.parse(s);
  return Number.isNaN(ms) ? 0 : ms;
}

function formatTakenDate(taken) {
  if (!taken) return "";
  const s = String(taken).replace(/(\.\d{3})\d+/, "$1");
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/** @type {Memory[]} */
let memories = [];

function createMemoryCard({ image, caption }, index) {
  const card = document.createElement("article");
  card.className = "memory-card";

  const imageWrap = document.createElement("div");
  imageWrap.className = "memory-image";

  if (image) {
    const img = document.createElement("img");
    img.src = image;
    img.alt = caption || `Memory ${index + 1}`;
    imageWrap.classList.add("memory-image--zoom");
    imageWrap.tabIndex = 0;
    imageWrap.setAttribute("role", "button");
    imageWrap.setAttribute("aria-label", "Enlarge photo");
    imageWrap.append(img);
  } else {
    const placeholder = document.createElement("p");
    placeholder.className = "memory-placeholder";
    placeholder.textContent = `Photo ${index + 1}`;
    imageWrap.append(placeholder);
  }

  const captionEl = document.createElement("p");
  captionEl.className = "memory-caption";
  captionEl.textContent = caption;

  card.append(imageWrap, captionEl);
  return card;
}

function createTimelineItem(memory, index) {
  const side = index % 2 === 0 ? "left" : "right";
  const row = document.createElement("div");
  row.className = `timeline-item timeline-item--${side}`;

  const emptyCell = document.createElement("div");
  emptyCell.className = "timeline-cell timeline-cell--empty";

  const spineCell = document.createElement("div");
  spineCell.className = "timeline-cell timeline-cell--spine";
  const dot = document.createElement("span");
  dot.className = "timeline-dot";
  spineCell.append(dot);

  const contentCell = document.createElement("div");
  contentCell.className = "timeline-cell timeline-cell--content";

  const connector = document.createElement("span");
  connector.className = "timeline-connector";
  connector.setAttribute("aria-hidden", "true");

  const card = createMemoryCard(memory, index);
  contentCell.append(connector, card);

  if (side === "left") {
    row.append(contentCell, spineCell, emptyCell);
  } else {
    row.append(emptyCell, spineCell, contentCell);
  }

  return row;
}

function renderTimeline() {
  timeline.textContent = "";
  const fragment = document.createDocumentFragment();
  memories.forEach((memory, index) => {
    fragment.append(createTimelineItem(memory, index));
  });
  timeline.append(fragment);
}

/**
 * Load timeline entries from photos.json (built by tools/build_photos_manifest.py),
 * already sorted oldest → newest by capture time.
 */
async function loadMemoriesFromManifest() {
  try {
    const res = await fetch("photos.json", { cache: "no-store" });
    if (!res.ok) throw new Error(String(res.status));
    /** @type {Memory[]} */
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) {
      memories = fallbackPlaceholderMemories();
      return;
    }
    memories = data.map((row) => ({
      image: row.image,
      caption: row.caption || formatTakenDate(row.taken),
      taken: row.taken,
    }));
    memories.sort((a, b) => parseTakenMs(a.taken) - parseTakenMs(b.taken));
  } catch (_err) {
    memories = fallbackPlaceholderMemories();
  }
}

function fallbackPlaceholderMemories() {
  return [
    {
      image: "",
      caption:
        "No photos.json or empty list. Put images in ./media (or set PHOTOS_SOURCE) and run python3 tools/build_photos_manifest.py.",
    },
  ];
}

function openGiftModal() {
  giftModal.classList.remove("hidden");
}

function closeGiftModal() {
  giftModal.classList.add("hidden");
}

/** @type {((e: KeyboardEvent) => void) | null} */
let photoLightboxEscapeHandler = null;
/** @type {Element | null} */
let photoLightboxPrevFocus = null;

function closePhotoLightbox() {
  if (!photoLightbox || !photoLightboxImg || !photoLightboxCaption) return;
  photoLightbox.classList.add("hidden");
  photoLightboxImg.removeAttribute("src");
  photoLightboxImg.alt = "";
  photoLightboxCaption.textContent = "";
  photoLightboxCaption.hidden = false;
  photoLightbox.removeAttribute("aria-labelledby");
  photoLightbox.removeAttribute("aria-label");
  document.body.style.overflow = "";
  if (photoLightboxEscapeHandler) {
    document.removeEventListener("keydown", photoLightboxEscapeHandler);
    photoLightboxEscapeHandler = null;
  }
  const prev = photoLightboxPrevFocus;
  photoLightboxPrevFocus = null;
  if (prev && typeof prev.focus === "function") {
    prev.focus();
  }
}

function openPhotoLightbox(src, alt, captionText) {
  if (!photoLightbox || !photoLightboxImg || !photoLightboxCaption) return;
  photoLightboxPrevFocus = document.activeElement;
  const cap = (captionText || "").trim();
  photoLightboxImg.src = src;
  photoLightboxImg.alt = alt || "";
  photoLightboxCaption.textContent = cap;
  photoLightboxCaption.hidden = !cap;
  if (cap) {
    photoLightbox.setAttribute("aria-labelledby", "photo-lightbox-caption");
    photoLightbox.removeAttribute("aria-label");
  } else {
    photoLightbox.removeAttribute("aria-labelledby");
    photoLightbox.setAttribute("aria-label", alt || "Enlarged photo");
  }
  photoLightbox.classList.remove("hidden");
  document.body.style.overflow = "hidden";
  if (photoLightboxEscapeHandler) {
    document.removeEventListener("keydown", photoLightboxEscapeHandler);
  }
  photoLightboxEscapeHandler = (e) => {
    if (e.key === "Escape") closePhotoLightbox();
  };
  document.addEventListener("keydown", photoLightboxEscapeHandler);
  photoLightboxClose?.focus();
}

function setupPhotoLightbox() {
  if (!timeline || !photoLightbox || !photoLightboxImg || !photoLightboxCaption || !photoLightboxClose) return;

  photoLightboxClose.addEventListener("click", closePhotoLightbox);
  photoLightbox.addEventListener("click", (event) => {
    if (event.target === photoLightbox) closePhotoLightbox();
  });

  timeline.addEventListener("click", (event) => {
    const wrap = event.target.closest(".memory-image--zoom");
    if (!wrap || !timeline.contains(wrap)) return;
    const img = wrap.querySelector("img");
    if (!img) return;
    const card = wrap.closest(".memory-card");
    const capEl = card?.querySelector(".memory-caption");
    openPhotoLightbox(img.src, img.alt || "", capEl?.textContent ?? "");
  });

  timeline.addEventListener("keydown", (event) => {
    const wrap = event.target.closest(".memory-image--zoom");
    if (!wrap || !timeline.contains(wrap)) return;
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    const img = wrap.querySelector("img");
    if (!img) return;
    const card = wrap.closest(".memory-card");
    const capEl = card?.querySelector(".memory-caption");
    openPhotoLightbox(img.src, img.alt || "", capEl?.textContent ?? "");
  });
}

function setupBackgroundMusic() {
  if (!music) return;

  let fallbackAttached = false;

  function detachScrollFallback() {
    if (!fallbackAttached) return;
    window.removeEventListener("wheel", tryPlayAfterScrollGesture);
    window.removeEventListener("scroll", tryPlayAfterScrollGesture, true);
    fallbackAttached = false;
  }

  async function tryPlayAfterScrollGesture() {
    if (!music.paused) {
      detachScrollFallback();
      return;
    }
    try {
      await music.play();
      detachScrollFallback();
    } catch {
      /* autoplay policy — wait for another gesture */
    }
  }

  function attachScrollFallback() {
    if (fallbackAttached) return;
    fallbackAttached = true;
    window.addEventListener("wheel", tryPlayAfterScrollGesture, { passive: true });
    window.addEventListener("scroll", tryPlayAfterScrollGesture, { passive: true, capture: true });
  }

  music.addEventListener("playing", detachScrollFallback);

  void (async () => {
    try {
      await music.play();
    } catch {
      attachScrollFallback();
    }
  })();
}

function setupGiftPopup() {
  giftTrigger.addEventListener("click", openGiftModal);
  closeModal.addEventListener("click", closeGiftModal);
  giftModal.addEventListener("click", (event) => {
    if (event.target === giftModal) closeGiftModal();
  });

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          openGiftModal();
          observer.disconnect();
        }
      });
    },
    { threshold: 0.75 }
  );

  observer.observe(giftReveal);
}

async function init() {
  await loadMemoriesFromManifest();
  renderTimeline();
  setupPhotoLightbox();
  setupBackgroundMusic();
  setupGiftPopup();
}

init();
