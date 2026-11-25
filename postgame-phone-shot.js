
/* ApexVision — Phone Shot Tracking + Review */
(() => {
  "use strict";

  const $ = id => document.getElementById(id);
  const api = window.apexPostgame;
  if (!api || api.mode !== "shot") return;

  const phone = window.matchMedia(
    "(max-width:700px) and (orientation:portrait)"
  );

  const screen = $("postgame-screen");
  const shotSection = $("post-shot-section");
  if (!screen || !shotSection) return;

  let initialized = false;
  let activePage = "court";
  let saveBusy = false;

  const teamName = team => {
    const game = api.getGame() || {};
    return team === "us"
      ? (game.team_name || "Tracked team")
      : (game.opponent || "Opponent");
  };

  const quarterName = p =>
    Number(p) <= 4 ? "Q" + p : "OT" + (Number(p) - 4);

  const shotsInOrder = () => api.getEvents()
    .filter(e =>
      ["shot", "free_throw"].includes(e.type)
    )
    .slice()
    .sort((a, b) =>
      String(a.created_at || a.id)
        .localeCompare(String(b.created_at || b.id))
    );

  function guidedMode() {
    return $("pg-guided-enable")
      ?.getAttribute("aria-pressed") === "true";
  }

  function updateInfo() {
    const info = $("pg-shot-compact-info");
    if (!info) return;

    const heading = info.querySelector("small");
    const title = info.querySelector("strong");
    const detail = info.querySelector("span");

    if (guidedMode()) {
      const target =
        window.apexCourtReview?.getGuidedTarget?.();

      heading.textContent = "GUIDED TRACKING";

      if (target) {
        title.textContent = teamName(target.team) +
          " · " +
          (target.made ? "Made " : "Missed ") +
          target.points + "PT";

        detail.textContent =
          quarterName(target.period) +
          " · Tap the shot location on the court";
      } else {
        title.textContent =
          $("pg-guided-hint")?.textContent?.trim() ||
          "Select the next recorded shot";

        detail.textContent =
          $("pg-guided-status")?.textContent || "";
      }
      return;
    }

    const shots = shotsInOrder().filter(e =>
      e.type === "shot" &&
      Number(e.period) === Number(api.getPeriod())
    );

    const last = shots.at(-1);

    heading.textContent = "FREE TRACKING · LAST SHOT";

    title.textContent = last
      ? teamName(last.team) + " · " +
        (last.made ? "Made " : "Missed ") +
        last.points + "PT"
      : "No shots recorded this quarter";

    detail.textContent = last
      ? (last.x != null && last.y != null
          ? "Location recorded"
          : "Location pending")
      : "Tap the court to record or locate a shot";
  }

  function calculateShooting(events) {
    const s = {
      "2PM": 0, "2PA": 0,
      "3PM": 0, "3PA": 0,
      FTM: 0, FTA: 0
    };

    for (const e of events) {
      const made = e.made === true;

      if (e.type === "shot") {
        const key = Number(e.points) === 3 ? "3" : "2";
        s[key + "PA"]++;
        if (made) s[key + "PM"]++;
      }

      if (e.type === "free_throw") {
        s.FTA++;
        if (made) s.FTM++;
      }
    }

    return s;
  }

  function pct(made, attempts) {
    return attempts
      ? (100 * made / attempts).toFixed(1) + "%"
      : "—";
  }

  function renderBox() {
    const team = $("pg-shot-review-team").value;

    const events = api.getEvents().filter(e =>
      e.team === team
    );

    const s = calculateShooting(events);

    const values = {
      "2PT": s["2PM"] + "/" + s["2PA"],
      "2P%": pct(s["2PM"], s["2PA"]),
      "3PT": s["3PM"] + "/" + s["3PA"],
      "3P%": pct(s["3PM"], s["3PA"]),
      "FG%": pct(
        s["2PM"] + s["3PM"],
        s["2PA"] + s["3PA"]
      ),
      "FT": s.FTM + "/" + s.FTA,
      "FT%": pct(s.FTM, s.FTA)
    };

    const table = $("pg-shot-box-table");
    table.replaceChildren();

    const header = document.createElement("tr");
    const row = document.createElement("tr");

    for (const [key, value] of Object.entries(values)) {
      const th = document.createElement("th");
      th.textContent = key;
      header.append(th);

      const td = document.createElement("td");
      td.textContent = value;
      row.append(td);
    }

    table.append(header, row);
  }

  function renderSequence() {
    const host = $("pg-shot-review-sequence");
    host.replaceChildren();

    const quarter = api.getPeriod();
    const roster = api.getPlayers();

    const shots = shotsInOrder()
      .filter(e => Number(e.period) === Number(quarter))
      .reverse();

    if (!shots.length) {
      host.textContent = "No recorded shots in this quarter.";
      return;
    }

    for (const [index, e] of shots.entries()) {
      const row = document.createElement("article");
      row.className = "pg-shot-sequence-entry";

      const heading = document.createElement("strong");
      const details = document.createElement("small");

      heading.textContent =
        "#" + (shots.length - index) +
        " · " + teamName(e.team) +
        " · " +
        (e.made ? "Made " : "Missed ") +
        (e.type === "free_throw"
          ? "FT"
          : e.points + "PT");

      const player = roster.find(
        p => String(p.id) === String(e.player_id)
      );

      const parts = [quarterName(e.period)];

      if (player) {
        parts.push("Player #" + (player.number ?? "?"));
      }

      if (e.type === "shot") {
        if (e.x != null && e.y != null) {
          parts.push("Court location recorded");
          parts.push(
            "(" + Math.round(e.x) +
            ", " + Math.round(e.y) + ")"
          );
        } else {
          parts.push("Location pending");
        }
      } else {
        parts.push("Free throw · No court location required");
      }

      // Show any optional classification already loaded.
      if (e.category) parts.push(e.category);
      if (e.creation) parts.push(e.creation);
      if (e.pressure) parts.push(e.pressure);

      details.textContent = parts.join(" · ");

      row.append(heading, details);
      host.append(row);
    }
  }

  function refresh() {
    if (!api.getGame() || !initialized) return;
    updateInfo();
    renderBox();
    renderSequence();
  }

  function showPage(page) {
    if (!phone.matches) page = "court";

    if (
      page === "review" &&
      window.apexCourtReview?.isBusy?.()
    ) {
      api.notify(
        "Finish or cancel the current shot before opening Review."
      );
      return;
    }

    activePage = page;
    const reviewing = page === "review";

    document.body.classList.toggle(
      "pg-shot-review-open", reviewing
    );

    $("pg-shot-phone-review").hidden = !reviewing;

    $("pg-shot-phone-pages")
      .querySelectorAll("[data-page]")
      .forEach(button => {
        if (button.dataset.page === page) {
          button.setAttribute("aria-current", "page");
        } else {
          button.removeAttribute("aria-current");
        }
      });

    if (reviewing) refresh();
  }

  // Add a missing free throw only with explicit confirmation.
  async function recordFT(made) {
    if (saveBusy) return;

    if (window.apexCourtReview?.isBusy?.()) {
      api.notify(
        "Finish or cancel the active shot before recording a free throw."
      );
      return;
    }

    const team = $("pg-phone-ft-team").value;
    const period = api.getPeriod();

    const existing = api.getEvents().filter(e =>
      e.type === "free_throw" &&
      e.team === team &&
      Number(e.period) === Number(period)
    );

    if (!confirm(
      "Confirm this is a MISSING " +
      (made ? "MADE" : "MISSED") +
      " free throw for " + teamName(team) +
      " in " + quarterName(period) +
      ". Existing attempts must not be entered again."
    )) return;

    if (existing.length && !confirm(
      existing.length + " free throws are already recorded " +
      "for this team in this quarter. " +
      "Are you certain this is an ADDITIONAL attempt?"
    )) return;

    saveBusy = true;
    const buttons = document.querySelectorAll(
      ".pg-phone-ft-row button"
    );
    buttons.forEach(b => b.disabled = true);

    try {
      const saved = await api.saveEvent({
        type: "free_throw",
        team,
        playerId: null,
        points: 1,
        made
      }, $("post-review-save-anchor"));

      if (saved) {
        await api.refresh();
        document.dispatchEvent(
          new CustomEvent("apex:postgame-events-updated")
        );
        api.notify(
          "Missing free throw saved. The official final remains unchanged."
        );
      }
    } catch (error) {
      api.notify(
        "Unable to save free throw: " + error.message
      );
    } finally {
      saveBusy = false;
      buttons.forEach(b => b.disabled = false);
      refresh();
    }
  }

  function setup() {
    if (initialized || !phone.matches) return;

    // Mobile v8 creates this workspace after game loading.
    const stage = screen.querySelector(".pg-v8-stage");
    const dock = screen.querySelector(".pg-v8-bottom");
    const bar = screen.querySelector(".pg-v8-review-bar");

    if (!stage || !dock || !bar) return;

    initialized = true;

    // Clean replacement for the former info layout.
    const info = document.createElement("div");
    info.id = "pg-shot-compact-info";
    info.innerHTML =
      "<small></small><strong></strong><span></span>";
    stage.prepend(info);

    // Reuse original half-court switching inside More.
    const half = $("pg-half-toggle");
    const more = $("pg-mobile-extra");
    if (half && more) more.appendChild(half);

    // Free throws work in both tracking modes.
    const ft = document.createElement("div");
    ft.className = "pg-phone-ft-row";
    ft.innerHTML = `
      <select id="pg-phone-ft-team"
              aria-label="Free throw team">
        <option value="us">Tracked</option>
        <option value="opponent">Opponent</option>
      </select>
      <button type="button" class="pg-phone-ft-make">
        FT Made
      </button>
      <button type="button" class="pg-phone-ft-miss">
        FT Miss
      </button>
    `;

    dock.appendChild(ft);

    ft.querySelector(".pg-phone-ft-make")
      .addEventListener("click", () => recordFT(true));

    ft.querySelector(".pg-phone-ft-miss")
      .addEventListener("click", () => recordFT(false));

    // Put indicators directly above the court workspace.
    const pages = document.createElement("nav");
    pages.id = "pg-shot-phone-pages";
    pages.setAttribute("aria-label", "Shot tracking screens");

    pages.innerHTML = `
      <button type="button" data-page="court"
              aria-label="Court tracking"></button>
      <button type="button" data-page="review"
              aria-label="Shot review"></button>
    `;

    shotSection.before(pages);

    const review = document.createElement("section");
    review.id = "pg-shot-phone-review";
    review.hidden = true;

    review.innerHTML = `
      <div id="pg-shot-box-card"
           class="pg-shot-review-card">
        <h3>Shooting Box Score</h3>
        <select id="pg-shot-review-team"
                aria-label="Box score team">
          <option value="us">Tracked team</option>
          <option value="opponent">Opponent</option>
        </select>
        <div class="pg-shot-review-scroll">
          <table id="pg-shot-box-table"></table>
        </div>
      </div>

      <div id="pg-shot-sequence-card"
           class="pg-shot-review-card">
        <h3>Shot Sequence</h3>
        <div id="pg-shot-review-sequence"
             class="pg-shot-review-scroll"></div>
      </div>
    `;

    shotSection.after(review);

    $("pg-shot-review-team")
      .addEventListener("change", renderBox);

    pages.addEventListener("click", event => {
      const b = event.target.closest("[data-page]");
      if (b) showPage(b.dataset.page);
    });

    // Horizontal swipes only, preserving court shot gestures.
    function swipe(element, from, to, direction) {
      let start = null;

      element.addEventListener("touchstart", e => {
        start = null;
        if (!phone.matches || activePage !== from) return;

        // The court already has its own half-switch gesture.
        if (e.target.closest(
          "svg,button,select,input,textarea,dialog," +
          ".pg-shot-review-scroll,#postgame-court-prompt"
        )) return;

        const t = e.touches[0];
        if (t) start = { x:t.clientX, y:t.clientY };
      }, { passive:true });

      element.addEventListener("touchend", e => {
        if (!start || activePage !== from) return;
        const t = e.changedTouches[0];
        if (!t) return;

        const dx = t.clientX - start.x;
        const dy = t.clientY - start.y;
        start = null;

        if (
          Math.abs(dx) < 75 ||
          Math.abs(dx) < Math.abs(dy) * 1.7
        ) return;

        if (
          (direction === "right" && dx > 0) ||
          (direction === "left" && dx < 0)
        ) {
          showPage(to);
        }
      }, { passive:true });
    }

    swipe(shotSection, "court", "review", "right");
    swipe(review, "review", "court", "left");

    // Keep FT team in sync with Guided shot selection.
    window.addEventListener(
      "apex:guided-shot-selected", event => {
        if (event.detail?.team) {
          $("pg-phone-ft-team").value = event.detail.team;
        }
        queueMicrotask(updateInfo);
      }
    );

    $("pg-guided-free")?.addEventListener(
      "click", () => queueMicrotask(updateInfo)
    );

    $("pg-guided-enable")?.addEventListener(
      "click", () => queueMicrotask(updateInfo)
    );

    $("pg-guided-previous")?.addEventListener(
      "click", () => queueMicrotask(updateInfo)
    );

    $("pg-guided-next")?.addEventListener(
      "click", () => queueMicrotask(updateInfo)
    );

    $("pg-guided-skip")?.addEventListener(
      "click", () => queueMicrotask(updateInfo)
    );

    $("post-period")?.addEventListener(
      "change", () => queueMicrotask(refresh)
    );

    document.addEventListener(
      "apex:postgame-events-updated", refresh
    );

    window.addEventListener(
      "apex:shot-review-saved", () =>
        queueMicrotask(refresh)
    );

    phone.addEventListener("change", () => {
      if (!phone.matches) {
        document.body.classList.remove(
          "pg-shot-review-open"
        );
      } else {
        showPage("court");
      }
    });

    showPage("court");
    refresh();
  }

  window.addEventListener("apex:postgame-ready", setup);

  // Also support initialization after the ready event.
  setup();
})();
