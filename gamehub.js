let selectedGameId = null;
let gameHubTeamName = "OUR TEAM";
let gameHubGames = [];
let gameHubEvents = [];
let displayedMonth = new Date();
displayedMonth.setDate(1);

let selectedGameDate = null;


/* =========================================
   GAME HUB CALENDAR — GAMES + EVENTS
   ========================================= */

function renderGameCalendar() {
    const calendar = document.getElementById("calendar-dates");
    const monthLabel = document.getElementById("calendar-month");

    if (!calendar || !monthLabel) return;

    calendar.replaceChildren();

    const year = displayedMonth.getFullYear();
    const month = displayedMonth.getMonth();

    monthLabel.textContent =
        displayedMonth.toLocaleDateString("en-US", {
            month: "long",
            year: "numeric"
        });

    const firstDay = new Date(year, month, 1);
    const daysInMonth =
        new Date(year, month + 1, 0).getDate();

    // Monday is the first calendar column.
    const startingColumn =
        (firstDay.getDay() + 6) % 7;

    for (let i = 0; i < startingColumn; i++) {
        calendar.appendChild(
            document.createElement("span")
        );
    }

    const eventTypes = {
        practice: "Practice",
        meeting: "Team Meeting",
        training: "Training",
        other: "Other Event"
    };

    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day);

        const dateKey = [
            year,
            String(month + 1).padStart(2, "0"),
            String(day).padStart(2, "0")
        ].join("-");

        const dayButton = document.createElement("button");
        dayButton.type = "button";
        dayButton.classList.add("calendar-day");
        dayButton.textContent = day;

        // Get basketball games for this date.
        const gamesOnDate = gameHubGames.filter(game =>
            String(game.date).slice(0, 10) === dateKey
        );

        // Get practices, meetings and other events.
        const eventsOnDate = gameHubEvents.filter(event =>
            String(event.event_date).slice(0, 10) === dateKey
        );

        // Preserve existing home/away game colours.
        if (gamesOnDate.some(game =>
            String(game.location || "").toLowerCase() === "home"
        )) {
            dayButton.classList.add("home-game");

        } else if (gamesOnDate.some(game =>
            String(game.location || "").toLowerCase() === "away"
        )) {
            dayButton.classList.add("away-game");
        }

        // Tournament ranges are separate events and may have zero known games.
        if (window.scoridiumTournaments?.decorateDate) {
            window.scoridiumTournaments.decorateDate(dayButton, dateKey);
        }

        // Highlight selected date.
        if (
            selectedGameDate &&
            date.toDateString() === selectedGameDate.toDateString()
        ) {
            dayButton.classList.add("selected");
        }

        
/* =========================================
   CALENDAR EVENT BACKGROUND
   ========================================= */

// Games take priority over practices and meetings.
// Non-game activities use a lighter primary colour.
if (
    gamesOnDate.length === 0 &&
    eventsOnDate.length > 0
) {
    dayButton.classList.add("calendar-team-event");
}


        // Show event information on hover.
        const descriptions = [
            ...gamesOnDate.map(game =>
                `Game vs ${game.opponent || "TBD"}`
            ),
            ...eventsOnDate.map(event =>
                `${eventTypes[event.event_type] || "Event"}: ` +
                `${event.title || "Scheduled Event"}`
            )
        ];

        if (descriptions.length > 0) {
            dayButton.title = descriptions.join("\n");
        }

        // Preserve existing date selection behaviour.
        dayButton.addEventListener("click", function() {

if (scheduleManageMode && canManageSchedule) {
    const eventsForDay = gameHubEvents.filter(item =>
        String(item.event_date).slice(0, 10) === dateKey
    );

    openScheduleManager();

   
const gamesForDay = gameHubGames.filter(game =>
    String(game.date).slice(0, 10) === dateKey
);

const totalItems =
    eventsForDay.length + gamesForDay.length;

if (totalItems === 1 && eventsForDay.length === 1) {
    selectScheduleEvent(eventsForDay[0].id);

} else if (totalItems === 1 && gamesForDay.length === 1) {
    selectScheduleGame(gamesForDay[0].id);

} else {
    document.getElementById("schedule-event-date").value =
        dateKey;

    if (totalItems > 1) {
        document.getElementById("schedule-form-message")
            .textContent =
            "Multiple activities are scheduled for this date. " +
            "Choose one from Existing Events.";
    }
}

    return;
}

            if (
                selectedGameDate &&
                selectedGameDate.toDateString() === date.toDateString()
            ) {
                selectedGameDate = null;
                displayGameHubGames(gameHubGames);

            } else {
                selectedGameDate = date;

                const filteredGames = gameHubGames.filter(game =>
                    String(game.date).slice(0, 10) === dateKey
                );

                displayGameHubGames(filteredGames);
            }

            renderGameCalendar();
            renderMobileSelectedDay();
            renderMobileGameCard();
            window.scoridiumTournaments?.renderSelectedDate();
            const selectedCompleted = selectedGameDate ? gameHubGames.filter(g =>
                String(g.date).slice(0,10) === dateKey && g.status === "completed") : [];
            displayPreviousGame(selectedCompleted.length ? selectedCompleted : gameHubGames);
        });

        calendar.appendChild(dayButton);
    }
}


// Previous month
document.getElementById("previous-month").addEventListener("click", function () {
    displayedMonth.setMonth(displayedMonth.getMonth() - 1);
    renderGameCalendar();
});

// Next month
document.getElementById("next-month").addEventListener("click", function () {
    displayedMonth.setMonth(displayedMonth.getMonth() + 1);
    renderGameCalendar();
});

renderGameCalendar();

async function loadGameHubGames() {
    const selectedTeamId = sessionStorage.getItem("selectedTeamId");
    const selectedSeasonId = sessionStorage.getItem("selectedSeasonId");

    if (!selectedTeamId || !selectedSeasonId) {
        console.log("No team or season selected.");
        return;
    }

    console.log("Selected team:", selectedTeamId);
    console.log("Selected season:", selectedSeasonId);
    const { data: team, error: teamError } = await supabaseClient
    .from("teams")
    .select("mascot, club_name, team_type")
    .eq("id", selectedTeamId)
    .single();

    if (teamError) {
        console.error("Error loading team name:", teamError);
        } else {
        gameHubTeamName = (team.team_type === "club" ? (team.club_name || team.mascot) : team.mascot) || "Team";
    }
    const { data: games, error } = await supabaseClient
        .from("games")
        .select("*")
        .eq("team_id", selectedTeamId)
        .eq("seasons_id", selectedSeasonId)
        .order("date", { ascending: true });

    if (error) {
        console.error("Error loading Game Hub games:", error);
        return;
    }
    gameHubGames = games;
    displayPreviousGame(games);
    displayNextGame(games);
    renderGameCalendar();
    console.log("Game Hub games:", games);
    displayGameHubGames(games);
    window.scoridiumTournaments?.renderSelectedDate();
    renderMobileSelectedDay();
    renderMobileGameCard();

    if (scheduleModal && !scheduleModal.hidden) {
    renderExistingScheduleEvents();
}
}

async function initializeGameHub() {
    await window.pageLayoutReady;

    await loadGameHubGames();
    await loadGameHubEvents();
    await window.scoridiumTournaments?.reload();
}

initializeGameHub();

window.addEventListener("seasonChanged", async () => {
    selectedGameId = null;
    selectedGameDate = null;
    loadGameHubGames();
    await loadGameHubEvents();
    
});


function displayGameHubGames(games) {
    const tableBody = document.getElementById("game-hub-games-body");

    tableBody.replaceChildren();

    document.getElementById("games-count").textContent =
        `${games.length} Games`;

    games.forEach(function(game) {
        const row = document.createElement("tr");

        const completed = game.status === "completed";

        const values = [
            game.date,
            game.opponent,
            game.location,
            completed
                ? (game.team_score > game.opponent_score ? "W" : "L")
                : "—",
            completed
                ? `${game.team_score} - ${game.opponent_score}`
                : "—"
        ];

        values.forEach(function(value) {
            const cell = document.createElement("td");
            cell.textContent = value ?? "—";
            row.appendChild(cell);
        });
        row.addEventListener("click", function () {
            // Table rows are legacy-only. Calendar dates now drive game context.
            if (selectedGameId === game.id) {
        selectedGameId = null;

        row.classList.remove("selected-game");

        displayPreviousGame(gameHubGames);
        displayNextGame(gameHubGames);
        return;
}

            selectedGameId = game.id;
            document.querySelectorAll(".games-table tbody tr")
            .forEach(function(otherRow) {
                otherRow.classList.remove("selected-game");
            });

        row.classList.add("selected-game");

        if (game.status === "completed") {
            displayPreviousGame([game]);

        } else if (game.status === "scheduled" || 
            game.status === "live" ||
            game.status === "paused") {
            displayNextGame(gameHubGames);
        }
    });
                tableBody.appendChild(row);
            });
}


/* =========================================
   PREVIOUS GAME BOX SCORE
   ========================================= */

let previousGameRequest = 0;

function getEventPoints(event) {
    const type = String(event.type || "").toLowerCase();

    if (event.made !== true) return 0;

    if (type === "free_throw") return 1;

    if (type === "shot") {
        return Number(event.points) || 0;
    }

    return 0;
}

function getEventPeriod(event) {
    const value = event.period ?? event.quarter;
    const period = Number(value);

    return Number.isInteger(period) && period > 0
        ? period
        : null;
}

async function displayPreviousGame(games) {
    const requestId = ++previousGameRequest;

    const quartersContainer =
        document.getElementById("previous-quarters");

    const leadersContainer =
        document.getElementById("previous-leaders");

    const boxScoreLink =
        document.getElementById("previous-box-score-link");

    const completedGames = games
        .filter(game =>
            game.status === "completed" &&
            game.team_score != null &&
            game.opponent_score != null
        )
        .sort((a, b) => b.date.localeCompare(a.date));

    const game = completedGames[0];

    quartersContainer.textContent = "";
    leadersContainer.textContent = "";

    if (!game) {
        document.getElementById("previous-game-date")
            .textContent = "No completed games";

        document.getElementById("previous-home-name")
            .textContent = "HOME";

        document.getElementById("previous-away-name")
            .textContent = "AWAY";

        document.getElementById("previous-home-score")
            .textContent = "—";

        document.getElementById("previous-away-score")
            .textContent = "—";

        quartersContainer.textContent = "No completed game.";
        leadersContainer.textContent = "No player statistics.";

        boxScoreLink.hidden = true;
        return;
    }

    boxScoreLink.hidden = false;

    const isHome =
        String(game.location || "").toLowerCase() === "home";

    const homeName = isHome
        ? gameHubTeamName
        : game.opponent;

    const awayName = isHome
        ? game.opponent
        : gameHubTeamName;

    document.getElementById("previous-game-date")
        .textContent = game.date;

    document.getElementById("previous-home-name")
        .textContent = homeName;

    document.getElementById("previous-away-name")
        .textContent = awayName;

    document.getElementById("previous-home-score")
        .textContent = isHome
            ? game.team_score
            : game.opponent_score;

    document.getElementById("previous-away-score")
        .textContent = isHome
            ? game.opponent_score
            : game.team_score;

    boxScoreLink.href =
        `stats.html?gameId=${encodeURIComponent(game.id)}`;

    quartersContainer.textContent = "Loading quarter scores...";
    leadersContainer.textContent = "Loading player statistics...";

    // Fetch recorded events and player names.
    const events = [];

    for (let offset = 0; ; offset += 500) {
        const { data, error } = await supabaseClient
            .from("game_events")
            .select("*")
            .eq("game_id", game.id)
            .order("id")
            .range(offset, offset + 499);

        if (requestId !== previousGameRequest) return;

        if (error) {
            console.error("Box score events error:", error);
            quartersContainer.textContent =
                "Could not load quarter scores.";
            leadersContainer.textContent =
                "Could not load player statistics.";
            return;
        }

        events.push(...(data || []));

        if ((data || []).length < 500) break;
    }

    const teamId = sessionStorage.getItem("selectedTeamId");

    const { data: players, error: playersError } =
        await supabaseClient
            .from("players")
            .select("id, first_name, last_name, number")
            .eq("team_id", teamId);

    if (requestId !== previousGameRequest) return;

    if (playersError) {
        console.error("Box score players error:", playersError);
    }

    renderPreviousQuarterScores(game, events);
    renderPreviousGameLeaders(events, players || []);
}


function renderPreviousQuarterScores(game, events) {
    const container =
        document.getElementById("previous-quarters");

    container.replaceChildren();

    if (!events.length) {
        container.textContent = "Quarter scores not available.";
        return;
    }

    const periods = new Map();

    // Only include team-attributed scoring events.
    for (const event of events) {
        const period = getEventPeriod(event);
        const points = getEventPoints(event);

        if (period === null || points === 0) continue;

        const side = String(event.team || "").toLowerCase();

        if (!["us", "our", "ours", "opponent", "them", "away"].includes(side)) {
            continue;
        }

        if (!periods.has(period)) {
            periods.set(period, { us: 0, opponent: 0 });
        }

        const totals = periods.get(period);

        if (["us", "our", "ours"].includes(side)) {
            totals.us += points;
        } else {
            totals.opponent += points;
        }
    }

    if (!periods.size) {
        container.textContent = "Quarter scores not available.";
        return;
    }

    const periodNumbers = [...periods.keys()]
        .sort((a, b) => a - b);

    const teamTotal = periodNumbers.reduce(
        (sum, period) => sum + periods.get(period).us, 0
    );

    const opponentTotal = periodNumbers.reduce(
        (sum, period) => sum + periods.get(period).opponent, 0
    );

    // Don't present incomplete event totals as official quarter scores.
    if (
        teamTotal !== Number(game.team_score) ||
        opponentTotal !== Number(game.opponent_score)
    ) {
        container.textContent =
            "Quarter scores unavailable — event totals do not match the final score.";
        return;
    }

    const isHome =
        String(game.location || "").toLowerCase() === "home";

    const homeName = isHome ? gameHubTeamName : game.opponent;
    const awayName = isHome ? game.opponent : gameHubTeamName;

    const homeKey = isHome ? "us" : "opponent";
    const awayKey = isHome ? "opponent" : "us";

    const table = document.createElement("table");
    table.className = "quarter-score-table";

    const head = document.createElement("thead");
    const headerRow = document.createElement("tr");

    const headings = [
        "TEAM",
        ...periodNumbers.map(p => p <= 4 ? `Q${p}` : `OT${p - 4}`),
        "TOTAL"
    ];

    headings.forEach(label => {
        const th = document.createElement("th");
        th.textContent = label;
        headerRow.appendChild(th);
    });

    head.appendChild(headerRow);

    const body = document.createElement("tbody");

    [
        { name: homeName, key: homeKey },
        { name: awayName, key: awayKey }
    ].forEach(team => {
        const row = document.createElement("tr");

        const values = [
            team.name,
            ...periodNumbers.map(p => periods.get(p)[team.key]),
            team.key === "us" ? game.team_score : game.opponent_score
        ];

        values.forEach(value => {
            const td = document.createElement("td");
            td.textContent = value;
            row.appendChild(td);
        });

        body.appendChild(row);
    });

    table.append(head, body);
    container.appendChild(table);
}


function renderPreviousGameLeaders(events, players) {
    const container =
        document.getElementById("previous-leaders");

    container.replaceChildren();

    const playerMap = new Map(
        players.map(player => [String(player.id), player])
    );

    const stats = new Map();

    events.forEach(event => {
        if (!event.player_id) return;

        const side = String(event.team || "").toLowerCase();

        if (!["us", "our", "ours"].includes(side)) return;

        const id = String(event.player_id);

        if (!stats.has(id)) {
            stats.set(id, {
                points: 0,
                rebounds: 0,
                assists: 0
            });
        }

        const totals = stats.get(id);
        const type = String(event.type || "").toLowerCase();

        totals.points += getEventPoints(event);

        if (
            type === "offensive_rebound" ||
            type === "defensive_rebound"
        ) {
            totals.rebounds++;
        }

        if (type === "assist") {
            totals.assists++;
        }
    });

    const entries = [...stats.entries()]
        .filter(([id]) => playerMap.has(id));

    if (!entries.length) {
        container.textContent = "No player statistics available.";
        return;
    }

    const categories = [
        { key: "points", label: "POINTS", unit: "PTS" },
        { key: "rebounds", label: "REBOUNDS", unit: "REB" },
        { key: "assists", label: "ASSISTS", unit: "AST" }
    ];

    categories.forEach(category => {
        const sorted = [...entries].sort(
            (a, b) =>
                b[1][category.key] - a[1][category.key]
        );

        const [playerId, totals] = sorted[0];

        const player = playerMap.get(playerId);

        const card = document.createElement("div");
        card.className = "game-leader-card";

        const label = document.createElement("span");
        label.className = "game-leader-category";
        label.textContent = category.label;

        const number = document.createElement("strong");
        number.className = "game-leader-value";
        number.textContent = totals[category.key];

        const name = document.createElement("span");
        name.className = "game-leader-name";
        name.textContent =
            `${player.first_name || ""} ${player.last_name || ""}`.trim()
            || "Unknown Player";

        card.append(label, number, name);
        container.appendChild(card);
    });
}


// Check game-specific or season-scoped tracking grants before showing edit entry points.
// This only selects the link label; Supabase RLS must still enforce all writes.
const scTrackingGrants=new Map();
async function scMayTrack(game){
  const key=String(game.id);if(scTrackingGrants.has(key))return scTrackingGrants.get(key);
  const promise=(async()=>{
    try{
      const user=(await supabaseClient.auth.getUser()).data.user;if(!user)return false;
      const team=sessionStorage.getItem('selectedTeamId');
      const [membership,permission]=await Promise.all([
        supabaseClient.from('team_members').select('role').eq('team_id',team).eq('user_id',user.id),
        supabaseClient.from('game_tracking_permissions').select('game_id,season_id').eq('user_id',user.id)
      ]);
      const coach=(membership.data||[]).some(x=>['head_coach','coach','assistant_coach','manager'].includes(x.role));
      return coach||(permission.data||[]).some(x=>x.game_id===game.id||Boolean(x.season_id&&x.season_id===game.seasons_id));
    }catch(e){return false;}
  })();
  scTrackingGrants.set(key,promise);return promise;
}

function scFullDate(value){
  const match=String(value||'').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if(!match)return value||'—';
  const date=new Date(Number(match[1]),Number(match[2])-1,Number(match[3]));
  return new Intl.DateTimeFormat('en-US',{month:'long',day:'numeric',year:'numeric'}).format(date);
}
// A single card owns both upcoming and live states. Never tie it to the calendar selection.
function scCurrentGameCard(games){
 const live=(games||[]).filter(g=>g.status==='live').sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')))[0];
 if(live)return {game:live,live:true};
 const now=new Date();const today=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
 const next=(games||[]).filter(g=>g.status==='scheduled' && String(g.date||'').slice(0,10)>=today).sort((a,b)=>String(a.date||'').localeCompare(String(b.date||'')))[0];
 return {game:next||null,live:false};
}
function displayNextGame(games){
 const {game,live}=scCurrentGameCard(games),card=document.querySelector('.next-game');if(!card)return;
 document.getElementById('sc-live-game-room')?.remove();
 card.classList.toggle('sc-is-live',live);
 const heading=card.querySelector('.next-game-header h2'),date=document.getElementById('next-game-date');
 const home=document.getElementById('next-home-name'),away=document.getElementById('next-away-name');
 const vs=card.querySelector('.next-vs'),time=document.getElementById('next-game-time');
 const locationEl=document.getElementById('next-game-location'),action=document.getElementById('open-next-game');
 heading.textContent=live?'LIVE GAME':'NEXT GAME';vs.textContent='VS';
 const oldHome=card.querySelector('.next-home .sc-score'),oldAway=card.querySelector('.next-away .sc-score');oldHome?.remove();oldAway?.remove();
 if(!game){date.textContent='No upcoming games';home.textContent=gameHubTeamName;away.textContent='TBD';time.textContent='';locationEl.textContent='';action.disabled=true;action.textContent='No Upcoming Game';action.onclick=null;return;}
 const isHome=String(game.location||'').toLowerCase()==='home';
 home.textContent=isHome?gameHubTeamName:(game.opponent||'Opponent');
 away.textContent=isHome?(game.opponent||'Opponent'):gameHubTeamName;
 date.textContent=scFullDate(game.date);
 time.textContent=live?`LIVE · ${game.period||game.quarter?`Q${game.period||game.quarter}`:'In progress'}`:`TIME: ${game.start_time||game.time||'TBD'}`;
 locationEl.textContent=live?'':`LOCATION: ${game.location||'TBD'}`;
 if(live){
  const l=document.createElement('strong'),r=document.createElement('strong');l.className=r.className='sc-score';
  l.textContent=isHome?(game.team_score??0):(game.opponent_score??0);
  r.textContent=isHome?(game.opponent_score??0):(game.team_score??0);
  card.querySelector('.next-home').append(l);card.querySelector('.next-away').append(r);
 }
 action.disabled=false;action.textContent='View Game';action.onclick=()=>location.href=`watch-game.html?gameId=${encodeURIComponent(game.id)}`;
 void scMayTrack(game).then(allowed=>{
  if(!action.isConnected||scCurrentGameCard(gameHubGames).game?.id!==game.id)return;
  action.textContent=allowed?(live?'Resume Tracking':'Open Game Tracker'):'View Game';
  action.onclick=()=>location.href=`${allowed?'game':'watch-game'}.html?gameId=${encodeURIComponent(game.id)}`;
 });
}


/* ===================================
   MANAGE SCHEDULE — MODAL CONTROLS
   =================================== */

const manageScheduleButton =
    document.getElementById("manage-schedule");

const scheduleModal =
    document.getElementById("schedule-modal");

const scheduleCloseButton =
    document.getElementById("close-schedule");

let schedulePreviousFocus = null;


/* =====================================
   EDIT EXISTING SCHEDULE EVENTS
   ===================================== */

const existingEventSelect =
    document.getElementById("schedule-existing-select");

const scheduleEventIdInput =
    document.getElementById("schedule-event-id");

const deleteScheduleButton =
    document.getElementById("delete-schedule-event");

const saveScheduleButton =
    document.getElementById("save-schedule-event");

let selectedScheduleGameId = null;

function resetScheduleEditor() {
    const form =
        document.getElementById("schedule-event-form");

    form.reset();
    scheduleEventIdInput.value = "";
    existingEventSelect.value = "";

    deleteScheduleButton.hidden = true;
    saveScheduleButton.textContent = "Save Event";

    selectedScheduleGameId = null;
    saveScheduleButton.disabled = false;

    updateScheduleLayout();
    resetRepeatControls();

}


function renderExistingScheduleEvents() {
    const selectedValue = selectedScheduleGameId
        ? `game:${selectedScheduleGameId}`
        : scheduleEventIdInput.value;

    existingEventSelect.replaceChildren();

    const createOption = document.createElement("option");
    createOption.value = "";
    createOption.textContent = "+ Create New Event";
    existingEventSelect.appendChild(createOption);

    // Practices, meetings, training, etc.
    gameHubEvents.forEach(event => {
        const option = document.createElement("option");

        option.value = event.id;
        option.textContent =
            `${event.event_date} — ${event.title}`;

        existingEventSelect.appendChild(option);
    });

    // Basketball games.
    gameHubGames.forEach(game => {
        const option = document.createElement("option");

        option.value = `game:${game.id}`;
        option.textContent =
            `${game.date} — Game vs ${game.opponent || "TBD"}` +
            (game.status !== "scheduled"
                ? ` (${game.status})`
                : "");

        existingEventSelect.appendChild(option);
    });

    const options = [...existingEventSelect.options];

    if (options.some(option => option.value === selectedValue)) {
        existingEventSelect.value = selectedValue;
    } else if (selectedValue) {
        resetScheduleEditor();
    }
} 

function selectScheduleEvent(eventId) {
    selectedScheduleGameId = null;
    saveScheduleButton.disabled = false;
    const event = gameHubEvents.find(item =>
        String(item.id) === String(eventId)
    );

    if (!event) {
        resetScheduleEditor();
        return;
    }

    scheduleEventIdInput.value = event.id;
    existingEventSelect.value = event.id;

    document.getElementById("schedule-event-type").value =
        event.event_type;

    document.getElementById("schedule-event-date").value =
        event.event_date;

    document.getElementById("schedule-start-time").value =
        String(event.start_time || "").slice(0, 5);

    document.getElementById("schedule-end-time").value =
        String(event.end_time || "").slice(0, 5);

    document.getElementById("schedule-event-location").value =
        event.location || "";

    document.getElementById("schedule-event-title").value =
        event.title || "";

    document.getElementById("schedule-event-description").value =
        event.description || "";

    updateScheduleLayout();
    updateRecurrenceLayout()

    deleteScheduleButton.hidden = false;
    saveScheduleButton.textContent = "Save Changes";

    document.getElementById("schedule-form-message")
        .textContent = "";
}


/* =====================================
   SELECT EXISTING GAME
   ===================================== */

function selectScheduleGame(gameId) {
    const game = gameHubGames.find(item =>
        String(item.id) === String(gameId)
    );

    if (!game) {
        resetScheduleEditor();
        return;
    }

    resetScheduleEditor();

    selectedScheduleGameId = game.id;
    existingEventSelect.value = `game:${game.id}`;

    document.getElementById("schedule-event-type").value =
        "game";

    document.getElementById("schedule-opponent").value =
        game.opponent || "";

    document.getElementById("schedule-event-date").value =
        game.date || "";

    document.getElementById("schedule-start-time").value =
        String(game.game_time || "").slice(0, 5);

    document.getElementById("schedule-end-time").value =
        String(game.end_time || "").slice(0, 5);

    document.getElementById("schedule-game-location").value =
        game.location || "home";

    document.getElementById("schedule-game-venue").value =
        game.venue || "";

    updateScheduleLayout();

    const editable = game.status === "scheduled";

    saveScheduleButton.disabled = !editable;
    saveScheduleButton.textContent =
        editable ? "Save Changes" : "Game Locked";

    deleteScheduleButton.hidden = !editable;

    document.getElementById("schedule-form-message")
        .textContent = editable
            ? ""
            : "Only scheduled games can be edited or deleted.";
}

existingEventSelect?.addEventListener("change", () => {
    const value = existingEventSelect.value;

    if (value.startsWith("game:")) {
        selectScheduleGame(value.slice(5));
    } else {
        selectScheduleEvent(value);
    }
});

function openScheduleManager() {
    if (!canManageSchedule) return;

    schedulePreviousFocus = document.activeElement;

    resetScheduleEditor();
    renderExistingScheduleEvents();

    document.getElementById("schedule-form-message")
        .textContent = "";

    scheduleModal.hidden = false;

    scheduleModal.querySelector(".schedule-modal-content")
        .focus();
}


function closeScheduleManager() {
    scheduleModal.hidden = true;
    schedulePreviousFocus?.focus();
}


/* =====================================
   CALENDAR MANAGEMENT MODE
   ===================================== */

let scheduleManageMode = false;

manageScheduleButton?.addEventListener("click", () => {
    if (!canManageSchedule) return;

    scheduleManageMode = !scheduleManageMode;

    manageScheduleButton.classList.toggle(
        "editing",
        scheduleManageMode
    );

    const label = manageScheduleButton.querySelector("span");

    if (label) {
        label.textContent =
            scheduleManageMode ? "Done" : "Manage";
    }

    renderGameCalendar();
});


scheduleCloseButton?.addEventListener(
    "click",
    closeScheduleManager
);

scheduleModal?.querySelector(".schedule-modal-backdrop")
    ?.addEventListener("click", closeScheduleManager);

document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !scheduleModal.hidden) {
        closeScheduleManager();
    }
});


/* =====================================
   SAVE SCHEDULE EVENTS TO SUPABASE
   ===================================== */

const scheduleForm =
    document.getElementById("schedule-event-form");


/* =====================================
   RECURRING PRACTICE HELPERS
   ===================================== */

const repeatFields = document.getElementById("practice-repeat-fields");
const repeatWeekly = document.getElementById("schedule-repeat-weekly");
const repeatOptions = document.getElementById("schedule-repeat-options");
const repeatUntil = document.getElementById("schedule-repeat-until");
const seriesEditor = document.getElementById("schedule-series-editor");
const editScope = document.getElementById("schedule-edit-scope");

const repeatDayInputs = [
    ...document.querySelectorAll(
        ".schedule-repeat-days input[type='checkbox']"
    )
];

function parsePracticeDate(value) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day);
}

function practiceDateKey(date) {
    return [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, "0"),
        String(date.getDate()).padStart(2, "0")
    ].join("-");
}

function generatePracticeDates(start, end, selectedDays) {
    const dates = [];

    const current = parsePracticeDate(start);
    const last = parsePracticeDate(end);

    while (current <= last) {
        if (selectedDays.includes(current.getDay())) {
            dates.push(practiceDateKey(current));
        }

        current.setDate(current.getDate() + 1);
    }

    return dates;
}

function resetRepeatControls() {
    repeatWeekly.checked = false;
    repeatUntil.value = "";

    repeatDayInputs.forEach(input => {
        input.checked = false;
    });

    editScope.value = "one";
    updateRecurrenceLayout();
}

function updateRecurrenceLayout() {
    const type = document.getElementById(
        "schedule-event-type"
    ).value;

    const eventId = document.getElementById(
        "schedule-event-id"
    ).value;

    const selectedEvent = gameHubEvents.find(item =>
        String(item.id) === String(eventId)
    );

    const isPractice = type === "practice";
    const isEditing = Boolean(selectedEvent);
    const isSeries = Boolean(selectedEvent?.series_id);

    // Recurrence creation is available only for new practices.
    repeatFields.hidden = !isPractice || isEditing;

    repeatOptions.hidden =
        !isPractice || isEditing || !repeatWeekly.checked;

    // Editing scopes appear only for existing recurring practices.
    seriesEditor.hidden = !isPractice || !isSeries;

    if (!isSeries) {
        editScope.value = "one";
    }
}


repeatWeekly.addEventListener("change", () => {
    updateRecurrenceLayout();

    if (!repeatWeekly.checked) return;

    const startDate = document.getElementById(
        "schedule-event-date"
    ).value;

    if (!startDate) return;

    repeatUntil.min = startDate;

    if (!repeatDayInputs.some(input => input.checked)) {
        const weekday = parsePracticeDate(startDate).getDay();

        const matchingDay = repeatDayInputs.find(
            input => Number(input.value) === weekday
        );

        if (matchingDay) matchingDay.checked = true;
    }
});


document.getElementById("schedule-event-date")
    .addEventListener("change", () => {
        const start = document.getElementById(
            "schedule-event-date"
        ).value;

        if (!start) return;

        repeatUntil.min = start;

        // Preselect the start date's weekday.
        if (repeatWeekly.checked) {
            const startDay = parsePracticeDate(start).getDay();

            if (!repeatDayInputs.some(input => input.checked)) {
                const checkbox = repeatDayInputs.find(
                    input => Number(input.value) === startDay
                );

                if (checkbox) checkbox.checked = true;
            }
        }
    });


/* =====================================
   CREATE SCHEDULED BASKETBALL GAME
   ===================================== */

async function createScheduledGame() {
    const message =
        document.getElementById("schedule-form-message");

    const saveButton =
        document.getElementById("save-schedule-event");

    const teamId =
        sessionStorage.getItem("selectedTeamId");

    const seasonId =
        sessionStorage.getItem("selectedSeasonId");

    const opponent =
        document.getElementById("schedule-opponent")
            .value.trim();

    const date =
        document.getElementById("schedule-event-date").value;

    const startTime =
        document.getElementById("schedule-start-time").value;

    const location =
        document.getElementById("schedule-game-location").value;

    const venue =
        document.getElementById("schedule-game-venue")
            .value.trim();

    if (!canManageSchedule) {
        message.textContent =
            "You do not have permission to schedule games.";
        return;
    }

    if (!teamId || !seasonId) {
        message.textContent =
            "Please select a team and season.";
        return;
    }

    if (!opponent || !date || !startTime || !venue) {
        message.textContent =
            "Please complete all required game fields.";
        return;
    }

    const gamePayload = {
        team_id: teamId,
        seasons_id: seasonId,
        opponent,
        date,
        game_time: startTime,
        location,
        venue,
        status: "scheduled"
    };

    saveButton.disabled = true;
    message.textContent = "Scheduling game...";

    try {
        const { error } = await supabaseClient
            .from("games")
            .insert(gamePayload);

        if (error) throw error;

        resetScheduleEditor();

        await loadGameHubGames();

        message.textContent =
            "Game scheduled successfully!";

    } catch (error) {
        console.error("Game scheduling error:", error);

        message.textContent =
            "Unable to schedule game: " + error.message;

    } finally {
        saveButton.disabled = false;
    }
}  


/* =====================================
   UPDATE SCHEDULED GAME
   ===================================== */

async function updateScheduledGame() {
    const gameId = selectedScheduleGameId;
    const teamId = sessionStorage.getItem("selectedTeamId");
    const seasonId = sessionStorage.getItem("selectedSeasonId");

    const message = document.getElementById(
        "schedule-form-message"
    );

    const game = gameHubGames.find(item =>
        String(item.id) === String(gameId)
    );

    if (!canManageSchedule || !game || game.status !== "scheduled") {
        message.textContent = "This game cannot be edited.";
        return;
    }

    const changes = {
        opponent: document.getElementById(
            "schedule-opponent"
        ).value.trim(),

        date: document.getElementById(
            "schedule-event-date"
        ).value,

        game_time: document.getElementById(
            "schedule-start-time"
        ).value,

        location: document.getElementById(
            "schedule-game-location"
        ).value,

        venue: document.getElementById(
            "schedule-game-venue"
        ).value.trim()
    };

    if (
        !changes.opponent ||
        !changes.date ||
        !changes.game_time ||
        !changes.venue
    ) {
        message.textContent = "Complete all required game fields.";
        return;
    }

    saveScheduleButton.disabled = true;
    message.textContent = "Updating game...";

    try {
        const { data, error } = await supabaseClient
            .from("games")
            .update(changes)
            .eq("id", gameId)
            .eq("team_id", teamId)
            .eq("seasons_id", seasonId)
            .eq("status", "scheduled")
            .select("id")
            .single();

        if (error) throw error;

        if (!data) {
            throw new Error("Game was not updated.");
        }

        resetScheduleEditor();
        await loadGameHubGames();

        message.textContent = "Game updated successfully!";

    } catch (error) {
        console.error("Game update error:", error);
        message.textContent =
            "Unable to update game: " + error.message;
    } finally {
        saveScheduleButton.disabled = false;
    }
}


/* =====================================
   DELETE SCHEDULED GAME
   ===================================== */

async function deleteScheduledGame() {
    const gameId = selectedScheduleGameId;
    const teamId = sessionStorage.getItem("selectedTeamId");
    const seasonId = sessionStorage.getItem("selectedSeasonId");

    const message = document.getElementById(
        "schedule-form-message"
    );

    const game = gameHubGames.find(item =>
        String(item.id) === String(gameId)
    );

    if (!canManageSchedule || !game || game.status !== "scheduled") {
        message.textContent = "This game cannot be deleted.";
        return;
    }

    if (!confirm(
        `Delete the scheduled game against ${game.opponent}?\n\n` +
        "This action cannot be undone."
    )) {
        return;
    }

    deleteScheduleButton.disabled = true;
    message.textContent = "Deleting game...";

    try {
        const { data, error } = await supabaseClient
            .from("games")
            .delete()
            .eq("id", gameId)
            .eq("team_id", teamId)
            .eq("seasons_id", seasonId)
            .eq("status", "scheduled")
            .select("id");

        if (error) throw error;

        if (!data || data.length !== 1) {
            throw new Error(
                "Game was not deleted. Check game permissions " +
                "and whether it has recorded events."
            );
        }

        resetScheduleEditor();
        await loadGameHubGames();

        message.textContent = "Game deleted successfully!";

    } catch (error) {
        console.error("Game delete error:", error);
        message.textContent =
            "Unable to delete game: " + error.message;
    } finally {
        deleteScheduleButton.disabled = false;
    }
}

/* =====================================
   CREATE OR UPDATE SCHEDULE EVENTS
   ===================================== */

scheduleForm?.addEventListener("submit", async event => {
    event.preventDefault();

    const message =
        document.getElementById("schedule-form-message");

    const saveButton =
        document.getElementById("save-schedule-event");

    const eventId = scheduleEventIdInput.value;

    const teamId =
        sessionStorage.getItem("selectedTeamId");

    const seasonId =
        sessionStorage.getItem("selectedSeasonId");

    const type =
        document.getElementById("schedule-event-type").value;

    const date =
        document.getElementById("schedule-event-date").value;

    const startTime =
        document.getElementById("schedule-start-time").value;

    const endTime =
        document.getElementById("schedule-end-time").value;

    const location =
        document.getElementById("schedule-event-location")
            .value.trim();

    const customTitle =
        document.getElementById("schedule-event-title")
            .value.trim();

    const description =
        document.getElementById("schedule-event-description")
            .value.trim();

    message.textContent = "";

    if (!canManageSchedule) {
        message.textContent =
            "You do not have permission to manage this schedule.";
        return;
    }

    if (!teamId || !seasonId) {
        message.textContent = "Select a team and season.";
        return;
    }

    // Tournament creation is handled by a separate date-range editor.
    if (type === 'tournament') {
        scheduleModal.hidden = true;
        document.getElementById('add-tournament')?.click();
        return;
    }

    // Games will use the games table later.
    
if (type === "game") {
    // Don't turn an existing practice into a new game.
    if (eventId && !selectedScheduleGameId) {
        message.textContent =
            "Choose Create New Event before scheduling a game.";
        return;
    }

    if (selectedScheduleGameId) {
        await updateScheduledGame();
    } else {
        await createScheduledGame();
    }

    return;
}

if (selectedScheduleGameId) {
    message.textContent =
        "Choose Create New Event before changing event types.";
    return;
}


    if (!date || !startTime || !location) {
        message.textContent =
            "Please complete all required fields.";
        return;
    }

    if (endTime && endTime <= startTime) {
        message.textContent =
            "End time must be later than start time.";
        return;
    }

    const titles = {
        practice: "Team Practice",
        meeting: "Team Meeting",
        training: "Training",
        other: "Other Event"
    };

    
const payload = {
    team_id: teamId,
    seasons_id: seasonId,
    event_type: type,
    title: customTitle || titles[type],
    event_date: date,
    start_time: startTime,
    end_time: endTime || null,
    location,
    description: description || null
};


    // Confirm edits target a loaded event.
    if (eventId && !gameHubEvents.some(item =>
        String(item.id) === String(eventId)
    )) {
        message.textContent =
            "This event is no longer available. Reload the schedule.";
        return;
    }

    saveButton.disabled = true;
    message.textContent = eventId
        ? "Updating event..."
        : "Saving event...";

    try {
        
const eventId = scheduleEventIdInput.value;

const originalEvent = gameHubEvents.find(item =>
    String(item.id) === String(eventId)
);

const selectedScope = originalEvent?.series_id
    ? editScope.value
    : "one";

if (eventId && !originalEvent) {
    throw new Error("Selected event was not found. Reload the schedule.");
}

if (originalEvent && originalEvent.event_type !== type) {
    throw new Error(
        "Changing an existing event's type is not supported yet."
    );
}

if (
    originalEvent?.series_id &&
    selectedScope !== "one" &&
    date !== originalEvent.event_date
) {
    throw new Error(
        "To move a recurring practice to another date, " +
        "choose 'This practice only'."
    );
}

if (!eventId && type === "practice" && repeatWeekly.checked) {
    // CREATE RECURRING PRACTICES

    const selectedDays = repeatDayInputs
        .filter(input => input.checked)
        .map(input => Number(input.value));

    if (!repeatUntil.value) {
        throw new Error("Select a repeat-until date.");
    }

    if (selectedDays.length === 0) {
        throw new Error("Select at least one weekday.");
    }

    if (repeatUntil.value < date) {
        throw new Error("Repeat-until must be on or after the start date.");
    }

    const dates = generatePracticeDates(
        date,
        repeatUntil.value,
        selectedDays
    );

    if (dates.length === 0) {
        throw new Error("No practices match the selected dates.");
    }

    // Safety limit: one year of occurrences at most.
    if (
        (parsePracticeDate(repeatUntil.value) -
            parsePracticeDate(date)) / 86400000 > 366
    ) {
        throw new Error("Schedule up to one year at a time.");
    }

    const seriesId = crypto.randomUUID();

    const rows = dates.map(eventDate => ({
        ...payload,
        event_date: eventDate,
        series_id: seriesId,
        is_exception: false
    }));

    // The insert is one request, so all rows are saved together.
    const { error } = await supabaseClient
        .from("team_events")
        .insert(rows);

    if (error) throw error;

    message.textContent =
        `${rows.length} recurring practices scheduled successfully!`;

} else if (!eventId) {
    // CREATE ONE STANDALONE EVENT

    const { error } = await supabaseClient
        .from("team_events")
        .insert(payload);

    if (error) throw error;

    message.textContent = "Event saved successfully!";

} else if (
    originalEvent?.series_id &&
    selectedScope !== "one"
) {
    // EDIT THIS-AND-FUTURE OR ALL SERIES OCCURRENCES

    const changes = {
        start_time: payload.start_time,
        end_time: payload.end_time,
        location: payload.location,
        description: payload.description,
        title: payload.title
    };

    let query = supabaseClient
        .from("team_events")
        .update(changes)
        .eq("team_id", teamId)
        .eq("seasons_id", seasonId)
        .eq("series_id", originalEvent.series_id)
        .eq("is_exception", false);

    if (selectedScope === "future") {
        query = query.gte(
            "event_date",
            originalEvent.event_date
        );
    }

    const { data, error } = await query.select("id");

    if (error) throw error;

    message.textContent =
        `${data.length} practices updated successfully!`;

} else {
    // EDIT ONE EVENT, INCLUDING A SINGLE RECURRING OCCURRENCE

    const changes = {
        ...payload,
        is_exception: Boolean(originalEvent?.series_id)
    };

    const { data, error } = await supabaseClient
        .from("team_events")
        .update(changes)
        .eq("id", eventId)
        .eq("team_id", teamId)
        .eq("seasons_id", seasonId)
        .select("id")
        .single();

    if (error) throw error;

    message.textContent = "Event updated successfully!";
}


        
console.log("Schedule event saved successfully.");

resetScheduleEditor();
await loadGameHubEvents();

    } catch (error) {
        console.error("Schedule save error:", error);
        message.textContent =
            "Unable to save event: " + error.message;

    } finally {
        saveButton.disabled = false;
    }
});

const eventTypeSelect =
    document.getElementById("schedule-event-type");

const opponentField =
    document.getElementById("schedule-opponent-field");

const opponentInput =
    document.getElementById("schedule-opponent");

const extraFields =
    document.querySelector(".schedule-extra-fields");


function updateScheduleLayout() {
    const type = eventTypeSelect.value;

    const isGame = type === "game";
    const isTournament = type === "tournament";
    const isSimpleEvent =
        ["practice", "meeting", "game"].includes(type);

    const gameFields =
        document.getElementById("schedule-game-fields");

    const regularLocation =
        document.getElementById("schedule-event-location");

    const regularLocationLabel =
        document.querySelector(
            'label[for="schedule-event-location"]'
        );

    const gameVenue =
        document.getElementById("schedule-game-venue");

    const form=document.getElementById('schedule-event-form');
    const tournamentForm=document.getElementById('tournament-editor');
    form?.classList.toggle('tournament-selected',isTournament);
    if(tournamentForm){
      tournamentForm.hidden=!isTournament;
      if(isTournament){
        const chosen=document.getElementById('schedule-event-date')?.value;
        const start=document.getElementById('tournament-start');
        const end=document.getElementById('tournament-end');
        if(start&&!start.value)start.value=chosen||new Date().toISOString().slice(0,10);
        if(end&&!end.value)end.value=start?.value||'';
      }
    }
    // Tournament date range editor sits inside Manage Schedule; the ordinary
    // game/practice form fields are hidden but its event type picker remains.
    if(isTournament)return;
    opponentField.hidden = !isGame;
    opponentInput.required = isGame;

    gameFields.hidden = !isGame;
    gameVenue.required = isGame;

    // The standard event location is replaced by
    // Home/Away and Venue for basketball games.
    regularLocation.hidden = isGame;
    regularLocation.required = !isGame;

    if (regularLocationLabel) {
        regularLocationLabel.hidden = isGame;
    }

    extraFields.hidden = isSimpleEvent;

    extraFields.querySelectorAll("input, textarea")
        .forEach(field => {
            field.required =
                !isSimpleEvent &&
                field.id === "schedule-event-title";
        });

    updateRecurrenceLayout();

    const endTimeField =
    document.getElementById("schedule-end-time");

const endTimeLabel =
    document.querySelector(
        'label[for="schedule-end-time"]'
    );

endTimeField.hidden = isGame;
endTimeField.required = false;

if (endTimeLabel) {
    endTimeLabel.hidden = isGame;
}

}


eventTypeSelect.addEventListener(
    "change",
    updateScheduleLayout
);

updateScheduleLayout();


/* =====================================
   SCHEDULE MANAGEMENT PERMISSIONS
   ===================================== */

let canManageSchedule = false;

async function checkSchedulePermissions() {
    const button = document.getElementById("manage-schedule");

    canManageSchedule = false;
    if (button) button.hidden = true;

    const teamId = sessionStorage.getItem("selectedTeamId");

    if (!teamId) return;

    const { data: { user }, error: authError } =
        await supabaseClient.auth.getUser();

    if (authError || !user) return;

    const { data: membership, error } = await supabaseClient
        .from("team_members")
        .select("role")
        .eq("team_id", teamId)
        .eq("user_id", user.id)
        .in("role", ["head_coach", "coach", "assistant_coach", "manager"])
        .limit(1)
        .maybeSingle();

    if (error) {
        console.error("Schedule permissions error:", error);
        return;
    }

    // Ignore responses for a team that is no longer selected.
    if (sessionStorage.getItem("selectedTeamId") !== teamId) {
        return;
    }

    canManageSchedule = ["head_coach", "coach", "assistant_coach", "manager"].includes(membership?.role);

    if (button) {
        button.hidden = !canManageSchedule;
    }

    const tournamentAdd = document.getElementById("add-tournament");
    if (tournamentAdd) tournamentAdd.hidden = !canManageSchedule;
    console.log("Can manage schedule:", canManageSchedule);
}

// Check permissions after the shared layout is ready.
Promise.resolve(window.pageLayoutReady)
    .then(checkSchedulePermissions);

window.addEventListener(
    "seasonChanged",
    checkSchedulePermissions
);


/* =========================================
   LOAD TEAM SCHEDULE EVENTS
   ========================================= */

async function loadGameHubEvents() {
    const teamId = sessionStorage.getItem("selectedTeamId");
    const seasonId = sessionStorage.getItem("selectedSeasonId");

    if (!teamId || !seasonId) {
        gameHubEvents = [];
        return;
    }

    const { data, error } = await supabaseClient
        .from("team_events")
        .select("*")
        .eq("team_id", teamId)
        .eq("seasons_id", seasonId)
        .order("event_date", { ascending: true });

    if (error) {
        console.error("Game Hub events error:", error);
        return;
    }

    // Ignore results if the selected team or season changed.
    if (
        sessionStorage.getItem("selectedTeamId") !== teamId ||
        sessionStorage.getItem("selectedSeasonId") !== seasonId
    ) {
        return;
    }

    gameHubEvents = data || [];

console.log("Game Hub events loaded:", gameHubEvents.length);

// Refresh the calendar.
renderGameCalendar();
renderMobileSelectedDay();
renderMobileGameCard();

// Refresh the editor list if the popup is open.
if (scheduleModal && !scheduleModal.hidden) {
    renderExistingScheduleEvents();
}
}

/* =====================================
   DELETE SCHEDULE EVENT
   ===================================== */

deleteScheduleButton.addEventListener("click", async () => {
    if (selectedScheduleGameId) {
    await deleteScheduledGame();
    return;
}
    const eventId = scheduleEventIdInput.value;

    const teamId =
        sessionStorage.getItem("selectedTeamId");

    const seasonId =
        sessionStorage.getItem("selectedSeasonId");

    const message =
        document.getElementById("schedule-form-message");

    if (!canManageSchedule || !eventId || !teamId || !seasonId) {
        message.textContent =
            "Unable to delete this event.";
        return;
    }

    const selectedEvent = gameHubEvents.find(item =>
        String(item.id) === String(eventId)
    );

    if (!selectedEvent) {
        message.textContent =
            "This event is no longer available.";
        return;
    }

    const selectedScope = selectedEvent.series_id
        ? editScope.value
        : "one";

    const scopeLabels = {
        one: "this event only",
        future: "this and following events",
        all: "every event in this series"
    };

    const confirmed = confirm(
        `Delete ${scopeLabels[selectedScope]}?\n\n` +
        "This action cannot be undone."
    );

    if (!confirmed) return;

    deleteScheduleButton.disabled = true;
    message.textContent = "Deleting event...";

    try {
        let query = supabaseClient
            .from("team_events")
            .delete()
            .eq("team_id", teamId)
            .eq("seasons_id", seasonId);

        if (
            selectedEvent.series_id &&
            selectedScope !== "one"
        ) {
            query = query.eq(
                "series_id",
                selectedEvent.series_id
            );

            if (selectedScope === "future") {
                query = query.gte(
                    "event_date",
                    selectedEvent.event_date
                );
            }

        } else {
            query = query.eq("id", eventId);
        }

        const { data, error } =
            await query.select("id");

        if (error) throw error;

        if (!data || data.length === 0) {
            throw new Error(
                "No matching events were deleted."
            );
        }

        const deletedCount = data.length;

        resetScheduleEditor();
        await loadGameHubEvents();

        message.textContent =
            deletedCount === 1
                ? "Event deleted successfully!"
                : `${deletedCount} events deleted successfully!`;

    } catch (error) {
        console.error(
            "Schedule delete error:",
            error
        );

        message.textContent =
            "Unable to delete event: " + error.message;

    } finally {
        deleteScheduleButton.disabled = false;
    }
    });



/* ==============================================
   MOBILE GAME HUB — CALENDAR + CONTEXTUAL CARD
   Desktop table and game cards remain unchanged.
   ============================================== */
function mobileDateKey(date) {
    return [date.getFullYear(), String(date.getMonth()+1).padStart(2, '0'),
        String(date.getDate()).padStart(2, '0')].join('-');
}

function mobileEventRow(type, title, detail) {
    const row = document.createElement('div');
    row.className = 'mobile-activity-item';
    const label = document.createElement('span');
    label.className = 'mobile-activity-type';
    label.textContent = type;
    const name = document.createElement('strong');
    name.textContent = title;
    const info = document.createElement('small');
    info.textContent = detail;
    row.append(label, name, info);
    return row;
}

function renderMobileSelectedDay() {
    const container = document.getElementById('mobile-day-activities');
    const heading = document.getElementById('mobile-selected-date');
    if (!container || !heading) return;
    container.replaceChildren();
    if (!selectedGameDate) {
        heading.textContent = 'SELECT A DATE';
        container.appendChild(mobileEventRow('Calendar', 'Choose a date',
            'Tap a date to see its games and team events.'));
        return;
    }
    const key = mobileDateKey(selectedGameDate);
    heading.textContent = selectedGameDate.toLocaleDateString('en-US', {
        weekday:'short', month:'short', day:'numeric'
    }).toUpperCase();
    const games = gameHubGames.filter(game => String(game.date).slice(0,10) === key);
    const events = gameHubEvents.filter(event => String(event.event_date).slice(0,10) === key);
    const tournaments = window.scoridiumTournaments?.forDate(key) || [];
    for (const tournament of tournaments) {
        container.appendChild(mobileEventRow('Tournament', tournament.name || 'Tournament',
            `${tournament.starts_on} – ${tournament.ends_on}`));
    }
    for (const game of games) {
        const finished = game.status === 'completed';
        const score = finished && game.team_score != null && game.opponent_score != null
            ? ` · ${game.team_score}–${game.opponent_score}` : '';
        container.appendChild(mobileEventRow(finished ? 'Final Game' : 'Game',
            `${gameHubTeamName} vs ${game.opponent || 'Opponent'}`,
            `${game.location || 'Location TBD'}${score}`));
    }
    for (const event of events) {
        container.appendChild(mobileEventRow(event.event_type || 'Team event',
            event.title || 'Team Event',
            event.start_time || event.time || 'Time TBD'));
    }
    if (!games.length && !events.length && !tournaments.length) {
        container.appendChild(mobileEventRow('Schedule','No events', 'Nothing scheduled for this date.'));
    }
}

function renderMobileGameCard(){
 const card=document.getElementById('mobile-context-game');if(!card)return;
 const heading=card.querySelector('[data-mobile-game-heading]'),date=card.querySelector('[data-mobile-game-date]');
 const matchup=card.querySelector('[data-mobile-game-matchup]'),result=card.querySelector('[data-mobile-game-result]'),action=card.querySelector('[data-mobile-game-action]');
 const {game,live}=scCurrentGameCard(gameHubGames);
 card.classList.toggle('sc-is-live',live);heading.textContent=live?'LIVE GAME':'NEXT GAME';
 date.textContent=game?scFullDate(game.date):'No upcoming games';
 const isHome=String(game?.location||'').toLowerCase()==='home';
 const left=isHome?gameHubTeamName:(game?.opponent||'Opponent');
 const right=isHome?(game?.opponent||'Opponent'):gameHubTeamName;
 matchup.textContent=game?`${left} VS ${right}`:'No upcoming games';
 result.textContent=!game?'':live?`${isHome?game.team_score??0:game.opponent_score??0} VS ${isHome?game.opponent_score??0:game.team_score??0} · ${game.period||game.quarter?`Q${game.period||game.quarter}`:'LIVE'}`:
   `${String(game.location||'Location TBD').toUpperCase()} · UPCOMING`;
 action.disabled=!game;action.textContent=game?'View Game':'No Upcoming Game';
 action.onclick=game?()=>location.href=`watch-game.html?gameId=${encodeURIComponent(game.id)}`:null;
 if(game)void scMayTrack(game).then(canTrack=>{
  if(!action.isConnected||scCurrentGameCard(gameHubGames).game?.id!==game.id)return;
  action.textContent=canTrack?(live?'Resume Tracking':'Open Game Tracker'):'View Game';
  action.onclick=()=>location.href=`${canTrack?'game':'watch-game'}.html?gameId=${encodeURIComponent(game.id)}`;
 });
}
