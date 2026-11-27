
/* ApexVision — Combined Tracking iPad Landscape
   Reuses the working Shot Tracker court layout.
   Moves ORIGINAL controls; does not clone or rebuild them. */

(() => {
  "use strict";

  const api = window.apexPostgame;
  if (!api || api.mode !== "combined") return;

  const $ = id => document.getElementById(id);

  const landscape = window.matchMedia(
    "(min-width:701px) and (max-width:1366px) and (orientation:landscape)"
  );

  const body = document.body;
  const screen = $("postgame-screen");
  const section = $("post-shot-section");
  const workspace = section?.querySelector(".pg-shot-workspace");
  const courtArea = section?.querySelector(".pg-shot-court-area");
  const court = $("postgame-court");
  const quick = $("post-quick-root");
  const modes = section?.querySelector(".pg-court-modes");
  const toolbar = screen?.querySelector(".pg-review-toolbar");

  if (!screen || !section || !workspace || !courtArea ||
      !court || !quick || !modes || !toolbar) return;

  let installed = false;
  let left = null;
  let right = null;
  let sizeObserver = null;
  let viewObserver = null;
  let scheduled = false;

  const moved = new Map();

  function move(element, destination) {
    if (!element || !destination) return;

    if (!moved.has(element)) {
      const marker = document.createComment(
        "Original Combined Tracking location"
      );
      element.before(marker);
      moved.set(element, marker);
    }

    destination.appendChild(element);
  }

  function fitCourt() {
    if (!installed || !workspace) return;

    const view = court.viewBox.baseVal;

    if (!view.width || !view.height) return;

    const workspaceWidth = workspace.clientWidth;
    const workspaceHeight = workspace.clientHeight;

    if (!workspaceWidth || !workspaceHeight) return;

    const gap = 10;
    const clearance = 12;

    // EXACT same column calculation as Shot Tracking.
    const idealCourtWidth =
      (workspaceHeight - clearance) *
      (view.width / view.height) +
      clearance;

    const maxCourtWidth = workspaceWidth * 0.8;

    const leftWidth = Math.ceil(
      Math.min(idealCourtWidth, maxCourtWidth)
    );

    workspace.style.setProperty(
      "grid-template-columns",
      `${leftWidth}px minmax(0,1fr)`,
      "important"
    );

    const wrap = court.closest(".postgame-court-workspace");
    if (!wrap) return;

    // Keep the court proportional — never stretch.
    const availableW = Math.max(1, wrap.clientWidth - clearance);
    const availableH = Math.max(1, wrap.clientHeight - clearance);

    const scale = Math.min(
      availableW / view.width,
      availableH / view.height
    );

    court.style.setProperty(
      "--pg-combined-court-w",
      view.width * scale + "px"
    );

    court.style.setProperty(
      "--pg-combined-court-h",
      view.height * scale + "px"
    );
  }

  function scheduleFit() {
    if (!installed || scheduled) return;

    scheduled = true;

    requestAnimationFrame(() => {
      scheduled = false;
      fitCourt();
    });
  }

  function install() {
    if (installed || !landscape.matches || screen.hidden) return;

    const wrap = court.closest(".postgame-court-workspace");
    if (!wrap) return;

    installed = true;

    left = document.createElement("div");
    left.className = "pg-combined-ipad-left";

    right = document.createElement("div");
    right.className = "pg-combined-ipad-right";

    // The original tracked/opponent/quick controls
    // remain inside post-quick-root.
    const quickPanel = document.createElement("div");
    quickPanel.className = "pg-combined-ipad-quick";

    right.appendChild(quickPanel);

    // Use the same left / right structure as Shot Tracking.
    workspace.append(left, right);

    move(courtArea, left);
move(quick, quickPanel);
move(modes, toolbar);

// Move the existing review buttons into the toolbar action row.
const actionRow = toolbar.querySelector(".postgame-quarter-actions");
const floatingSteps = document.querySelector(".pg-floating-steps");

if (actionRow && floatingSteps) {
  const reviewButtons = [...floatingSteps.querySelectorAll("button")];

  for (const button of reviewButtons) {
    const label = button.textContent.trim();

    if (label === "Next Quarter" || label === "Finish Review") {
      move(button, actionRow);
    }
  }
}

    body.classList.add("pg-combined-ipad-layout");

    sizeObserver = new ResizeObserver(scheduleFit);
    sizeObserver.observe(workspace);

    viewObserver = new MutationObserver(scheduleFit);
    viewObserver.observe(court, {
      attributes: true,
      attributeFilter: ["viewBox", "class"]
    });

    scheduleFit();
  }

  function restore() {
    if (!installed) return;

    sizeObserver?.disconnect();
    viewObserver?.disconnect();

    sizeObserver = null;
    viewObserver = null;

    for (const [element, marker] of moved) {
      if (marker.parentNode) {
        marker.replaceWith(element);
      }
    }

    moved.clear();

    left?.remove();
    right?.remove();
    left = null;
    right = null;

    court.style.removeProperty("--pg-combined-court-w");
    court.style.removeProperty("--pg-combined-court-h");

    workspace.style.removeProperty("grid-template-columns");

    body.classList.remove("pg-combined-ipad-layout");

    installed = false;
  }

  function update() {
    if (landscape.matches) {
      install();
      scheduleFit();
    } else {
      restore();
    }
  }

  window.addEventListener("apex:postgame-ready", () => {
    requestAnimationFrame(update);
  });

  window.addEventListener("apex:court-view-updated", scheduleFit);

  window.addEventListener("resize", update);
  landscape.addEventListener("change", update);

  requestAnimationFrame(update);
})();


/* ApexVision — Combined Tracking iPad Portrait */
(() => {
  "use strict";

  const api = window.apexPostgame;
  if (!api || api.mode !== "combined") return;

  const $ = id => document.getElementById(id);

  const portrait = window.matchMedia(
    "(min-width:701px) and (max-width:1366px) " +
    "and (orientation:portrait)"
  );

  const section = $("post-shot-section");
  const toolbar = document.querySelector(".pg-review-toolbar");
  const workspace = section?.querySelector(".pg-shot-workspace");
  const modes = section?.querySelector(".pg-court-modes") ||
                document.querySelector(".pg-court-modes");

  if (!section || !toolbar || !workspace || !modes) return;

  let card = null;
  let originalMarker = null;

  function renderLastEvent() {
    if (!card) return;

    const events = (api.getEvents?.() || []).slice();

    events.sort((a, b) =>
      String(a.created_at || a.id || "").localeCompare(
        String(b.created_at || b.id || "")
      )
    );

    const event = events.at(-1);
    const game = api.getGame?.() || {};
    const players = api.getPlayers?.() || [];

    const team = card.querySelector(".pg-portrait-event-team");
    const detail = card.querySelector(".pg-portrait-event-detail");

    if (!event) {
      team.textContent = "No events recorded";
      detail.textContent = "Record a stat to see it here.";
      return;
    }

    const teamName = event.team === "us"
      ? game.team_name || "Tracked Team"
      : game.opponent || "Opponent";

    const player = players.find(
      p => String(p.id) === String(event.player_id)
    );

    const jersey = player
      ? " · #" + (player.number ?? "?")
      : "";

    const type = String(event.type || "stat")
      .replaceAll("_", " ")
      .toUpperCase();

    const isShot = event.type === "shot" ||
                   event.type === "free_throw";

    const description = isShot
      ? `${event.made ? "MADE" : "MISSED"} ${event.points ?? 1}PT`
      : type;

    team.textContent = teamName + jersey;

    detail.textContent =
      `Q${event.period || api.getPeriod?.() || 1} · ${description}`;
  }

  function removeCourtLabel() {
    const courtArea = section.querySelector(".pg-shot-court-area");
    if (!courtArea) return;

    // Only target the standalone view heading, never
    // the court buttons, SVG, or team labels.
    for (const element of courtArea.querySelectorAll(
      "div, span, strong, h2, h3"
    )) {
      if (element.children.length ||
          element.closest("button, svg")) continue;

      const text = element.textContent.trim().toUpperCase();

      if (text !== "FULL COURT" && text !== "HALF COURT") {
        continue;
      }

      const parent = element.parentElement;

      const heading = parent &&
        parent.children.length === 1 &&
        !parent.matches(".postgame-court-workspace")
          ? parent
          : element;

      heading.classList.add("pg-portrait-hidden-court-label");
    }
  }

  function install() {
    if (!portrait.matches) return;

    document.body.classList.add("pg-combined-ipad-portrait");

    const actionRow = toolbar.querySelector(
      ".postgame-quarter-actions"
    );

    if (actionRow && modes.parentElement !== actionRow) {
      if (!originalMarker) {
        originalMarker = document.createComment(
          "Original court buttons location"
        );
        modes.before(originalMarker);
      }

      actionRow.appendChild(modes);
    }

    if (!card) {
      card = document.createElement("div");
      card.className = "pg-portrait-last-event";

      card.innerHTML = `
        <div class="pg-portrait-event-label">
          <span>LAST TRACKED EVENT</span>
          <span class="pg-portrait-event-team"></span>
        </div>
        <strong class="pg-portrait-event-detail"></strong>
      `;

      workspace.before(card);
    }

    removeCourtLabel();
    renderLastEvent();

// Expand only on larger portrait iPads.
// Always clear the expansion on smaller iPads.
const courtWorkspace = section.querySelector(
  ".postgame-court-workspace"
);

if (courtWorkspace) {
  if (window.innerWidth < 900) {
    courtWorkspace.style.removeProperty("min-height");
  } else {
    const top = courtWorkspace.getBoundingClientRect().top;

    const availableHeight = Math.max(
      0,
      Math.floor(window.innerHeight - top - 24)
    );

    courtWorkspace.style.setProperty(
      "min-height",
      `${availableHeight}px`,
      "important"
    );
  }
}
    
  }

  function restore() {
    section.querySelector(".postgame-court-workspace")
  ?.style.removeProperty("min-height");
    document.body.classList.remove("pg-combined-ipad-portrait");

    if (originalMarker?.parentNode) {
      originalMarker.replaceWith(modes);
    }

    originalMarker = null;

    card?.remove();
    card = null;

    section.querySelectorAll(
      ".pg-portrait-hidden-court-label"
    ).forEach(el => {
      el.classList.remove("pg-portrait-hidden-court-label");
    });
  }

  function update() {
    if (portrait.matches) install();
    else restore();
  }

  window.addEventListener("apex:postgame-ready", update);
  window.addEventListener("resize", update);
  portrait.addEventListener("change", update);

  document.addEventListener(
    "apex:postgame-events-updated",
    renderLastEvent
  );

  window.addEventListener(
    "apex:postgame-events-updated",
    renderLastEvent
  );

  window.addEventListener(
    "apex:shot-review-saved",
    renderLastEvent
  );

  $("post-period")?.addEventListener(
    "change",
    renderLastEvent
  );

  requestAnimationFrame(update);
})();
