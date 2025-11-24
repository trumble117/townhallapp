// Configuration
let config = {
    sheetUrl: '',
    pollInterval: 30,
    qrUrl: '',
    title: ''
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
    document.getElementById('qr-url').value = config.qrUrl;
    const headerTitle = document.querySelector('header h1');
    const titleInput = document.getElementById('app-title');
    if (titleInput) titleInput.value = config.title || headerTitle?.textContent || '';
    if (config.title && headerTitle) headerTitle.textContent = config.title;
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
    config.qrUrl = document.getElementById('qr-url').value;
    const newTitle = (document.getElementById('app-title')?.value || '').trim();
    if (newTitle) {
        config.title = newTitle;
        const headerTitle = document.querySelector('header h1');
        if (headerTitle) headerTitle.textContent = newTitle;
    }
    localStorage.setItem('townHallConfig', JSON.stringify(config));
    console.log('Config saved:', config);
    updateQRCode();
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
    updateExpandedFields(index);
    currentActiveIndex = activeIndices.indexOf(index);
    updateNavButtons();
    const overlay = document.getElementById('expanded-question');
    overlay.classList.add('open');
}

// Update navigation buttons
function updateNavButtons() {
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    const single = activeIndices.length <= 1;
    if (prevBtn) prevBtn.disabled = single;
    if (nextBtn) nextBtn.disabled = single;
}

// Sliding transition helpers
function updateExpandedFields(index) {
    const q = questions[index];
    const nameEl = document.getElementById('submitter-name');
    const questionEl = document.getElementById('full-question');
    if (nameEl) nameEl.textContent = "--" + q.name;
    if (questionEl) questionEl.textContent = '"' + q.question + '"';
}

function slideToIndex(targetAbsIndex, direction) {
    const block = document.querySelector('#expanded-content blockquote');
    if (!block) {
        // Fallback if element not found
        updateExpandedFields(targetAbsIndex);
        return;
    }

    // Determine outgoing animation class
    const outClass = direction === 'left' ? 'slide-out-right' : 'slide-out-left';
    const inClass = direction === 'left' ? 'slide-in-left' : 'slide-in-right';

    // Remove any residual classes
    block.classList.remove('slide-out-left', 'slide-out-right', 'slide-in-left', 'slide-in-right');

    // Animate current content out
    block.classList.add(outClass);

    const handleOutEnd = () => {
        block.removeEventListener('animationend', handleOutEnd);
        // Update to new content
        updateExpandedFields(targetAbsIndex);
        // Animate new content in
        block.classList.remove(outClass);
        block.classList.add(inClass);

        const handleInEnd = () => {
            block.classList.remove(inClass);
            block.removeEventListener('animationend', handleInEnd);
        };
        block.addEventListener('animationend', handleInEnd, { once: true });
    };

    block.addEventListener('animationend', handleOutEnd, { once: true });
}

// Navigation helpers with wrap-around cycling
function goPrev() {
    if (!activeIndices.length) return;
    const overlayOpen = document.getElementById('expanded-question')?.classList.contains('open');
    // Compute next active index (wrap-around)
    let nextActiveIdx = currentActiveIndex <= 0 ? activeIndices.length - 1 : currentActiveIndex - 1;
    const targetAbsIndex = activeIndices[nextActiveIdx];

    if (overlayOpen) {
        slideToIndex(targetAbsIndex, 'left');
        currentActiveIndex = nextActiveIdx;
    } else {
        showExpandedQuestion(targetAbsIndex);
    }
}

function goNext() {
    if (!activeIndices.length) return;
    const overlayOpen = document.getElementById('expanded-question')?.classList.contains('open');
    // Compute next active index (wrap-around)
    let nextActiveIdx = currentActiveIndex >= activeIndices.length - 1 ? 0 : currentActiveIndex + 1;
    const targetAbsIndex = activeIndices[nextActiveIdx];

    if (overlayOpen) {
        slideToIndex(targetAbsIndex, 'right');
        currentActiveIndex = nextActiveIdx;
    } else {
        showExpandedQuestion(targetAbsIndex);
    }
}

// Hide expanded question
function hideExpandedQuestion() {
    const overlay = document.getElementById('expanded-question');
    overlay.classList.remove('open');
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

// Update QR code display
function updateQRCode() {
    const qrContainer = document.getElementById('qr-code');
    const qrImage = document.getElementById('qr-image');

    // Safeguard if elements are not yet in the DOM
    if (!qrContainer || !qrImage) {
        return;
    }

    const url = (config.qrUrl || '').trim();
    if (url) {
        qrImage.src = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(url)}`;
        qrContainer.classList.remove('qr-hidden');
    } else {
        qrContainer.classList.add('qr-hidden');
        qrImage.removeAttribute('src');
    }
}

// Event listeners
window.addEventListener('DOMContentLoaded', () => {
    // Initially hide modals
    document.getElementById('expanded-question').classList.remove('open');
    document.getElementById('config-modal').style.display = 'none';

    document.getElementById('config-btn').addEventListener('click', showConfigModal);
    document.getElementById('save-config').addEventListener('click', saveConfig);
    document.getElementById('cancel-config').addEventListener('click', hideConfigModal);
    document.getElementById('clear-done').addEventListener('click', clearDone);
    document.getElementById('close-btn').addEventListener('click', hideExpandedQuestion);
    document.getElementById('mark-done-btn').addEventListener('click', markAsDone);
    document.getElementById('prev-btn').addEventListener('click', () => {
        goPrev();
    });
    document.getElementById('next-btn').addEventListener('click', () => {
        goNext();
    });

    // Keyboard shortcuts: Esc closes modal, arrows cycle questions
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            hideExpandedQuestion();
        } else if (e.key === 'ArrowLeft') {
            // Only cycle when expanded view is open
            if (document.getElementById('expanded-question').classList.contains('open')) {
                goPrev();
            }
        } else if (e.key === 'ArrowRight') {
            if (document.getElementById('expanded-question').classList.contains('open')) {
                goNext();
            }
        }
    });

    // Initialize
    loadConfig();
    updateQRCode();
    if (config.sheetUrl) {
        startPolling();
    }
});
