import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, where, deleteDoc, doc, updateDoc, setDoc, arrayUnion, arrayRemove, getDoc, runTransaction } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

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

let bo3State = {
    isActive: false,
    format: '',
    type: '',
    t1Name: '',
    t2Name: '',
    t1Wins: 0,
    t2Wins: 0,
    t1TotalScore: 0,
    t2TotalScore: 0,
    boards: []
};

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
const scratchpadInput = document.getElementById('shared-scratchpad');
let scratchpadDebounceTimer;

let ADMIN_PASSWORD = ""; // Loaded from config.json
let isAdmin = false;

// Avatar Helper
function getAvatarUrl(seed) {
    return `https://api.dicebear.com/8.x/micah/svg?seed=${encodeURIComponent(seed)}&backgroundColor=transparent`;
}

function renderAvatarHtml(nameStr, extraClasses = "w-8 h-8 border border-zinc-700") {
    if (!nameStr) return '';
    const names = nameStr.split(' & ');
    if (names.length === 1) {
        return `<img src="${getAvatarUrl(names[0])}" alt="${names[0]}" class="${extraClasses} rounded-full bg-zinc-800 object-cover shrink-0">`;
    } else {
        return `<div class="flex -space-x-3 shrink-0"><img src="${getAvatarUrl(names[0])}" class="${extraClasses} rounded-full bg-zinc-800 z-10 relative object-cover"><img src="${getAvatarUrl(names[1])}" class="${extraClasses} rounded-full bg-zinc-800 z-0 relative object-cover"></div>`;
    }
}

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
        const activeStatBtn = document.querySelector('.stat-btn.active');
        if (activeStatBtn) {
            renderLeaderboard(activeStatBtn.dataset.stat);
        }
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

    // Real-time listener for shared scratchpad
    onSnapshot(doc(db, 'shared_data', 'scratchpad'), (snapshot) => {
        if (scratchpadInput && document.activeElement !== scratchpadInput) {
            if (snapshot.exists()) {
                scratchpadInput.value = snapshot.data().text || '';
            } else {
                scratchpadInput.value = '';
            }
        }
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
    if (menuToggle) menuToggle.addEventListener('click', openMenu);
    if (closeMenu) closeMenu.addEventListener('click', closeMenuDrawer);
    if (menuOverlay) menuOverlay.addEventListener('click', closeMenuDrawer);

    // Sidebar Navigation
    if (tabBtns) tabBtns.forEach(btn => {
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
    if (gameTypeSelect) gameTypeSelect.addEventListener('change', toggleDoublesInputs);

    // Form Submit
    if (matchForm) matchForm.addEventListener('submit', handleMatchSubmit);

    // Leaderboard Filter Toggle
    if (statBtns) statBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            statBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderLeaderboard(btn.dataset.stat);
        });
    });

    // Admin Events
    if (adminLoginBtn) adminLoginBtn.addEventListener('click', handleAdminLogin);
    // Allow hitting "Enter" to submit password
    if (adminPasswordInput) adminPasswordInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            handleAdminLogin();
        }
    });
    if (resetAllBtn) resetAllBtn.addEventListener('click', handleResetAll);
    if (editMatchForm) editMatchForm.addEventListener('submit', handleMatchUpdate);
    if (cancelEditBtn) cancelEditBtn.addEventListener('click', () => { adminEditCard.style.display = 'none'; });
    if (downloadCsvBtn) downloadCsvBtn.addEventListener('click', downloadCSV);

    // Scratchpad Auto-Save
    if (scratchpadInput) {
        scratchpadInput.addEventListener('input', () => {
            clearTimeout(scratchpadDebounceTimer);
            
            // Wait 1 second after typing stops to save
            scratchpadDebounceTimer = setTimeout(async () => {
                const content = scratchpadInput.value;
                try {
                    if (content.trim().length === 0) {
                        await deleteDoc(doc(db, 'shared_data', 'scratchpad'));
                    } else {
                        await setDoc(doc(db, 'shared_data', 'scratchpad'), { text: content }, { merge: true });
                    }
                } catch (error) {
                    console.error("Error saving scratchpad:", error);
                }
            }, 1000); 
        });
    }

    // Room Status & LFG Events
    const roomStatusCheckbox = document.getElementById('room-status-checkbox');
    if (roomStatusCheckbox) roomStatusCheckbox.addEventListener('change', toggleRoomStatus);
    const lfgAddBtn = document.getElementById('lfg-add-btn');
    if (lfgAddBtn) lfgAddBtn.addEventListener('click', joinWaitingList);

    // Auth Events
    if (identifyBtn) identifyBtn.addEventListener('click', () => {
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
    if (identitySubmitBtn) identitySubmitBtn.addEventListener('click', handleIdentitySubmit);
    if (identityNameInput) identityNameInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleIdentitySubmit(); });
    if (identityCancelBtn) identityCancelBtn.addEventListener('click', () => { identityModal.classList.remove('visible'); });

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
    if (darkModeToggle) {
        if (localStorage.getItem('innova_light_mode') === 'true') {
            document.body.classList.add('light-mode');
            darkModeToggle.textContent = '🌙';
        }
        darkModeToggle.addEventListener('click', () => {
            document.body.classList.toggle('light-mode');
            const isLight = document.body.classList.contains('light-mode');
            localStorage.setItem('innova_light_mode', isLight);
            darkModeToggle.textContent = isLight ? '🌙' : '☀️';
        });
    }
}

// Menu Logic
function openMenu() {
    sidebar.classList.add('open');
    menuOverlay.classList.add('visible');
}

function closeMenuDrawer() {
    if (sidebar) sidebar.classList.remove('open');
    if (menuOverlay) menuOverlay.classList.remove('visible');
}

function handleIdentitySubmit() {
    if (!identityNameInput) return;
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
        if (userGreeting) {
            userGreeting.innerHTML = `<img src="${getAvatarUrl(currentUser)}" class="w-6 h-6 inline-block rounded-full mr-2 border border-blue-500 bg-zinc-800 align-middle object-cover"> <span class="align-middle">${currentUser}</span>`;
            userGreeting.style.display = 'inline-block';
        }
        if (identifyBtn) {
            identifyBtn.textContent = 'Logout';
            identifyBtn.style.background = 'var(--text-muted)';
        }
        authRequiredElements.forEach(el => el.classList.remove('auth-hidden'));
        if (roomStatusCheckbox) roomStatusCheckbox.disabled = false;
        const lfgNameInput = document.getElementById('lfg-name');
        if (lfgNameInput) lfgNameInput.value = currentUser;
        const t1Player1 = document.getElementById('t1-player1');
        if (t1Player1) t1Player1.value = currentUser;
        
        const lfgLoginBtn = document.getElementById('lfg-login-btn');
        if (lfgLoginBtn) lfgLoginBtn.style.display = 'none';
        
        recordLogin(currentUser);
    } else {
        if (userGreeting) userGreeting.style.display = 'none';
        if (identifyBtn) {
            identifyBtn.textContent = '👤 Identify Yourself';
            identifyBtn.style.background = 'linear-gradient(90deg, var(--primary), #0077cc)';
        }
        authRequiredElements.forEach(el => el.classList.add('auth-hidden'));
        if (roomStatusCheckbox) roomStatusCheckbox.disabled = true;
        
        const lfgLoginBtn = document.getElementById('lfg-login-btn');
        if (lfgLoginBtn) lfgLoginBtn.style.display = 'block';
        
        const activeTab = document.querySelector('.tab-btn.active');
        if (activeTab && activeTab.classList.contains('auth-required')) {
            const homeTab = document.querySelector('[data-target="home-dashboard"]');
            if (homeTab) homeTab.click();
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
    if (!gameTypeSelect) return;
    const isDoubles = gameTypeSelect.value === 'doubles';
    if (doublesInputs) doublesInputs.forEach(input => {
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

function calculateBoardScore(opponentCoinsLeft, winnerCoveredQueen) {
    let score = opponentCoinsLeft;
    if (winnerCoveredQueen) {
        score += 3;
    }
    return score;
}

async function handleMatchSubmit(e) {
    e.preventDefault();

    const gameType = gameTypeSelect.value;
    const matchFormatSelect = document.getElementById('match-format') || { value: 'knockout' };
    const matchDateInput = document.getElementById('match-date').value;
    const boardWinner = document.getElementById('board-winner') ? document.getElementById('board-winner').value : 't1';
    const opponentCoins = document.getElementById('opponent-coins') ? parseInt(document.getElementById('opponent-coins').value) || 0 : 0;
    const queenCover = document.getElementById('queen-cover') ? document.getElementById('queen-cover').value : 'none';

    const isT1Winner = boardWinner === 't1';
    const isT2Winner = boardWinner === 't2';

    // Calculate Score for this board
    const winnerCoveredQueen = (isT1Winner && queenCover === 't1') || (isT2Winner && queenCover === 't2');
    const boardScore = calculateBoardScore(opponentCoins, winnerCoveredQueen);

    let t1BoardScore = isT1Winner ? boardScore : 0;
    let t2BoardScore = isT2Winner ? boardScore : 0;

    // Team 1
    const t1p1 = formatName(document.getElementById('t1-player1').value.trim());
    let t1Name = t1p1;
    if (gameType === 'doubles') {
        const t1p2 = formatName(document.getElementById('t1-player2').value.trim());
        // Alphabetical sort to keep team names consistent even if entered differently
        t1Name = [t1p1, t1p2].sort().join(' & ');
    }

    // Team 2
    const t2p1 = formatName(document.getElementById('t2-player1').value.trim());
    let t2Name = t2p1;
    if (gameType === 'doubles') {
        const t2p2 = formatName(document.getElementById('t2-player2').value.trim());
        t2Name = [t2p1, t2p2].sort().join(' & ');
    }

    const format = matchFormatSelect.value;

    if (format === 'knockout') {
        const matchDateObj = new Date(matchDateInput);
        const newMatch = {
            date: matchDateObj.toISOString(),
            type: gameType,
            format: 'knockout',
            winner: isT1Winner ? t1Name : t2Name,
            loser: isT1Winner ? t2Name : t1Name,
            winnerScore: isT1Winner ? t1BoardScore : t2BoardScore,
            loserScore: isT1Winner ? t2BoardScore : t1BoardScore,
            boards: [{
                boardNumber: 1,
                boardWinner: isT1Winner ? t1Name : t2Name,
                opponentCoinsLeft: opponentCoins,
                queenCoveredBy: queenCover === 't1' ? t1Name : (queenCover === 't2' ? t2Name : 'none'),
                calculatedPoints: boardScore
            }]
        };
        await saveMatchAndReset(newMatch);
    } else if (format === 'bo3') {
        if (!bo3State.isActive) {
            bo3State = {
                isActive: true, format: 'bo3', type: gameType,
                t1Name: t1Name, t2Name: t2Name,
                t1Wins: 0, t2Wins: 0, t1TotalScore: 0, t2TotalScore: 0, boards: []
            };
            disablePlayerInputs(true);
        }

        if (isT1Winner) bo3State.t1Wins++;
        if (isT2Winner) bo3State.t2Wins++;
        
        bo3State.t1TotalScore += t1BoardScore;
        bo3State.t2TotalScore += t2BoardScore;

        bo3State.boards.push({
            boardNumber: bo3State.boards.length + 1,
            boardWinner: isT1Winner ? bo3State.t1Name : bo3State.t2Name,
            opponentCoinsLeft: opponentCoins,
            queenCoveredBy: queenCover === 't1' ? bo3State.t1Name : (queenCover === 't2' ? bo3State.t2Name : 'none'),
            calculatedPoints: boardScore
        });

        if (bo3State.t1Wins === 2 || bo3State.t2Wins === 2) {
            const matchWinner = bo3State.t1Wins === 2 ? bo3State.t1Name : bo3State.t2Name;
            const matchLoser = bo3State.t1Wins === 2 ? bo3State.t2Name : bo3State.t1Name;
            
            const matchDateObj = new Date(matchDateInput);
            const newMatch = {
                date: matchDateObj.toISOString(),
                type: bo3State.type,
                format: 'bo3',
                winner: matchWinner,
                loser: matchLoser,
                winnerScore: bo3State.t1Wins === 2 ? bo3State.t1TotalScore : bo3State.t2TotalScore,
                loserScore: bo3State.t1Wins === 2 ? bo3State.t2TotalScore : bo3State.t1TotalScore,
                boards: bo3State.boards,
                team1Wins: bo3State.t1Wins,
                team2Wins: bo3State.t2Wins
            };

            await saveMatchAndReset(newMatch);
            bo3State.isActive = false;
            disablePlayerInputs(false);
            
            const scoreboard = document.getElementById('bo3-scoreboard');
            if (scoreboard) scoreboard.innerText = '';
            
            const submitBtn = document.querySelector('#match-form button[type="submit"]');
            if (submitBtn) submitBtn.innerText = 'Submit Match';
        } else {
            const scoreboard = document.getElementById('bo3-scoreboard');
            if (scoreboard) scoreboard.innerText = `${bo3State.t1Name}: ${bo3State.t1Wins} Wins - ${bo3State.t2Name}: ${bo3State.t2Wins} Wins`;
            
            const submitBtn = document.querySelector('#match-form button[type="submit"]');
            if (submitBtn) submitBtn.innerText = `Log Board ${bo3State.boards.length + 1}`;
            
            if (document.getElementById('opponent-coins')) document.getElementById('opponent-coins').value = 0;
            if (document.getElementById('coins-val')) document.getElementById('coins-val').innerText = '0';
            if (document.getElementById('queen-cover')) document.getElementById('queen-cover').value = 'none';
        }
    }
}

async function saveMatchAndReset(newMatch) {
    try {
        const docRef = await addDoc(collection(db, 'matches'), newMatch);
        showUndoToast(docRef.id);
        
        matchForm.reset();
        document.getElementById('match-date').valueAsDate = new Date();
        toggleDoublesInputs();
        if (document.getElementById('coins-val')) {
            document.getElementById('coins-val').innerText = '0';
        }
        
        document.querySelector('[data-target="home-dashboard"]').click();
    } catch (error) {
        console.error("Error saving match:", error);
        alert("Failed to save the match. Check the console for details.");
    }
}

function disablePlayerInputs(disabled) {
    ['t1-player1', 't1-player2', 't2-player1', 't2-player2', 'game-type'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.disabled = disabled;
    });
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

    const homeSinglesName = document.getElementById('home-singles-name');
    const homeSinglesWins = document.getElementById('home-singles-wins');
    const homeSinglesAvatar = document.getElementById('home-singles-avatar-container');
    if (homeSinglesName && homeSinglesWins) {
        if (topSingles) {
            homeSinglesName.textContent = topSingles.name;
            homeSinglesWins.textContent = `${topSingles.wins} Wins`;
            if (homeSinglesAvatar) homeSinglesAvatar.innerHTML = renderAvatarHtml(topSingles.name, 'w-10 h-10 border-2 border-yellow-500');
        } else {
            homeSinglesName.textContent = "No Data";
            homeSinglesWins.textContent = "0 Wins";
            if (homeSinglesAvatar) homeSinglesAvatar.innerHTML = `<div class="w-8 h-8 rounded-full bg-yellow-500 text-black flex items-center justify-center font-bold">★</div>`;
        }
    }

    const homeDoublesName = document.getElementById('home-doubles-name');
    const homeDoublesWins = document.getElementById('home-doubles-wins');
    const homeDoublesAvatar = document.getElementById('home-doubles-avatar-container');
    if (homeDoublesName && homeDoublesWins) {
        if (topDoubles) {
            homeDoublesName.textContent = topDoubles.name;
            homeDoublesWins.textContent = `${topDoubles.wins} Wins`;
            if (homeDoublesAvatar) homeDoublesAvatar.innerHTML = renderAvatarHtml(topDoubles.name, 'w-10 h-10 border-2 border-blue-400');
        } else {
            homeDoublesName.textContent = "No Data";
            homeDoublesWins.textContent = "0 Wins";
            if (homeDoublesAvatar) homeDoublesAvatar.innerHTML = `<div class="w-8 h-8 rounded-sm bg-zinc-800 flex items-center justify-center border border-zinc-700 text-blue-300">🛡️</div>`;
        }
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
    if (!tableHeaderRow || !leaderboardBody) return;

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
        leaderboardBody.innerHTML = `<tr><td colspan="7" class="text-center text-zinc-500 py-8">No matches recorded yet. Play a game!</td></tr>`;
        return;
    }

    sortedStats.forEach((stat, index) => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-zinc-800/30 transition-colors';
        tr.innerHTML = `
            <td class="py-3 px-2">#${index + 1}</td>
            <td class="py-3 px-2 font-bold text-white">
                <div class="flex items-center gap-3">
                    ${renderAvatarHtml(stat.player)}
                    <span>${stat.player}</span>
                </div>
            </td>
            <td class="py-3 px-2">${stat.wins}</td>
            <td class="py-3 px-2 text-zinc-400">${stat.played}</td>
            <td class="py-3 px-2 font-bold text-blue-400">${stat.winPercent}%</td>
            <td class="py-3 px-2 text-xs tracking-widest text-zinc-300">${stat.form}</td>
            <td class="py-3 px-2 font-bold">${stat.streak}</td>
        `;
        leaderboardBody.appendChild(tr);
    });
}

function renderVersusStats() {
    if (!leaderboardBody) return;
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
        leaderboardBody.innerHTML = `<tr><td colspan="4" class="text-center text-zinc-500 py-8">No matchups recorded yet. Play a game!</td></tr>`;
        return;
    }

    sortedMatchups.forEach(([key, data]) => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-zinc-800/30 transition-colors';
        tr.innerHTML = `
            <td class="py-3 px-2 font-bold leading-tight min-w-[150px]">
                <div class="flex items-center gap-2 mb-1">
                    ${renderAvatarHtml(data.teamA_name, 'w-5 h-5 border border-zinc-700')}
                    <span class="text-blue-400">${data.teamA_name}</span>
                </div>
                <span class="text-zinc-500 text-[10px] ml-7">vs</span>
                <div class="flex items-center gap-2 mt-1">
                    ${renderAvatarHtml(data.teamB_name, 'w-5 h-5 border border-zinc-700')}
                    <span class="text-red-400">${data.teamB_name}</span>
                </div>
            </td>
            <td class="py-3 px-2">${data.type === 'singles' ? '1v1' : '2v2'}</td>
            <td class="py-3 px-2 text-zinc-400">${data.totalMatches}</td>
            <td class="py-3 px-2 font-black text-lg text-white">
                ${data.teamAWins} - ${data.teamBWins}
            </td>
        `;
        leaderboardBody.appendChild(tr);
    });
}

function renderRecentMatches() {
    if (!recentMatchesList) return;
    recentMatchesList.innerHTML = '';

    const displayMatches = matches.slice(0, 5); // Show last 5

    if (displayMatches.length === 0) {
        recentMatchesList.innerHTML = `<li class="text-center text-zinc-500 py-4">No recent matches.</li>`;
        return;
    }

    displayMatches.forEach(match => {
        const date = new Date(match.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        
        let scoreText = `${match.winnerScore} - ${match.loserScore} <span class="text-[10px] text-zinc-500 block">PTS</span>`;
        if (match.format === 'bo3') {
            const winnerWins = Math.max(match.team1Wins, match.team2Wins);
            const loserWins = Math.min(match.team1Wins, match.team2Wins);
            scoreText = `${winnerWins} - ${loserWins} <span class="text-[10px] text-zinc-500 block">WINS</span>`;
        }
        
        const li = document.createElement('li');
        li.className = "flex justify-between items-center bg-[#18181b] p-3 rounded-xl border border-zinc-800/50";
        li.innerHTML = `
            <div class="flex flex-col gap-1.5">
                <div class="flex items-center gap-2">
                    ${renderAvatarHtml(match.winner, 'w-5 h-5 border border-zinc-700')}
                    <span class="font-bold text-sm leading-tight text-blue-400">${match.winner} <span class="text-green-500 text-xs ml-1">W</span></span>
                </div>
                <div class="flex items-center gap-2">
                    ${renderAvatarHtml(match.loser, 'w-5 h-5 border border-zinc-700 opacity-60')}
                    <span class="font-bold text-sm leading-tight text-zinc-500">${match.loser} <span class="text-red-500 text-[10px] ml-1">L</span></span>
                </div>
                <span class="text-[10px] text-zinc-500 mt-0.5">${date} • ${match.type === 'singles' ? '1v1' : '2v2'}</span>
            </div>
            <div class="font-black text-right">
                ${scoreText}
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
    if (!playerProfilesBody) return;
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
        playerProfilesBody.innerHTML = `<tr><td colspan="10" class="text-center text-zinc-500 py-8">No players recorded yet.</td></tr>`;
        return;
    }

    sortedPlayers.forEach(player => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-zinc-800/30 transition-colors';
        tr.innerHTML = `
            <td class="py-3 px-2 font-bold text-white">
                <div class="flex items-center gap-3">
                    ${renderAvatarHtml(player.name)}
                    <span>${player.name}</span>
                </div>
            </td>
            <td class="py-3 px-2 text-zinc-400">${player.played}</td>
            <td class="py-3 px-2">${player.singles}</td>
            <td class="py-3 px-2">${player.doubles}</td>
            <td class="py-3 px-2 text-green-400 font-bold">${player.wins}</td>
            <td class="py-3 px-2 text-red-400 font-bold">${player.losses}</td>
            <td class="py-3 px-2 text-blue-400 font-bold">${player.winPercent}%</td>
            <td class="py-3 px-2 text-xs tracking-widest text-zinc-300">${player.form}</td>
            <td class="py-3 px-2 font-bold">${player.streak}</td>
            <td class="py-3 px-2 font-bold text-yellow-500">${player.highestScore}</td>
        `;
        playerProfilesBody.appendChild(tr);
    });
}

// Admin Logic
function handleAdminLogin() {
    if (!adminPasswordInput) return;
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
        adminMatchesList.innerHTML = `<li class="text-zinc-500 text-center py-8">No matches to delete.</li>`;
        return;
    }

    matches.forEach(match => {
        const date = new Date(match.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        const li = document.createElement('li');
        li.className = 'flex justify-between items-center p-4 bg-[#202024] border border-zinc-800/50 rounded-xl mb-2';
        
        li.innerHTML = `
            <div class="match-info">
                <span class="match-teams font-bold text-sm">
                    <span class="text-blue-400">${match.winner}</span> <span class="text-zinc-500 text-xs mx-1">vs</span> 
                    <span class="text-red-400">${match.loser}</span>
                </span>
                <br>
                <span class="text-xs text-zinc-500 font-semibold">${date} • ${match.type === 'singles' ? '1v1' : '2v2'}</span>
            </div>
            <div class="flex gap-2">
                <button onclick="editMatch('${match.id}')" class="bg-blue-500 hover:bg-blue-400 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors shadow-md">Edit</button>
                <button onclick="deleteMatch('${match.id}')" class="bg-red-500 hover:bg-red-400 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors shadow-md">Delete</button>
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
        await updateDoc(doc(db, 'live_status', 'room'), { isOccupied: newStatus });
    } catch (error) {
        console.error("Error updating room status:", error);
        // Revert UI if update fails
        checkbox.checked = roomState.isOccupied;
    }
}

async function joinWaitingList() {
    const lfgNameInput = document.getElementById('lfg-name');
    if (!lfgNameInput) return;
    const name = formatName(lfgNameInput.value.trim());
    if (!name) {
        alert("Please identify yourself first to join the queue.");
        return;
    }

    if ("Notification" in window && Notification.permission !== "granted" && Notification.permission !== "denied") {
        Notification.requestPermission();
    }

    try {
        const roomRef = doc(db, 'live_status', 'room');
        await runTransaction(db, async (transaction) => {
            const roomDoc = await transaction.get(roomRef);
            const currentList = roomDoc.exists() ? (roomDoc.data().waitingList || []) : [];
            
            const alreadyInQueue = currentList.some(p => (typeof p === 'string' ? p : p.name) === name);
            if (alreadyInQueue) {
                throw "ALREADY_IN_QUEUE";
            }

            const newList = [...currentList, { name: name, joinedAt: new Date().toISOString() }];
            transaction.set(roomRef, { waitingList: newList }, { merge: true });
        });

    } catch (error) {
        if (error === "ALREADY_IN_QUEUE") {
            alert("You are already in the queue.");
        } else {
            console.error("Error joining waiting list:", error);
            alert("Failed to join the queue. Please try again.");
        }
    }
}

window.leaveWaitingList = async function(name) {
    try {
        const roomRef = doc(db, 'live_status', 'room');
        await runTransaction(db, async (transaction) => {
            const roomDoc = await transaction.get(roomRef);
            if (!roomDoc.exists()) {
                return;
            }
            const currentList = roomDoc.data().waitingList || [];
            const newList = currentList.filter(p => (typeof p === 'string' ? p : p.name) !== name);

            if (newList.length < currentList.length) {
                transaction.update(roomRef, { waitingList: newList });
            }
        });
    } catch (error) {
        console.error("Error leaving waiting list:", error);
    }
};

function renderRoomStatus() {
    const roomStatusCheckbox = document.getElementById('room-status-checkbox');
    const roomStatusText = document.getElementById('room-status-text');
    const roomStatusBadge = document.getElementById('room-status-badge');
    const lfgList = document.getElementById('lfg-list');

    // Update Toggle Switch and Text
    if (roomStatusCheckbox && roomStatusText && roomStatusBadge) {
        if (roomState.isOccupied) {
            roomStatusCheckbox.checked = true;
            roomStatusText.textContent = "ROOM OCCUPIED";
            roomStatusBadge.className = "px-3 py-1 text-xs font-bold rounded-full border flex items-center gap-2 text-red-400 bg-red-900/20 border-red-800/30";
        } else {
            roomStatusCheckbox.checked = false;
            roomStatusText.textContent = "AVAILABLE NOW";
            roomStatusBadge.className = "px-3 py-1 text-xs font-bold rounded-full border flex items-center gap-2 text-green-400 bg-green-900/20 border-green-800/30";
        }
    }

    // Update List
    if (lfgList) {
        lfgList.innerHTML = '';
        if (!roomState.waitingList || roomState.waitingList.length === 0) {
            lfgList.innerHTML = '<li class="text-center text-zinc-500 text-sm py-4">No one is waiting right now. Be the first!</li>';
            return;
        }

        roomState.waitingList.forEach(item => {
            const name = typeof item === 'string' ? item : item.name;
            let timeStr = '';
            if (item.joinedAt) {
                const diffMins = Math.floor((new Date() - new Date(item.joinedAt)) / 60000);
                timeStr = `<span class="text-xs text-zinc-500 bg-zinc-800 px-2 py-1 rounded">${diffMins}m ago</span>`;
            }

            const li = document.createElement('li');
            li.className = 'flex items-center justify-between bg-[#202024] p-3 rounded-xl border border-zinc-800/50';
            
            li.innerHTML = `
                <div class="flex items-center gap-3">
                    ${renderAvatarHtml(name, 'w-9 h-9 border-2 border-blue-500')}
                    <div>
                        <div class="font-bold text-sm text-zinc-300">${name}</div>
                        <div class="text-[10px] text-zinc-500 font-semibold">QUEUED</div>
                    </div>
                </div>
                <div class="flex items-center gap-2">
                    ${timeStr}
                    <button onclick="leaveWaitingList('${name}')" class="text-xs text-red-400 hover:text-red-300 font-bold px-2 py-1 bg-red-900/20 rounded">✕</button>
                </div>
            `;
            lfgList.appendChild(li);
        });
    }
}
