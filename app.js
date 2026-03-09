const state = {
    user: { name: '' },
    currentView: 'login',
    question: '',
    options: [],
    history: [],
    aiAlternative: null,
    wheelColors: ['#8b5cf6', '#3b82f6', '#0ea5e9', '#10b981', '#f59e0b', '#ec4899']
};

// DOM Elements
const views = {
    login: document.getElementById('view-login'),
    home: document.getElementById('view-home'),
    loading: document.getElementById('view-loading'),
    options: document.getElementById('view-options'),
    analysis: document.getElementById('view-analysis'),
    wheel: document.getElementById('view-wheel'),
    history: document.getElementById('view-history')
};

// Init
document.addEventListener('DOMContentLoaded', () => {
    loadState();
    setupThemeToggle();
    setupEventListeners();
    checkAuth();
});

// Authentication
function loadState() {
    const savedUser = localStorage.getItem('decision_user');
    if (savedUser) state.user = JSON.parse(savedUser);
    
    const savedHistory = localStorage.getItem('decision_history');
    if (savedHistory) state.history = JSON.parse(savedHistory);
}

function checkAuth() {
    if (state.user.name) {
        document.getElementById('user-greeting').textContent = `Hi, ${state.user.name}!`;
        document.getElementById('main-nav').classList.remove('hidden');
        switchView('home');
    } else {
        document.getElementById('main-nav').classList.add('hidden');
        switchView('login');
    }
}

// Navigation
function switchView(viewName) {
    if (!views[viewName]) return;
    Object.values(views).forEach(el => {
        el.classList.add('hidden');
        el.classList.remove('active');
    });
    
    views[viewName].classList.remove('hidden');
    void views[viewName].offsetWidth; // reflow
    views[viewName].classList.add('active');
    
    state.currentView = viewName;
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Event Listeners
function setupEventListeners() {
    // Nav
    document.getElementById('btn-history').addEventListener('click', () => { renderHistory(); switchView('history'); });
    document.querySelector('.logo').addEventListener('click', () => { if (state.user.name) switchView('home'); });
    document.getElementById('btn-logout').addEventListener('click', () => {
        localStorage.removeItem('decision_user');
        state.user = { name: '' };
        checkAuth();
    });

    // Login
    document.getElementById('btn-login').addEventListener('click', () => {
        const name = document.getElementById('login-name').value.trim();
        
        if (!name) {
            alert("Please enter a name.");
            return;
        }
        
        state.user = { name };
        localStorage.setItem('decision_user', JSON.stringify(state.user));
        checkAuth();
    });

    // Home
    document.getElementById('btn-manual-start').addEventListener('click', () => {
        state.question = "My Custom Decision";
        state.options = [];
        state.aiAlternative = null;
        document.getElementById('display-question').textContent = state.question;
        document.getElementById('ai-alternative-box').classList.add('hidden');
        
        const container = document.getElementById('options-container');
        container.innerHTML = '';
        addOptionCard(); addOptionCard();
        switchView('options');
    });

    document.getElementById('btn-ai-analyze').addEventListener('click', () => {
        const input = document.getElementById('ai-decision-input').value.trim();
        if (!input) { alert("Please enter something to analyze."); return; }
        analyzeWithAI(input);
    });

    // Options Panel
    document.getElementById('btn-add-option').addEventListener('click', () => addOptionCard());
    document.getElementById('btn-back-home').addEventListener('click', () => switchView('home'));
    
    document.getElementById('btn-add-alternative').addEventListener('click', () => {
        if (!state.aiAlternative) return;
        addOptionCard(state.aiAlternative);
        document.getElementById('btn-add-alternative').disabled = true;
        document.getElementById('btn-add-alternative').innerHTML = '<i class="fa-solid fa-check"></i> Added';
    });

    document.getElementById('btn-analyze').addEventListener('click', () => {
        if (!validateOptions()) return;
        saveOptionsState();
        performAnalysis();
        switchView('analysis');
    });

    document.getElementById('btn-go-wheel').addEventListener('click', () => {
        if (!validateOptions(true)) return;
        saveOptionsState();
        setupWheel();
        switchView('wheel');
    });

    // Analysis
    document.getElementById('btn-back-options').addEventListener('click', () => switchView('options'));
    document.getElementById('btn-save-decision').addEventListener('click', () => {
        saveDecisionToHistory();
        renderHistory();
        switchView('history');
    });

    // Wheel
    document.getElementById('btn-back-options-wheel').addEventListener('click', () => switchView('options'));
    document.getElementById('btn-spin-wheel').addEventListener('click', spinWheel);

    // History
    document.getElementById('btn-home-from-history').addEventListener('click', () => switchView('home'));
}

// AI Integration
async function analyzeWithAI(promptText) {
    const API_KEY = "YOUR_GEMINI_API_KEY"; // Replace with your actual Gemini API Key
    
    if (API_KEY === "YOUR_GEMINI_API_KEY") { 
        alert("Please set your Gemini API key in app.js to use AI Analysis."); 
        return; 
    }
    
    state.question = promptText;
    switchView('loading');
    
    const apiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;
    
    const systemInstruction = `
    You are a professional decision-making assistant. The user will give you a comparison or a question (e.g., "iPhone 15 vs S24" or "Which JS framework to learn?").
    You must return a raw JSON object (NO markdown formatting, NO backticks) with the following exact structure:
    {
      "question": "A concise title for the decision",
      "options": [
        {
          "name": "Name of Option",
          "pros": ["Pro 1", "Pro 2", "Pro 3"],
          "cons": ["Con 1", "Con 2"],
          "baseScore": 8 // Number 1-10 based on object quality
        }
      ],
      "alternative": {
        "show": true, // true if you can think of a strictly BETTER 3rd option
        "suggestionText": "Brief explanation of why this 3rd option is better.",
        "option": {
          "name": "Alternative Name",
          "pros": ["Pro 1"], "cons": ["Con 1"], "baseScore": 9
        }
      }
    }
    Make the pros and cons concise but highly professional and accurate. Keep it under 5 pros/cons max per option.
    `;

    try {
        const response = await fetch(apiEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                system_instruction: { parts: { text: systemInstruction } },
                contents: [{ parts: [{ text: promptText }] }],
                generationConfig: { temperature: 0.2, response_mime_type: "application/json" }
            })
        });

        if (!response.ok) { throw new Error(`API Error: ${response.status}`); }
        
        const data = await response.json();
        const jsonText = data.candidates[0].content.parts[0].text;
        
        let result;
        try {
            result = JSON.parse(jsonText);
        } catch (e) {
            console.error("JSON Parse Error:", jsonText);
            throw new Error("Failed to parse AI response.");
        }

        // Apply to UI
        state.question = result.question || promptText;
        document.getElementById('display-question').textContent = state.question;
        
        const container = document.getElementById('options-container');
        container.innerHTML = '';
        state.options = []; // reset
        
        if (result.options && result.options.length > 0) {
            result.options.forEach(opt => addOptionCard(opt));
        } else {
            addOptionCard(); addOptionCard();
        }

        // Alternative
        const altBox = document.getElementById('ai-alternative-box');
        const altBtn = document.getElementById('btn-add-alternative');
        if (result.alternative && result.alternative.show && result.alternative.option) {
            state.aiAlternative = result.alternative.option;
            document.getElementById('ai-alternative-text').textContent = result.alternative.suggestionText;
            altBox.classList.remove('hidden');
            altBtn.disabled = false;
            altBtn.innerHTML = '<i class="fa-solid fa-plus"></i> Add this as an option';
        } else {
            altBox.classList.add('hidden');
            state.aiAlternative = null;
        }

        switchView('options');

    } catch (error) {
        console.error(error);
        alert("Error analyzing with AI. Check your API key or try again. Falling back to manual mode.");
        
        // Fallback manual mode
        document.getElementById('display-question').textContent = state.question;
        document.getElementById('ai-alternative-box').classList.add('hidden');
        document.getElementById('options-container').innerHTML = '';
        addOptionCard(); addOptionCard();
        switchView('options');
    }
}

// Option Card Management
function generateId() { return Math.random().toString(36).substr(2, 9); }

function addOptionCard(prefillData = null) {
    const template = document.getElementById('template-option');
    const clone = template.content.cloneNode(true);
    const card = clone.querySelector('.option-card');
    card.dataset.id = generateId();
    
    // UI Elements
    const nameInput = card.querySelector('.option-name-input');
    const scoreRange = card.querySelector('.option-score-range');
    const scoreDisplay = card.querySelector('.score-display-mini');
    const proList = card.querySelector('.pro-list');
    const conList = card.querySelector('.con-list');
    
    // Prefill if AI provided data
    if (prefillData) {
        nameInput.value = prefillData.name || '';
        scoreRange.value = prefillData.baseScore || 5;
        scoreDisplay.textContent = scoreRange.value;
        
        if (prefillData.pros) prefillData.pros.forEach(p => addListItem(proList, p, 'pro'));
        if (prefillData.cons) prefillData.cons.forEach(c => addListItem(conList, c, 'con'));
    }
    
    setupCardListeners(card, proList, conList, scoreRange, scoreDisplay);
    document.getElementById('options-container').appendChild(card);
}

function setupCardListeners(card, proList, conList, scoreRange, scoreDisplay) {
    // Remove
    card.querySelector('.btn-remove-option').addEventListener('click', () => {
        const container = document.getElementById('options-container');
        if (container.children.length <= 2) { alert('You need at least 2 options.'); return; }
        card.remove();
    });

    // Score
    scoreRange.addEventListener('input', (e) => { scoreDisplay.textContent = e.target.value; });

    // Pros
    const proInput = card.querySelector('.pro-input');
    const addProBtn = card.querySelector('.btn-add-pro');
    const handleAddPro = () => {
        if (!proInput.value.trim()) return;
        addListItem(proList, proInput.value.trim(), 'pro');
        proInput.value = '';
    };
    addProBtn.addEventListener('click', handleAddPro);
    proInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleAddPro(); });

    // Cons
    const conInput = card.querySelector('.con-input');
    const addConBtn = card.querySelector('.btn-add-con');
    const handleAddCon = () => {
        if (!conInput.value.trim()) return;
        addListItem(conList, conInput.value.trim(), 'con');
        conInput.value = '';
    };
    addConBtn.addEventListener('click', handleAddCon);
    conInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleAddCon(); });
}

function addListItem(container, text, type) {
    const div = document.createElement('div');
    div.className = 'list-item';
    div.innerHTML = `
        <span><i class="fa-solid fa-${type === 'pro' ? 'check text-success' : 'xmark text-danger'} scale-75"></i> ${text}</span>
        <button class="btn-icon" onclick="this.parentElement.remove()"><i class="fa-solid fa-trash-can"></i></button>
    `;
    container.appendChild(div);
}

function validateOptions(basic = false) {
    const cards = document.querySelectorAll('.option-card');
    if (cards.length < 2) { alert('Please add at least 2 options to compare.'); return false; }
    
    let isValid = true;
    cards.forEach(card => {
        if (!card.querySelector('.option-name-input').value.trim()) isValid = false;
    });
    
    if (!isValid) alert('Please provide names for all options.');
    return isValid;
}

function saveOptionsState() {
    state.options = [];
    document.querySelectorAll('.option-card').forEach(card => {
        const name = card.querySelector('.option-name-input').value.trim();
        const baseScore = parseInt(card.querySelector('.option-score-range').value) || 5;
        
        const pros = Array.from(card.querySelectorAll('.pro-list span')).map(el => el.textContent.trim());
        const cons = Array.from(card.querySelectorAll('.con-list span')).map(el => el.textContent.trim());
        
        // Simple heuristic calculation
        const proWeight = pros.length * 0.5;
        const conWeight = cons.length * 0.5;
        const finalScore = Math.min(10, Math.max(1, (baseScore + proWeight - conWeight).toFixed(1)));
        
        state.options.push({ id: card.dataset.id, name, baseScore, pros, cons, finalScore: parseFloat(finalScore) });
    });
}

// Logic: Analysis
function performAnalysis() {
    document.getElementById('analysis-question').textContent = state.question;
    const sorted = [...state.options].sort((a, b) => b.finalScore - a.finalScore);
    const best = sorted[0];
    
    document.getElementById('best-option-name').textContent = best.name;
    document.getElementById('best-option-score').textContent = best.finalScore;
    
    const table = document.getElementById('comparison-table');
    let html = `<thead><tr><th>Option</th><th>Strengths</th><th>Weaknesses</th><th>Score</th></tr></thead><tbody>`;
    
    sorted.forEach((opt, idx) => {
        const prosHtml = opt.pros.map(p => `<span class="tag-pro">${p}</span>`).join('');
        const consHtml = opt.cons.map(c => `<span class="tag-con">${c}</span>`).join('');
        const isWin = idx === 0;
        
        html += `
            <tr style="${isWin ? 'background: rgba(139, 92, 246, 0.1); border-left: 2px solid var(--primary-color);' : ''}">
                <td style="font-weight:700;">${opt.name} ${isWin ? '<i class="fa-solid fa-crown text-warning"></i>' : ''}</td>
                <td>${prosHtml || '<span style="color:var(--text-muted);font-style:italic">None</span>'}</td>
                <td>${consHtml || '<span style="color:var(--text-muted);font-style:italic">None</span>'}</td>
                <td style="font-weight:bold;color:${opt.finalScore >= 6 ? 'var(--success-color)' : 'var(--danger-color)'}">${opt.finalScore}</td>
            </tr>
        `;
    });
    html += '</tbody>';
    table.innerHTML = html;
}

// Logic: Wheel
let wheelSpinning = false, wheelRotation = 0;
function setupWheel() {
    const canvas = document.getElementById('canvas-wheel');
    const ctx = canvas.getContext('2d');
    const size = canvas.width;
    const radius = size / 2;
    
    ctx.clearRect(0, 0, size, size);
    if (state.options.length === 0) return;
    
    const arc = (2 * Math.PI) / state.options.length;
    
    state.options.forEach((opt, i) => {
        const angle = i * arc;
        ctx.beginPath();
        ctx.fillStyle = state.wheelColors[i % state.wheelColors.length];
        ctx.moveTo(radius, radius);
        ctx.arc(radius, radius, radius, angle, angle + arc);
        ctx.lineTo(radius, radius);
        ctx.fill();
        
        // Add minimal shadow for depth
        ctx.shadowColor = 'rgba(0,0,0,0.3)';
        ctx.shadowBlur = 5;
        
        // Text
        ctx.save();
        ctx.translate(radius, radius);
        ctx.rotate(angle + arc / 2);
        ctx.textAlign = "right";
        ctx.fillStyle = "#fff";
        ctx.font = "bold 18px Outfit";
        ctx.shadowBlur = 0; // Remove text shadow for clarity
        const text = opt.name.length > 12 ? opt.name.substring(0, 10) + "..." : opt.name;
        ctx.fillText(text, radius - 15, 6);
        ctx.restore();
    });
    
    document.getElementById('wheel-result').classList.add('hidden');
    canvas.style.transform = `rotate(0deg)`;
    canvas.style.transition = 'none';
    wheelRotation = 0;
}

function spinWheel() {
    if (wheelSpinning || state.options.length === 0) return;
    wheelSpinning = true;
    
    document.getElementById('wheel-result').classList.add('hidden');
    const canvas = document.getElementById('canvas-wheel');
    
    const extra = Math.floor(Math.random() * 360);
    const totalRotation = (360 * 6) + extra;
    wheelRotation += totalRotation;
    
    canvas.style.transition = 'transform 3.5s cubic-bezier(0.15, 0.85, 0.35, 1)';
    canvas.style.transform = `rotate(${wheelRotation}deg)`;
    
    setTimeout(() => {
        wheelSpinning = false;
        
        const deg = wheelRotation % 360;
        // The pointer is at top (-90 deg from standard canvas 0 deg)
        // Adjust for rotation and find correct segment
        const segmentSize = 360 / state.options.length;
        const normalizedPointer = (360 - deg + 270) % 360; 
        const winIdx = Math.floor(normalizedPointer / segmentSize);
        
        const winner = state.options[winIdx];
        document.getElementById('wheel-winner').textContent = winner.name;
        const res = document.getElementById('wheel-result');
        res.classList.remove('hidden');
        res.classList.remove('zoom-in');
        void res.offsetWidth;
        res.classList.add('zoom-in');
        
    }, 3550);
}

// Logic: History
function saveDecisionToHistory() {
    if (state.options.length === 0) return;
    const sorted = [...state.options].sort((a, b) => b.finalScore - a.finalScore);
    const entry = {
        id: generateId(),
        question: state.question || "Manual Decision",
        winner: sorted[0].name,
        date: new Date().toISOString()
    };
    state.history.unshift(entry);
    if (state.history.length > 30) state.history.pop();
    localStorage.setItem('decision_history', JSON.stringify(state.history));
}

function renderHistory() {
    const list = document.getElementById('history-list');
    const empty = document.getElementById('empty-history');
    list.innerHTML = '';
    
    if (state.history.length === 0) {
        empty.classList.remove('hidden');
        return;
    }
    empty.classList.add('hidden');
    
    state.history.forEach(item => {
        const d = new Date(item.date).toLocaleDateString(undefined, { year:'numeric', month:'short', day:'numeric' });
        const el = document.createElement('div');
        el.className = 'history-card slide-up';
        el.innerHTML = `
            <div>
                <div class="hist-q">${item.question}</div>
                <div class="hist-w"><i class="fa-solid fa-crown text-warning"></i> Winner: ${item.winner}</div>
                <span class="hist-d">${d}</span>
            </div>
            <button class="btn-icon ext-danger" onclick="deleteHistory('${item.id}')"><i class="fa-solid fa-trash-can"></i></button>
        `;
        list.appendChild(el);
    });
}

window.deleteHistory = function(id) {
    state.history = state.history.filter(h => h.id !== id);
    localStorage.setItem('decision_history', JSON.stringify(state.history));
    renderHistory();
};

// Logic: Theme
function setupThemeToggle() {
    const btn = document.getElementById('btn-theme-toggle');
    const icon = btn.querySelector('i');
    
    const saved = localStorage.getItem('decision_theme');
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = saved === 'dark' || (!saved && systemDark);
    
    if (isDark) {
        document.body.classList.replace('light-mode', 'dark-mode');
        icon.classList.replace('fa-moon', 'fa-sun');
    } else {
        document.body.classList.replace('dark-mode', 'light-mode');
        icon.classList.replace('fa-sun', 'fa-moon');
    }
    
    btn.addEventListener('click', () => {
        if (document.body.classList.contains('light-mode')) {
            document.body.classList.replace('light-mode', 'dark-mode');
            icon.classList.replace('fa-moon', 'fa-sun');
            localStorage.setItem('decision_theme', 'dark');
        } else {
            document.body.classList.replace('dark-mode', 'light-mode');
            icon.classList.replace('fa-sun', 'fa-moon');
            localStorage.setItem('decision_theme', 'light');
        }
        if (state.currentView === 'wheel') setupWheel();
    });
}
