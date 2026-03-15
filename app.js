import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, where, deleteDoc, doc, updateDoc, setDoc, arrayUnion, arrayRemove, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyBtL54Qo-ggT6LXfJPcoC5ZMVxp4pY1Oew",
    authDomain: "vibe-coding-irah.firebaseapp.com",
    projectId: "vibe-coding-irah",
    storageBucket: "vibe-coding-irah.firebasestorage.app",
    messagingSenderId: "724277808776",
    appId: "1:724277808776:web:c9b12d3988c9fcaa6c593d",
    measurementId: "G-7HQJK9P124"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// App State (Now synced via Firebase)
let matches = [];
let roomState = { isOccupied: false, waitingList: [] };
let previousRoomState = null;
let todayLogins = [];
let currentUser = localStorage.getItem('innova_carrom_user') || null;

// DOM Elements
const tabBtns = document.querySelectorAll('.tab-btn');
const sections = document.querySelectorAll('.view-section');
const menuToggle = document.querySelector('.menu-toggle');
const closeMenu = document.querySelector('.close-menu');
const sidebar = document.querySelector('.sidebar');
const menuOverlay = document.querySelector('.menu-overlay');
const gameTypeSelect = document.getElementById('game-type');
const doublesInputs = document.querySelectorAll('.doubles-only');
const matchForm = document.getElementById('match-form');
const statBtns = document.querySelectorAll('.stat-btn');
const leaderboardBody = document.getElementById('leaderboard-body');
const recentMatchesList = document.getElementById('recent-matches-list');
const playerProfilesBody = document.getElementById('player-profiles-body');

// Admin DOM Elements
const adminLoginCard = document.getElementById('admin-login-card');
const adminDashboardCard = document.getElementById('admin-dashboard-card');
const adminPasswordInput = document.getElementById('admin-password');
const adminLoginBtn = document.getElementById('admin-login-btn');
const adminError = document.getElementById('admin-error');
const resetAllBtn = document.getElementById('reset-all-btn');
const adminMatchesList = document.getElementById('admin-matches-list');
const adminEditCard = document.getElementById('admin-edit-card');
const editMatchForm = document.getElementById('edit-match-form');
const cancelEditBtn = document.getElementById('cancel-edit-btn');
const editMatchId = document.getElementById('edit-match-id');
const editWinner = document.getElementById('edit-winner');
const editLoser = document.getElementById('edit-loser');
const editWinnerScore = document.getElementById('edit-winner-score');
const editLoserScore = document.getElementById('edit-loser-score');
const identifyBtn = document.getElementById('identify-btn');
const userGreeting = document.getElementById('user-greeting');
const identityModal = document.getElementById('identity-modal');
const identityNameInput = document.getElementById('identity-name');
const identitySubmitBtn = document.getElementById('identity-submit');
const identityCancelBtn = document.getElementById('identity-cancel');
const downloadCsvBtn = document.getElementById('download-csv-btn');

let ADMIN_PASSWORD = ""; // Loaded from config.json
let isAdmin = false;

// Initialize
async function init() {
    try {
        const response = await fetch('config.json');
        const config = await response.json();
        ADMIN_PASSWORD = config.adminPassword;
    } catch (error) {
        console.error("Failed to load configuration:", error);
    }

    applyUserMode();
    setupEventListeners();
    loadDialogues();
    toggleDoublesInputs();

    // Set default match date to today
    document.getElementById('match-date').valueAsDate = new Date();

    // Real-time listener for matches collection
    const matchesQuery = query(collection(db, 'matches'), orderBy('date', 'desc'));
    onSnapshot(matchesQuery, (snapshot) => {
        matches = [];
        snapshot.forEach((doc) => {
            matches.push({ id: doc.id, ...doc.data() });
        });
        renderHomeDashboard();
        renderLeaderboard(document.querySelector('.stat-btn.active').dataset.stat);
        renderRecentMatches();
        updatePlayerSuggestions();
        renderPlayerProfiles();
        if (isAdmin) {
            renderAdminMatches();
            renderAdminTodayStats();
        }
    });

    // Real-time listener for Room Status & Queue
    onSnapshot(doc(db, 'live_status', 'room'), (snapshot) => {
        if (snapshot.exists()) {
            const newState = snapshot.data();
            
            if (previousRoomState && previousRoomState.isOccupied === true && newState.isOccupied === false) {
                const inQueue = newState.waitingList && newState.waitingList.some(p => 
                    (typeof p === 'string' ? p : p.name) === currentUser
                );
                if (inQueue && "Notification" in window && Notification.permission === "granted") {
                    new Notification("🟢 Innova Carrom Room is Available!", {
                        body: "It's your turn to play!",
                        icon: "innova_solutions_logo.jpeg"
                    });
                }
            }

            roomState = newState;
            previousRoomState = newState;
        } else {
            roomState = { isOccupied: false, waitingList: [] };
        }
        renderRoomStatus();
    });

    // Real-time listener for today's logins
    const todayStr = new Date().toISOString().split('T')[0];
    const loginsQuery = query(collection(db, 'logins'), where('date', '==', todayStr));
    onSnapshot(loginsQuery, (snapshot) => {
        todayLogins = [];
        snapshot.forEach((doc) => {
            todayLogins.push(doc.data());
        });
        if (isAdmin) renderAdminTodayStats();
    });

    setInterval(renderRoomStatus, 60000); // Update wait timers every minute
}

// Load Dialogues from JSON
async function loadDialogues() {
    try {
        const response = await fetch('dialogues.json');
        const data = await response.json();
        const container = document.getElementById('dialogue-scroll-content');
        
        if (container && data.dialogues && data.dialogues.length > 0) {
            container.innerHTML = data.dialogues.map(d => `<div class="dialogue-item">${d}</div>`).join('');
        }
    } catch (error) {
        console.error("Failed to load dialogues:", error);
    }
}

// Event Listeners
function setupEventListeners() {
    // Menu Toggle
    menuToggle.addEventListener('click', openMenu);
    closeMenu.addEventListener('click', closeMenuDrawer);
    menuOverlay.addEventListener('click', closeMenuDrawer);

    // Sidebar Navigation
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Only swap if not already active to avoid unnecessary DOM updates
            if (!btn.classList.contains('active')) {
                tabBtns.forEach(b => b.classList.remove('active'));
                sections.forEach(s => s.classList.remove('active'));

                btn.classList.add('active');
                document.getElementById(btn.dataset.target).classList.add('active');
            }

            // Auto close the menu drawer on mobile after clicking
            closeMenuDrawer();
        });
    });

    // Game Type Toggle
    gameTypeSelect.addEventListener('change', toggleDoublesInputs);

    // Form Submit
    matchForm.addEventListener('submit', handleMatchSubmit);

    // Leaderboard Filter Toggle
    statBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            statBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderLeaderboard(btn.dataset.stat);
        });
    });

    // Admin Events
    adminLoginBtn.addEventListener('click', handleAdminLogin);
    // Allow hitting "Enter" to submit password
    adminPasswordInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            handleAdminLogin();
        }
    });
    resetAllBtn.addEventListener('click', handleResetAll);
        editMatchForm.addEventListener('submit', handleMatchUpdate);
        cancelEditBtn.addEventListener('click', () => { adminEditCard.style.display = 'none'; });
    if (downloadCsvBtn) downloadCsvBtn.addEventListener('click', downloadCSV);

    // Room Status & LFG Events
    document.getElementById('room-status-checkbox').addEventListener('change', toggleRoomStatus);
    document.getElementById('lfg-add-btn').addEventListener('click', joinWaitingList);

    // Auth Events
    identifyBtn.addEventListener('click', () => {
        if (currentUser) {
            currentUser = null;
            localStorage.removeItem('innova_carrom_user');
            applyUserMode();
        } else {
            identityModal.classList.add('visible');
            identityNameInput.value = '';
            identityNameInput.focus();
        }
    });
    identitySubmitBtn.addEventListener('click', handleIdentitySubmit);
    identityNameInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleIdentitySubmit(); });
    identityCancelBtn.addEventListener('click', () => { identityModal.classList.remove('visible'); });

    // Make datalist inputs behave more like a <select> dropdown by showing options on click
    document.querySelectorAll('input[list]').forEach(input => {
        input.addEventListener('click', function() {
            if (this.showPicker) {
                try { this.showPicker(); } catch (e) {}
            }
        });
    });

    // Dark Mode Toggle
    const darkModeToggle = document.getElementById('dark-mode-toggle');
    if (localStorage.getItem('innova_dark_mode') === 'true') {
        document.body.classList.add('dark-mode');
        darkModeToggle.textContent = '☀️';
    }
    darkModeToggle.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        const isDark = document.body.classList.contains('dark-mode');
        localStorage.setItem('innova_dark_mode', isDark);
        darkModeToggle.textContent = isDark ? '☀️' : '🌙';
    });
}

// Menu Logic
function openMenu() {
    sidebar.classList.add('open');
    menuOverlay.classList.add('visible');
}

function closeMenuDrawer() {
    sidebar.classList.remove('open');
    menuOverlay.classList.remove('visible');
}

function handleIdentitySubmit() {
    const name = formatName(identityNameInput.value.trim());
    if (name) {
        currentUser = name;
        localStorage.setItem('innova_carrom_user', currentUser);
        identityModal.classList.remove('visible');
        applyUserMode();
    }
}

function applyUserMode() {
    const authRequiredElements = document.querySelectorAll('.auth-required');
    const roomStatusCheckbox = document.getElementById('room-status-checkbox');
    
    if (currentUser) {
        userGreeting.textContent = `👤 ${currentUser}`;
        userGreeting.style.display = 'inline-block';
        identifyBtn.textContent = 'Logout';
        identifyBtn.style.background = 'var(--text-muted)';
        authRequiredElements.forEach(el => el.classList.remove('auth-hidden'));
        roomStatusCheckbox.disabled = false;
        document.getElementById('lfg-name').value = currentUser;
        document.getElementById('t1-player1').value = currentUser;
        recordLogin(currentUser);
    } else {
        userGreeting.style.display = 'none';
        identifyBtn.textContent = '👤 Identify Yourself';
        identifyBtn.style.background = 'linear-gradient(90deg, var(--primary), #0077cc)';
        authRequiredElements.forEach(el => el.classList.add('auth-hidden'));
        roomStatusCheckbox.disabled = true;
        
        const activeTab = document.querySelector('.tab-btn.active');
        if (activeTab && activeTab.classList.contains('auth-required')) {
            document.querySelector('[data-target="home-dashboard"]').click();
        }
    }
}

// Record Login in Firestore
async function recordLogin(username) {
    if (!username) return;
    const today = new Date().toISOString().split('T')[0];
    const docId = `${username.replace(/\s+/g, '_')}_${today}`;
    try {
        await setDoc(doc(db, 'logins', docId), {
            name: username,
            date: today,
            timestamp: new Date().toISOString()
        }, { merge: true });
    } catch (e) {
        console.error("Failed to record login:", e);
    }
}

// Show/Hide second player inputs based on game type
function toggleDoublesInputs() {
    const isDoubles = gameTypeSelect.value === 'doubles';
    doublesInputs.forEach(input => {
        input.style.display = isDoubles ? 'block' : 'none';
        input.required = isDoubles;
    });
}

function formatName(name) {
    if (!name) return '';
    return name.split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
}

async function handleMatchSubmit(e) {
    e.preventDefault();

    const gameType = gameTypeSelect.value;
    const matchDateInput = document.getElementById('match-date').value;

    // Team 1 (Winners)
    const t1p1 = formatName(document.getElementById('t1-player1').value.trim());
    const t1Score = parseInt(document.getElementById('t1-score').value);
    let t1Name = t1p1;
    if (gameType === 'doubles') {
        const t1p2 = formatName(document.getElementById('t1-player2').value.trim());
        // Alphabetical sort to keep team names consistent even if entered differently
        t1Name = [t1p1, t1p2].sort().join(' & ');
    }

    // Team 2 (Losers)
    const t2p1 = formatName(document.getElementById('t2-player1').value.trim());
    const t2Score = parseInt(document.getElementById('t2-score').value);
    let t2Name = t2p1;
    if (gameType === 'doubles') {
        const t2p2 = formatName(document.getElementById('t2-player2').value.trim());
        t2Name = [t2p1, t2p2].sort().join(' & ');
    }

    // We keep date as ISO string by appending time so it converts easily later in the recent matches view
    const matchDateObj = new Date(matchDateInput);

    const newMatch = {
        date: matchDateObj.toISOString(),
        type: gameType,
        winner: t1Name,
        loser: t2Name,
        winnerScore: t1Score,
        loserScore: t2Score
    };

    try {
        // Save match to Firestore
        const docRef = await addDoc(collection(db, 'matches'), newMatch);

        // Show undo toast
        showUndoToast(docRef.id);

        // Reset UI
        matchForm.reset();
        document.getElementById('match-date').valueAsDate = new Date(); // Reset date back to today
        toggleDoublesInputs();

        // Switch to home tab automatically after saving
        document.querySelector('[data-target="home-dashboard"]').click();
    } catch (error) {
        console.error("Error saving match:", error);
        alert("Failed to save the match. Check the console for details.");
    }
}

function showUndoToast(matchId) {
    const toast = document.createElement('div');
    toast.className = 'undo-toast';
    toast.innerHTML = `
        <span>Match saved successfully!</span>
        <button id="undo-btn-${matchId}" style="background: var(--danger); color: white; border: none; padding: 0.5rem 1rem; border-radius: 4px; cursor: pointer; font-weight: bold; margin-left: 1rem;">Undo</button>
    `;
    document.body.appendChild(toast);

    const undoBtn = document.getElementById(`undo-btn-${matchId}`);
    
    let timeoutId = setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 500);
    }, 60000); // 60 seconds

    undoBtn.addEventListener('click', async () => {
        clearTimeout(timeoutId);
        try {
            await deleteDoc(doc(db, 'matches', matchId));
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 500);
        } catch (e) { console.error("Undo failed:", e); }
    });
}

function getTopPlayer(type) {
    const stats = {};
    matches.filter(m => m.type === type).forEach(match => {
        if (!stats[match.winner]) stats[match.winner] = { wins: 0 };
        stats[match.winner].wins++;
    });

    const sorted = Object.entries(stats).sort((a, b) => b[1].wins - a[1].wins);
    return sorted.length > 0 ? { name: sorted[0][0], wins: sorted[0][1].wins } : null;
}

function renderHomeDashboard() {
    const topSingles = getTopPlayer('singles');
    const topDoubles = getTopPlayer('doubles');

    if (topSingles) {
        document.getElementById('home-singles-name').textContent = topSingles.name;
        document.getElementById('home-singles-wins').textContent = `${topSingles.wins} Wins`;
    } else {
        document.getElementById('home-singles-name').textContent = "No Data";
        document.getElementById('home-singles-wins').textContent = "0 Wins";
    }

    if (topDoubles) {
        document.getElementById('home-doubles-name').textContent = topDoubles.name;
        document.getElementById('home-doubles-wins').textContent = `${topDoubles.wins} Wins`;
    } else {
        document.getElementById('home-doubles-name').textContent = "No Data";
        document.getElementById('home-doubles-wins').textContent = "0 Wins";
    }
}

function getPlayerFormAndStreak(playerName, matchesList) {
    const playerMatches = matchesList.filter(m => 
        (m.type === 'singles' && (m.winner === playerName || m.loser === playerName)) ||
        (m.type === 'doubles' && (m.winner.includes(playerName) || m.loser.includes(playerName)))
    );

    let form = [];
    let currentStreak = 0;
    let streakType = null;

    for (let i = 0; i < playerMatches.length; i++) {
        const match = playerMatches[i];
        const isWin = match.winner.includes(playerName);
        
        if (i < 5) form.push(isWin ? 'W' : 'L');

        if (streakType === null) {
            streakType = isWin ? 'W' : 'L';
            currentStreak = 1;
        } else if ((isWin && streakType === 'W') || (!isWin && streakType === 'L')) {
            currentStreak++;
        } else {
            streakType = streakType || ''; 
        }
    }

    return { form: form.reverse().join('-'), streak: currentStreak > 0 ? `${streakType === 'W' ? '🔥' : '🧊'} ${currentStreak}${streakType}` : '-' };
}

function renderLeaderboard(type) {
    const tableHeaderRow = document.getElementById('table-header-row');

    if (type === 'versus') {
        tableHeaderRow.innerHTML = `
            <th>Matchup</th>
            <th>Type</th>
            <th>Matches</th>
            <th>Record</th>
        `;
        renderVersusStats();
        return;
    }

    // Default Singles/Doubles View
    tableHeaderRow.innerHTML = `
        <th>Rank</th>
        <th>Player/Team</th>
        <th>Wins</th>
        <th>Played</th>
        <th>Win %</th>
        <th>Form</th>
        <th>Streak</th>
    `;

    const stats = {};

    // Calculate Wins, Played, etc.
    matches.filter(m => m.type === type).forEach(match => {
        // Winner stats
        if (!stats[match.winner]) stats[match.winner] = { wins: 0, played: 0 };
        stats[match.winner].wins++;
        stats[match.winner].played++;

        // Loser stats
        if (!stats[match.loser]) stats[match.loser] = { wins: 0, played: 0 };
        stats[match.loser].played++;
    });

    // Calculate percentage and rank
    const sortedStats = Object.entries(stats).map(([player, data]) => {
        const winPercent = ((data.wins / data.played) * 100).toFixed(0);
        const { form, streak } = getPlayerFormAndStreak(player, matches.filter(m => m.type === type));
        return { player, ...data, winPercent, form, streak };
    }).sort((a, b) => {
        if (b.wins !== a.wins) return b.wins - a.wins; // Primary sort by wins
        return b.winPercent - a.winPercent; // Secondary sort by win %
    }).slice(0, 3);

    // Inject into table
    leaderboardBody.innerHTML = '';

    if (sortedStats.length === 0) {
        leaderboardBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 2rem;">No matches recorded yet. Play a game!</td></tr>`;
        return;
    }

    sortedStats.forEach((stat, index) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>#${index + 1}</td>
            <td style="font-weight: 600;">${stat.player}</td>
            <td>${stat.wins}</td>
            <td>${stat.played}</td>
            <td>${stat.winPercent}%</td>
            <td style="font-size: 0.85rem; letter-spacing: 1px;">${stat.form}</td>
            <td style="font-weight: bold;">${stat.streak}</td>
        `;
        leaderboardBody.appendChild(tr);
    });
}

function renderVersusStats() {
    const matchups = {};

    matches.forEach(match => {
        // Create a unique key for the matchup regardless of who won
        const teamA = match.winner;
        const teamB = match.loser;
        // Sort the two teams alphabetically so A vs B is the same as B vs A
        const matchupKey = [teamA, teamB].sort().join(' vs ');

        if (!matchups[matchupKey]) {
            matchups[matchupKey] = {
                type: match.type,
                totalMatches: 0,
                teamAWins: 0,
                teamBWins: 0,
                teamA_name: [teamA, teamB].sort()[0],
                teamB_name: [teamA, teamB].sort()[1]
            };
        }

        matchups[matchupKey].totalMatches++;

        if (match.winner === matchups[matchupKey].teamA_name) {
            matchups[matchupKey].teamAWins++;
        } else {
            matchups[matchupKey].teamBWins++;
        }
    });

    const sortedMatchups = Object.entries(matchups).sort((a, b) => b[1].totalMatches - a[1].totalMatches).slice(0, 3);

    leaderboardBody.innerHTML = '';

    if (sortedMatchups.length === 0) {
        leaderboardBody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 2rem;">No matchups recorded yet. Play a game!</td></tr>`;
        return;
    }

    sortedMatchups.forEach(([key, data]) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-weight: 600;">
                <span style="color: var(--primary)">${data.teamA_name}</span> <br> 
                <span style="color: var(--text-muted); font-size: 0.8rem;">vs</span> <br>
                <span style="color: var(--danger)">${data.teamB_name}</span>
            </td>
            <td>${data.type === 'singles' ? '1v1' : '2v2'}</td>
            <td>${data.totalMatches}</td>
            <td style="font-weight: 800;">
                ${data.teamAWins} - ${data.teamBWins}
            </td>
        `;
        leaderboardBody.appendChild(tr);
    });
}

function renderRecentMatches() {
    recentMatchesList.innerHTML = '';

    const displayMatches = matches.slice(0, 5); // Show last 5

    if (displayMatches.length === 0) {
        recentMatchesList.innerHTML = `<li style="color: var(--text-muted); justify-content: center; padding: 2rem 0;">No recent matches.</li>`;
        return;
    }

    displayMatches.forEach(match => {
        const date = new Date(match.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        const li = document.createElement('li');
        li.innerHTML = `
            <div class="match-info">
                <span class="match-teams">
                    <span style="color: var(--primary)">${match.winner} - WON</span> <br> 
                    <span style="color: var(--danger)">${match.loser} - LOST</span>
                </span>
                <span class="match-date">Played on: ${date} • ${match.type === 'singles' ? '1v1' : '2v2'}</span>
            </div>
            <div class="match-score">
                ${match.winnerScore} - ${match.loserScore}
            </div>
        `;
        recentMatchesList.appendChild(li);
    });
}

function updatePlayerSuggestions() {
    const players = new Set();
    matches.forEach(match => {
        const winners = match.type === 'doubles' ? match.winner.split(' & ') : [match.winner];
        const losers = match.type === 'doubles' ? match.loser.split(' & ') : [match.loser];
        winners.forEach(p => players.add(p));
        losers.forEach(p => players.add(p));
    });

    const datalist = document.getElementById('player-names');
    if (datalist) {
        datalist.innerHTML = '';
        Array.from(players).sort().forEach(p => {
            const option = document.createElement('option');
            option.value = p;
            datalist.appendChild(option);
        });
    }
}

function renderPlayerProfiles() {
    const stats = {};

    matches.forEach(match => {
        const winners = match.type === 'doubles' ? match.winner.split(' & ') : [match.winner];
        const losers = match.type === 'doubles' ? match.loser.split(' & ') : [match.loser];

        winners.forEach(player => {
            if (!stats[player]) stats[player] = { played: 0, singles: 0, doubles: 0, wins: 0, losses: 0, highestScore: 0 };
            stats[player].played++;
            if (match.type === 'singles') stats[player].singles++;
            if (match.type === 'doubles') stats[player].doubles++;
            stats[player].wins++;
            if (match.winnerScore > stats[player].highestScore) {
                stats[player].highestScore = match.winnerScore;
            }
        });

        losers.forEach(player => {
            if (!stats[player]) stats[player] = { played: 0, singles: 0, doubles: 0, wins: 0, losses: 0, highestScore: 0 };
            stats[player].played++;
            if (match.type === 'singles') stats[player].singles++;
            if (match.type === 'doubles') stats[player].doubles++;
            stats[player].losses++;
            if (match.loserScore > stats[player].highestScore) {
                stats[player].highestScore = match.loserScore;
            }
        });
    });

    const sortedPlayers = Object.entries(stats).map(([name, data]) => {
        const winPercent = data.played > 0 ? ((data.wins / data.played) * 100).toFixed(0) : 0;
        const { form, streak } = getPlayerFormAndStreak(name, matches);
        return { name, ...data, winPercent, form, streak };
    }).sort((a, b) => b.wins - a.wins || b.winPercent - a.winPercent);

    playerProfilesBody.innerHTML = '';

    if (sortedPlayers.length === 0) {
        playerProfilesBody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 2rem;">No players recorded yet.</td></tr>`;
        return;
    }

    sortedPlayers.forEach(player => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-weight: 600;">${player.name}</td>
            <td>${player.played}</td>
            <td>${player.singles}</td>
            <td>${player.doubles}</td>
            <td>${player.wins}</td>
            <td>${player.losses}</td>
            <td>${player.winPercent}%</td>
            <td style="font-size: 0.85rem; letter-spacing: 1px;">${player.form}</td>
            <td style="font-weight: bold;">${player.streak}</td>
            <td>${player.highestScore}</td>
        `;
        playerProfilesBody.appendChild(tr);
    });
}

// Admin Logic
function handleAdminLogin() {
    const enteredPassword = adminPasswordInput.value.trim();
    
    if (enteredPassword === ADMIN_PASSWORD) {
        isAdmin = true;
        adminLoginCard.style.display = 'none';
        adminDashboardCard.style.display = 'block';
        adminError.style.display = 'none';
        adminPasswordInput.value = ''; // Clear the input field
        renderAdminMatches();
        renderAdminTodayStats();
    } else {
        adminError.style.display = 'block';
        alert("Incorrect password!");
    }
}

async function handleResetAll() {
    if (!isAdmin) return;
    if (confirm("Are you sure you want to delete ALL match data? This cannot be undone.")) {
        try {
            for (const match of matches) {
                await deleteDoc(doc(db, 'matches', match.id));
            }
            alert("All data reset successfully.");
        } catch (error) {
            console.error("Error resetting data:", error);
            alert("Failed to reset data.");
        }
    }
}

window.deleteMatch = async function(id) {
    if (!isAdmin) return;
    if (confirm("Are you sure you want to delete this match?")) {
        try {
            await deleteDoc(doc(db, 'matches', id));
        } catch (error) {
            console.error("Error deleting match:", error);
            alert("Failed to delete match.");
        }
    }
};

window.editMatch = function(id) {
    if (!isAdmin) return;
    const match = matches.find(m => m.id === id);
    if (!match) return;

    editMatchId.value = match.id;
    editWinner.value = match.winner;
    editLoser.value = match.loser;
    editWinnerScore.value = match.winnerScore;
    editLoserScore.value = match.loserScore;

    adminEditCard.style.display = 'block';
    adminEditCard.scrollIntoView({ behavior: 'smooth' });
};

async function handleMatchUpdate(e) {
    e.preventDefault();
    if (!isAdmin) return;

    const id = editMatchId.value;
    const updatedData = {
        winner: editWinner.value.trim(),
        loser: editLoser.value.trim(),
        winnerScore: parseInt(editWinnerScore.value),
        loserScore: parseInt(editLoserScore.value)
    };

    try {
        await updateDoc(doc(db, 'matches', id), updatedData);
        adminEditCard.style.display = 'none';
    } catch (error) {
        console.error("Error updating match:", error);
        alert("Failed to update match.");
    }
}

function renderAdminMatches() {
    if (!isAdmin) return;
    adminMatchesList.innerHTML = '';

    if (matches.length === 0) {
        adminMatchesList.innerHTML = `<li style="color: var(--text-muted); text-align: center; padding: 2rem 0;">No matches to delete.</li>`;
        return;
    }

    matches.forEach(match => {
        const date = new Date(match.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        const li = document.createElement('li');
        li.style.display = 'flex';
        li.style.justifyContent = 'space-between';
        li.style.alignItems = 'center';
        li.style.padding = '1rem';
        li.style.borderBottom = '1px solid var(--border-color)';
        li.style.marginBottom = '0.5rem';
        li.style.backgroundColor = 'var(--card-bg)';
        li.style.borderRadius = '8px';
        
        li.innerHTML = `
            <div class="match-info">
                <span class="match-teams" style="font-weight: 600;">
                    <span style="color: var(--primary)">${match.winner}</span> vs 
                    <span style="color: var(--danger)">${match.loser}</span>
                </span>
                <br>
                <span class="match-date" style="font-size: 0.8rem; color: var(--text-muted);">${date} • ${match.type === 'singles' ? '1v1' : '2v2'}</span>
            </div>
            <div style="display: flex; gap: 0.5rem;">
                <button onclick="editMatch('${match.id}')" style="background-color: var(--primary); color: white; border: none; padding: 0.5rem 1rem; border-radius: 4px; cursor: pointer; font-weight: 600;">Edit</button>
                <button onclick="deleteMatch('${match.id}')" style="background-color: var(--danger); color: white; border: none; padding: 0.5rem 1rem; border-radius: 4px; cursor: pointer; font-weight: 600;">Delete</button>
            </div>
        `;
        adminMatchesList.appendChild(li);
    });
}

function renderAdminTodayStats() {
    if (!isAdmin) return;
    
    const todayLoginsList = document.getElementById('admin-today-logins');
    const todayPlayersList = document.getElementById('admin-today-players');
    
    if (todayLoginsList) {
        todayLoginsList.innerHTML = '';
        if (todayLogins.length === 0) {
            todayLoginsList.innerHTML = '<li style="color: var(--text-muted);">No logins today.</li>';
        } else {
            // Sort by timestamp descending
            const sortedLogins = [...todayLogins].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
            sortedLogins.forEach(login => {
                const time = new Date(login.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const li = document.createElement('li');
                li.style.padding = '0.5rem 0';
                li.style.borderBottom = '1px solid rgba(0,0,0,0.05)';
                li.innerHTML = `<strong>${login.name}</strong> <span style="color: var(--text-muted); font-size: 0.8rem; float: right;">${time}</span>`;
                todayLoginsList.appendChild(li);
            });
        }
    }
    
    if (todayPlayersList) {
        todayPlayersList.innerHTML = '';
        const todayStr = new Date().toISOString().split('T')[0];
        const playersToday = new Set();
        matches.filter(m => m.date.startsWith(todayStr)).forEach(m => {
            const winners = m.type === 'doubles' ? m.winner.split(' & ') : [m.winner];
            const losers = m.type === 'doubles' ? m.loser.split(' & ') : [m.loser];
            winners.forEach(p => playersToday.add(p));
            losers.forEach(p => playersToday.add(p));
        });
        
        if (playersToday.size === 0) {
            todayPlayersList.innerHTML = '<li style="color: var(--text-muted);">No one played today.</li>';
        } else {
            Array.from(playersToday).sort().forEach(player => {
                const li = document.createElement('li');
                li.style.padding = '0.5rem 0';
                li.style.borderBottom = '1px solid rgba(0,0,0,0.05)';
                li.innerHTML = `<strong>${player}</strong>`;
                todayPlayersList.appendChild(li);
            });
        }
    }
}

function downloadCSV() {
    const startDate = document.getElementById('csv-start-date').value;
    const endDate = document.getElementById('csv-end-date').value;
    
    if (!startDate || !endDate) {
        alert("Please select both start and end dates.");
        return;
    }
    if (startDate > endDate) {
        alert("Start Date cannot be after End Date.");
        return;
    }
    
    const filteredMatches = matches.filter(m => {
        const mDate = m.date.split('T')[0];
        return mDate >= startDate && mDate <= endDate;
    });
    
    if (filteredMatches.length === 0) {
        alert("No matches found in this date range.");
        return;
    }
    
    let csvContent = "Date,Time,Type,Winner,Loser,Winner Score,Loser Score\n";
    filteredMatches.forEach(m => {
        const matchDate = new Date(m.date);
        const mDateStr = matchDate.toLocaleDateString();
        const mTimeStr = matchDate.toLocaleTimeString();
        const escWin = `"${m.winner.replace(/"/g, '""')}"`;
        const escLos = `"${m.loser.replace(/"/g, '""')}"`;
        csvContent += `${mDateStr},${mTimeStr},${m.type},${escWin},${escLos},${m.winnerScore},${m.loserScore}\n`;
    });
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `innova_carrom_matches_${startDate}_to_${endDate}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Boot application
init();

// --- LIVE ROOM STATUS LOGIC ---

async function toggleRoomStatus() {
    const checkbox = document.getElementById('room-status-checkbox');
    const newStatus = checkbox.checked;
    try {
        await setDoc(doc(db, 'live_status', 'room'), { isOccupied: newStatus }, { merge: true });
    } catch (error) {
        console.error("Error updating room status:", error);
        // Revert UI if update fails
        checkbox.checked = roomState.isOccupied;
    }
}

async function joinWaitingList() {
    const lfgNameInput = document.getElementById('lfg-name');
    const name = formatName(lfgNameInput.value.trim());
    if (!name) return alert("Please enter your name!");

    if ("Notification" in window && Notification.permission !== "granted" && Notification.permission !== "denied") {
        Notification.requestPermission();
    }

    try {
        const roomRef = doc(db, 'live_status', 'room');
        const docSnap = await getDoc(roomRef);
        const currentList = docSnap.exists() ? (docSnap.data().waitingList || []) : [];
        
        if (!currentList.find(p => (typeof p === 'string' ? p : p.name) === name)) {
            currentList.push({ name: name, joinedAt: new Date().toISOString() });
            await setDoc(roomRef, { waitingList: currentList }, { merge: true });
        }
        lfgNameInput.value = '';
    } catch (error) {
        console.error("Error joining waiting list:", error);
    }
}

window.leaveWaitingList = async function(name) {
    try {
        const roomRef = doc(db, 'live_status', 'room');
        const docSnap = await getDoc(roomRef);
        if (docSnap.exists()) {
            let currentList = docSnap.data().waitingList || [];
            currentList = currentList.filter(p => (typeof p === 'string' ? p : p.name) !== name);
            await updateDoc(roomRef, { waitingList: currentList });
        }
    } catch (error) {
        console.error("Error leaving waiting list:", error);
    }
};

function renderRoomStatus() {
    const roomStatusCheckbox = document.getElementById('room-status-checkbox');
    const roomStatusText = document.getElementById('room-status-text');
    const lfgList = document.getElementById('lfg-list');

    // Update Toggle Switch and Text
    if (roomState.isOccupied) {
        roomStatusCheckbox.checked = true;
        roomStatusText.textContent = "🔴 Room is Occupied";
        roomStatusText.className = "status-text occupied";
    } else {
        roomStatusCheckbox.checked = false;
        roomStatusText.textContent = "🟢 Room is Available";
        roomStatusText.className = "status-text available";
    }

    // Update List
    lfgList.innerHTML = '';
    if (!roomState.waitingList || roomState.waitingList.length === 0) {
        lfgList.innerHTML = '<li style="color: var(--text-muted); text-align: center; padding: 1rem 0;">No one is waiting right now. Be the first!</li>';
        return;
    }

    roomState.waitingList.forEach(item => {
        const name = typeof item === 'string' ? item : item.name;
        let timeStr = '';
        if (item.joinedAt) {
            const diffMins = Math.floor((new Date() - new Date(item.joinedAt)) / 60000);
            timeStr = `<br><span style="font-size: 0.8rem; color: var(--text-muted);">⏳ Waiting for ${diffMins} min${diffMins !== 1 ? 's' : ''}</span>`;
        }

        const li = document.createElement('li');
        li.style.display = 'flex';
        li.style.justifyContent = 'space-between';
        li.style.alignItems = 'center';
        li.style.padding = '0.8rem';
        li.style.backgroundColor = 'var(--card-bg)';
        li.style.border = '1px solid var(--border-color)';
        li.style.marginBottom = '0.5rem';
        li.style.borderRadius = '8px';

        li.innerHTML = `
            <div>
                <span style="font-weight: 600; color: var(--text-color);">👤 ${name} is looking to play!</span>
                ${timeStr}
            </div>
            <button onclick="leaveWaitingList('${name}')" style="background: var(--danger); color: white; border: none; padding: 0.4rem 0.8rem; border-radius: 6px; cursor: pointer; font-weight: 600;">Remove</button>
        `;
        lfgList.appendChild(li);
    });
}
