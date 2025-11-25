// Configuration
let config = {
    sheetUrl: '',
    pollInterval: 30,
    qrUrl: '',
    title: '',
    nameColumn: '',
    questionColumn: ''
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
    const sheetEl = document.getElementById('sheet-url');
    if (sheetEl) sheetEl.value = config.sheetUrl || '';

    const pollElInit = document.getElementById('poll-interval');
    if (pollElInit) pollElInit.value = String(config.pollInterval || 30);

    const qrElInit = document.getElementById('qr-url');
    if (qrElInit) qrElInit.value = config.qrUrl || '';

    const nameSel = document.getElementById('name-column');
    const questionSel = document.getElementById('question-column');
    if (nameSel && config.nameColumn) nameSel.value = config.nameColumn;
    if (questionSel && config.questionColumn) questionSel.value = config.questionColumn;

    const headerTitle = document.querySelector('header h1');
    const titleInput = document.getElementById('app-title');
    if (titleInput) titleInput.value = config.title || (headerTitle ? headerTitle.textContent : '') || '';
    if (config.title && headerTitle) headerTitle.textContent = config.title;
}

// Save config to localStorage
function saveConfig() {
    let url = (document.getElementById('sheet-url')?.value || '').trim();
    // Auto-convert shareable link to CSV export URL
    if (url.includes('/edit?usp=sharing')) {
        url = url.replace('/edit?usp=sharing', '/export?format=csv');
        document.getElementById('sheet-url').value = url;
    }
    const pollEl = document.getElementById('poll-interval');
    const qrEl = document.getElementById('qr-url');
    const oldUrl = (config.sheetUrl || '').trim();
    config.sheetUrl = url;
    config.pollInterval = Math.max(
        5,
        parseInt(pollEl && pollEl.value ? pollEl.value : (config.pollInterval || 30)) || 30
    );
    config.qrUrl = qrEl && typeof qrEl.value === 'string' ? qrEl.value : '';
    // Save selected columns if present
    const nameSelSave = document.getElementById('name-column');
    const questionSelSave = document.getElementById('question-column');
    if (nameSelSave && nameSelSave.value) config.nameColumn = nameSelSave.value;
    if (questionSelSave && questionSelSave.value) config.questionColumn = questionSelSave.value;

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
    if (oldUrl !== config.sheetUrl) {
        clearColumnMapping();
        clearQuestionsDisplay();
    }
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
    if (!rows.length) return;

    // Determine header mapping
    const header = rows[0].map(h => h.replace(/^"|"$/g, ''));
    const headerLower = header.map(h => h.trim().toLowerCase());

    let nameIdx = -1;
    let questionIdx = -1;

    // If configuration specifies explicit columns, use them
    if (config.nameColumn) {
        nameIdx = header.indexOf(config.nameColumn);
    }
    if (config.questionColumn) {
        questionIdx = header.indexOf(config.questionColumn);
    }

    // Fallback: try to guess columns by common names
    if (nameIdx === -1) {
        nameIdx = headerLower.findIndex(h => h === 'name' || h.includes('name') || h.includes('submitter'));
    }
    if (questionIdx === -1) {
        questionIdx = headerLower.findIndex(h => h === 'question' || h.includes('question') || h.includes('ask'));
    }

    // Last fallback: default to second and third column if available
    if (nameIdx === -1 && header.length > 1) nameIdx = 1;
    if (questionIdx === -1 && header.length > 2) questionIdx = 2;

    for (let r = 1; r < rows.length; r++) { // skip header
        const row = rows[r];
        if (!row || row.length === 0) continue;
        const rawName = nameIdx >= 0 && nameIdx < row.length ? row[nameIdx] : '';
        const rawQuestion = questionIdx >= 0 && questionIdx < row.length ? row[questionIdx] : '';
        const name = (rawName || '').replace(/^"|"$/g, '').trim();
        const question = (rawQuestion || '').replace(/^"|"$/g, '').trim();
        if (name && question) {
            questions.push({ name, question });
        }
    }
}

function clearColumnMapping() {
    config.nameColumn = '';
    config.questionColumn = '';
    const nameSel = document.getElementById('name-column');
    const questionSel = document.getElementById('question-column');
    if (nameSel) {
        nameSel.innerHTML = '';
        nameSel.value = '';
    }
    if (questionSel) {
        questionSel.innerHTML = '';
        questionSel.value = '';
    }
}

/**
 * Clear all currently loaded questions and reset UI.
 * Used when the source CSV URL changes or is removed.
 */
function clearQuestionsDisplay() {
    questions = [];
    activeIndices = [];
    currentActiveIndex = -1;
    const container = document.getElementById('questions-container');
    if (container) container.innerHTML = '';
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
    const modal = document.getElementById('config-modal');
    if (modal) modal.style.display = 'flex';
    // Populate header-based mapping whenever the modal opens
    fetchHeadersAndPopulate();
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
    if (!config.sheetUrl) {
        // No source configured: ensure UI shows no stale questions and stop polling
        return;
    }
    fetchQuestions();
    pollTimer = setInterval(fetchQuestions, config.pollInterval * 1000);
}

/**
 * Fetch headers from the CSV URL and populate the mapping selects.
 * Auto-select likely defaults (Name/Question) if found.
 */
async function fetchHeadersAndPopulate() {
    const url = (document.getElementById('sheet-url')?.value || '').trim();
    const nameSel = document.getElementById('name-column');
    const questionSel = document.getElementById('question-column');
    if (!url || !nameSel || !questionSel) return;

    try {
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) throw new Error('Failed to fetch CSV for headers');
        const text = await res.text();
        // Get first line
        const firstNewline = text.indexOf('\n');
        const headerLine = firstNewline >= 0 ? text.slice(0, firstNewline) : text;
        const headers = parseCSVLine(headerLine).map(h => h.replace(/^"|"$/g, ''));

        // Populate selects
        nameSel.innerHTML = '';
        questionSel.innerHTML = '';
        headers.forEach(h => {
            const opt1 = document.createElement('option');
            opt1.value = h;
            opt1.textContent = h;
            nameSel.appendChild(opt1);

            const opt2 = document.createElement('option');
            opt2.value = h;
            opt2.textContent = h;
            questionSel.appendChild(opt2);
        });

        // Try to auto-select reasonable defaults
        const lower = headers.map(h => h.trim().toLowerCase());
        const guessName =
            lower.findIndex(h => h === 'name' || h.includes('name') || h.includes('submitter'));
        const guessQuestion =
            lower.findIndex(h => h === 'question' || h.includes('question') || h.includes('ask'));

        if (config.nameColumn && headers.includes(config.nameColumn)) {
            nameSel.value = config.nameColumn;
        } else if (guessName >= 0) {
            nameSel.value = headers[guessName];
        }

        if (config.questionColumn && headers.includes(config.questionColumn)) {
            questionSel.value = config.questionColumn;
        } else if (guessQuestion >= 0) {
            questionSel.value = headers[guessQuestion];
        }
    } catch (e) {
        console.error('Failed to load headers:', e);
        // Leave selects untouched if fetch fails
    }
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
    // When the sheet URL changes or loses focus, try to load headers
    const sheetUrlInput = document.getElementById('sheet-url');
    if (sheetUrlInput) {
        sheetUrlInput.addEventListener('change', () => {
            const newUrl = (sheetUrlInput.value || '').trim();
            if (!newUrl || newUrl !== (config.sheetUrl || '').trim()) {
                clearColumnMapping();
                clearQuestionsDisplay();
            }
            fetchHeadersAndPopulate();
        });
        sheetUrlInput.addEventListener('blur', () => {
            const newUrl = (sheetUrlInput.value || '').trim();
            if (!newUrl || newUrl !== (config.sheetUrl || '').trim()) {
                clearColumnMapping();
                clearQuestionsDisplay();
            }
            fetchHeadersAndPopulate();
        });
    }
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
    if (config.sheetUrl) {
        fetchHeadersAndPopulate();
        startPolling();
    }
    updateQRCode();
});
