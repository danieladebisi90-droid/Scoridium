
/* ApexVision — Phone Stat Tracking Swipe Review */
(() => {
  "use strict";

  const $ = id => document.getElementById(id);
  const api = window.apexPostgame;

  if (!api || api.mode !== "stat") return;

  const phone = window.matchMedia(
    "(min-width:0px)"
  );

  const screen = $("postgame-screen");
  const tracker = $("post-stat-section");
  const root = $("post-quick-root");

  if (!screen || !tracker || !root) return;

  let currentPage = "tracking";
  let selectedPlayer = null;

  // Create the alternate review screen.
  const review = document.createElement("section");
  review.id = "pg-phone-review";
  review.setAttribute("aria-label", "Game statistics review");

  review.innerHTML = `
    <div id="pg-phone-box-card" class="pg-phone-review-card">
      <div class="pg-phone-review-heading">
        <div>
          <h3>Box Score</h3>
          <small id="pg-phone-box-scope">Tracked team</small>
        </div>
        <button id="pg-phone-team-total"
                type="button">Team Totals</button>
      </div>

      <div class="pg-phone-box-scroll">
        <table id="pg-phone-box-table"></table>
      </div>
    </div>

    <div id="pg-phone-plays-card" class="pg-phone-review-card">
      <div class="pg-phone-review-heading">
        <h3>Play-by-Play</h3>
        <small id="pg-phone-play-period">Q1</small>
      </div>

      <div id="pg-phone-play-list"></div>
      <p class="pg-phone-review-note">
        Scroll inside to view earlier plays
      </p>
    </div>
  `;

  tracker.after(review);

  // Two interactive dots, also usable without swiping.
  const pages = document.createElement("nav");
  pages.id = "pg-phone-pages";
  pages.setAttribute("aria-label", "Tracking pages");

  pages.innerHTML = `
    <button type="button"
            data-page="tracking"
            aria-label="Tracking screen"></button>
    <button type="button"
            data-page="review"
            aria-label="Review screen"></button>
  `;

  // Place page indicators above the tracking/review workspace
tracker.before(pages);

  const stats = events => {
    const s = {
      PTS: 0, REB: 0, AST: 0, STL: 0,
      BLK: 0, TO: 0, PF: 0,
      FGM: 0, FGA: 0,
      "3PM": 0, "3PA": 0,
      FTM: 0, FTA: 0
    };

    for (const e of events) {
      const made = e.made === true;

      if (e.type === "shot") {
        if (!e.non_fga) {
          s.FGA++;
          if (Number(e.points) === 3) s["3PA"]++;
        }

        if (made) {
          s.FGM++;
          s.PTS += Number(e.points) || 0;
          if (Number(e.points) === 3) s["3PM"]++;
        }
      }

      if (e.type === "free_throw") {
        s.FTA++;
        if (made) {
          s.FTM++;
          s.PTS++;
        }
      }

      if ([
        "offensive_rebound",
        "defensive_rebound",
        "team_offensive_rebound",
        "team_defensive_rebound"
      ].includes(e.type)) s.REB++;

      if (e.type === "assist") s.AST++;
      if (e.type === "steal") s.STL++;
      if (e.type === "block") s.BLK++;
      if (e.type === "turnover") s.TO++;
      if (e.type === "foul") s.PF++;
    }

    return s;
  };

  function renderBox() {
    const players = api.getPlayers();
    const player = players.find(
      p => String(p.id) === String(selectedPlayer)
    );

    const events = api.getEvents().filter(e =>
      e.team === "us" &&
      (!player || String(e.player_id) === String(player.id))
    );

    $("pg-phone-box-scope").textContent = player
      ? "#" + (player.number ?? "?") + " — " +
        (player.first_name || "")
      : "Tracked team";

    const values = stats(events);
    const table = $("pg-phone-box-table");

    table.replaceChildren();

    const header = document.createElement("tr");
    const data = document.createElement("tr");

    for (const [key, value] of Object.entries(values)) {
      const th = document.createElement("th");
      th.textContent = key;
      header.append(th);

      const td = document.createElement("td");
      td.textContent = value;
      data.append(td);
    }

    table.append(header, data);
  }

  function renderPlays() {
    const host = $("pg-phone-play-list");
    const period = api.getPeriod();

    const quarter = period <= 4
      ? "Q" + period
      : "OT" + (period - 4);

    $("pg-phone-play-period").textContent = quarter;

    const players = api.getPlayers();

    const events = api.getEvents()
      .filter(e => Number(e.period) === Number(period))
      .slice()
      .sort((a, b) =>
        String(b.created_at || b.id).localeCompare(
          String(a.created_at || a.id)
        )
      );

    host.replaceChildren();

    if (!events.length) {
      const row = document.createElement("div");
      row.className = "pg-phone-play";
      row.textContent = "No recorded events for " + quarter;
      host.append(row);
      return;
    }

    for (const event of events) {
      const row = document.createElement("div");
      row.className = "pg-phone-play";

      const player = players.find(
        p => String(p.id) === String(event.player_id)
      );

      const who = event.team === "opponent"
        ? (api.getGame()?.opponent || "Opponent")
        : player
          ? "#" + (player.number ?? "?")
          : "Tracked team";

      let action = String(event.type || "")
        .replaceAll("_", " ");

      if (event.type === "shot") {
        action =
          (event.made ? "Made " : "Missed ") +
          event.points + "PT";
      }

      if (event.type === "free_throw") {
        action = event.made
          ? "Made FT"
          : "Missed FT";
      }

      row.textContent =
        quarter + " · " + who + " — " + action;

      host.append(row);
    }

    host.scrollTop = 0;
  }

  function refresh() {
    if (!api.getGame()) return;
    renderBox();
    renderPlays();
  }

  function showPage(page) {
    if (!phone.matches) {
      currentPage = "tracking";
      document.body.classList.remove(
        "pg-phone-review-open"
      );
      tracker.removeAttribute("aria-hidden");
      review.hidden = true;
      pages.hidden = true;
      return;
    }

    currentPage = page;

    const reviewing = page === "review";

    document.body.classList.toggle(
      "pg-phone-review-open",
      reviewing
    );

    if (reviewing) {
      tracker.setAttribute("aria-hidden", "true");
      refresh();
    } else {
      tracker.removeAttribute("aria-hidden");
    }

    review.hidden = !reviewing;
    pages.hidden = false;

    pages.querySelectorAll("[data-page]")
      .forEach(button => {
        if (button.dataset.page === page) {
          button.setAttribute("aria-current", "page");
        } else {
          button.removeAttribute("aria-current");
        }
      });
  }

  pages.addEventListener("click", event => {
    const button = event.target.closest("[data-page]");
    if (!button) return;
    showPage(button.dataset.page);
  });

  // Remember the chosen jersey without changing
  // or rebuilding Quick Tracker's own state.
  root.addEventListener("click", event => {
    const button = event.target.closest("button[data-qv]");
    if (!button || button.disabled) return;

    if (button.dataset.qv === "player") {
      selectedPlayer = button.dataset.player;
    }

    if (button.dataset.qv === "teamPlayer") {
      selectedPlayer = null;
    }
  });

  $("pg-phone-team-total").addEventListener("click", () => {
    selectedPlayer = null;
    renderBox();
  });

  // Swipe right: Tracking -> Review.
  // Swipe left: Review -> Tracking.
  // Vertical scrolling and ordinary stat taps are preserved.
  function enableSwipe(element, fromPage, toPage, direction) {
    let startX = 0;
    let startY = 0;
    let blocked = false;

    element.addEventListener("touchstart", event => {
      if (!phone.matches || currentPage !== fromPage) return;

      const target = event.target;
      blocked = !!target.closest(
        "select, input, textarea, .pg-phone-box-scroll"
      );

      const touch = event.touches[0];
      startX = touch.clientX;
      startY = touch.clientY;
    }, { passive: true });

    element.addEventListener("touchend", event => {
      if (!phone.matches ||
          currentPage !== fromPage ||
          blocked ||
          !event.changedTouches.length) return;

      const touch = event.changedTouches[0];
      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;

      // Require a deliberate horizontal gesture.
      if (Math.abs(dx) < 75) return;
      if (Math.abs(dx) < Math.abs(dy) * 1.7) return;

      if (direction === "right" && dx > 0) {
        event.preventDefault();
        showPage(toPage);
      }

      if (direction === "left" && dx < 0) {
        event.preventDefault();
        showPage(toPage);
      }
    }, { passive: false });
  }

  enableSwipe(
    tracker, "tracking", "review", "right"
  );

  enableSwipe(
    review, "review", "tracking", "left"
  );

  document.addEventListener(
    "apex:postgame-events-updated",
    refresh
  );

  $("post-period")?.addEventListener(
    "change", refresh
  );

  window.addEventListener(
    "apex:postgame-ready",
    refresh
  );

  phone.addEventListener("change", () => {
    showPage("tracking");
  });

  showPage("tracking");
  refresh();
})();
