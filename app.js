// Configuration
let config = {
    sheetUrl: '',
    pollInterval: 30
};

// Done questions
let doneQuestions = [];

// Load config from localStorage
function loadConfig() {
    const saved = localStorage.getItem('townHallConfig');
    if (saved) {
        config = JSON.parse(saved);
    }
    const done = localStorage.getItem('doneQuestions');
    if (done) {
        doneQuestions = JSON.parse(done);
    }
    document.getElementById('sheet-url').value = config.sheetUrl;
    document.getElementById('poll-interval').value = config.pollInterval;
}

// Save config to localStorage
function saveConfig() {
    let url = document.getElementById('sheet-url').value;
    // Auto-convert shareable link to CSV export URL
    if (url.includes('/edit?usp=sharing')) {
        url = url.replace('/edit?usp=sharing', '/export?format=csv');
        document.getElementById('sheet-url').value = url;
    }
    config.sheetUrl = url;
    config.pollInterval = parseInt(document.getElementById('poll-interval').value);
    localStorage.setItem('townHallConfig', JSON.stringify(config));
    console.log('Config saved:', config);
    hideConfigModal();
    startPolling();
}

// Questions data
let questions = [];
let activeIndices = [];
let currentActiveIndex = -1;

// Fetch and parse CSV
async function fetchQuestions() {
    if (!config.sheetUrl) return;
    try {
        const response = await fetch(config.sheetUrl);
        if (!response.ok) throw new Error('Failed to fetch');
        const csvText = await response.text();
        parseCSV(csvText);
        displayQuestions();
    } catch (error) {
        console.error('Error fetching questions:', error);
    }
}

// Parse a single CSV line respecting quotes
function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
                current += '"';
                i++; // skip next quote
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current.trim());
    return result;
}

// Full CSV parser that preserves newlines in quoted fields
function parseCSV(csvText) {
    const rows = [];
    let currentRow = [];
    let currentField = '';
    let inQuotes = false;
    let i = 0;
    while (i < csvText.length) {
        const char = csvText[i];
        if (char === '"') {
            if (inQuotes && i + 1 < csvText.length && csvText[i + 1] === '"') {
                currentField += '"';
                i += 2;
                continue;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            currentRow.push(currentField);
            currentField = '';
        } else if (char === '\n' && !inQuotes) {
            currentRow.push(currentField);
            if (currentRow.length > 0) {
                rows.push(currentRow);
            }
            currentRow = [];
            currentField = '';
        } else {
            currentField += char;
        }
        i++;
    }
    if (currentField || currentRow.length) {
        currentRow.push(currentField);
        rows.push(currentRow);
    }

    questions = [];
    for (let r = 1; r < rows.length; r++) { // skip header
        const row = rows[r];
        if (row && row.length >= 3) {
            const name = row[1].replace(/^"|"$/g, '');
            const question = row[2].replace(/^"|"$/g, '');
            if (name && question) {
                questions.push({ name: name, question: question });
            }
        }
    }
}

// Display questions
function displayQuestions() {
    activeIndices = [];
    const container = document.getElementById('questions-container');
    container.innerHTML = '';
    questions.forEach((q, index) => {
        if (doneQuestions.includes(q.question)) return;
        activeIndices.push(index);
        const box = document.createElement('div');
        box.className = 'question-box';
        box.innerHTML = `
            <div class="submitter">${q.name}</div>
            <div class="question-preview">${q.question.substring(0, 100)}${q.question.length > 100 ? '...' : ''}</div>
        `;
        box.addEventListener('click', () => {
            console.log('Clicked question', index, questions[index]);
            showExpandedQuestion(index);
        });
        container.appendChild(box);
    });
}

// Show expanded question
function showExpandedQuestion(index) {
    const q = questions[index];
    document.getElementById('submitter-name').textContent = "--" + q.name;
    document.getElementById('full-question').textContent = '"' + q.question + '"';
    currentActiveIndex = activeIndices.indexOf(index);
    updateNavButtons();
    document.getElementById('expanded-question').style.display = 'flex';
}

// Update navigation buttons
function updateNavButtons() {
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    prevBtn.disabled = currentActiveIndex <= 0;
    nextBtn.disabled = currentActiveIndex >= activeIndices.length - 1;
}

// Hide expanded question
function hideExpandedQuestion() {
    document.getElementById('expanded-question').style.display = 'none';
}

// Mark question as done
function markAsDone() {
    const question = document.getElementById('full-question').textContent.replace(/^"|"$/g, '');
    if (!doneQuestions.includes(question)) {
        doneQuestions.push(question);
        localStorage.setItem('doneQuestions', JSON.stringify(doneQuestions));
    }
    hideExpandedQuestion();
    displayQuestions();
}

// Clear all done questions
function clearDone() {
    doneQuestions = [];
    localStorage.setItem('doneQuestions', JSON.stringify(doneQuestions));
    displayQuestions();
}

// Config modal
function showConfigModal() {
    document.getElementById('config-modal').style.display = 'flex';
}

function hideConfigModal() {
    const modal = document.getElementById('config-modal');
    console.log('Hiding modal:', modal);
    modal.style.display = 'none';
}

// Polling
let pollTimer;

function startPolling() {
    clearInterval(pollTimer);
    fetchQuestions();
    pollTimer = setInterval(fetchQuestions, config.pollInterval * 1000);
}

// Event listeners
window.addEventListener('DOMContentLoaded', () => {
    // Initially hide modals
    document.getElementById('expanded-question').style.display = 'none';
    document.getElementById('config-modal').style.display = 'none';

    document.getElementById('config-btn').addEventListener('click', showConfigModal);
    document.getElementById('save-config').addEventListener('click', saveConfig);
    document.getElementById('cancel-config').addEventListener('click', hideConfigModal);
    document.getElementById('clear-done').addEventListener('click', clearDone);
    document.getElementById('close-btn').addEventListener('click', hideExpandedQuestion);
    document.getElementById('mark-done-btn').addEventListener('click', markAsDone);
    document.getElementById('prev-btn').addEventListener('click', () => {
        if (currentActiveIndex > 0) {
            showExpandedQuestion(activeIndices[--currentActiveIndex]);
        }
    });
    document.getElementById('next-btn').addEventListener('click', () => {
        if (currentActiveIndex < activeIndices.length - 1) {
            showExpandedQuestion(activeIndices[++currentActiveIndex]);
        }
    });

    // Initialize
    loadConfig();
    if (config.sheetUrl) {
        startPolling();
    }
});
