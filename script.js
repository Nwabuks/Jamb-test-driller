// ================ JAMB APP STATE ================
const JAMB_APP = {
    // All possible JAMB subjects
    allSubjects: {
        english: { name: "English Language", icon: "language", compulsory: false },
        mathematics: { name: "Mathematics", icon: "calculator" },
        physics: { name: "Physics", icon: "atom" },
        chemistry: { name: "Chemistry", icon: "vial" },
        biology: { name: "Biology", icon: "dna" },
        government: { name: "Government", icon: "landmark" },
        commerce: { name: "Commerce", icon: "shopping-cart" },
        accounting: { name: "Accounting", icon: "file-invoice-dollar" },
        economics: { name: "Economics", icon: "chart-line" },
        literature: { name: "Literature", icon: "book" }
    },
    // User's selected subjects (max 4)
    selectedSubjects: [],
    // Question bank for all subjects (organized by topic)
    questions: {},
    // Topics system
    topics: {}, // Will store {subject: {topic1: [questions], topic2: [questions]}}
    selectedTopics: {}, // {subject: [selectedTopics]}
    
    // Settings
    settings: {
        timer: {
            enabled: true,
            minutes: 120,
            customTime: 0
        },
        questions: {
            mode: 'default', // 'default' or 'custom'
            perSubject: 20 // Only used when mode is 'custom'
        }
    },
    // Quiz state
    currentQuiz: null,
    // Timer interval
    timerInterval: null,
    // Results history
    results: [],
    // Constants
    MAX_QUESTIONS_PER_QUIZ: 100,  // Maximum questions per subject during quiz
    MAX_SUBJECTS: 4
};

// Chart instances
window.overallChart = null;
window.subjectChart = null;
window.radarChart = null;

// ================ APK SCROLLING FIXES ================
function fixAPKScrolling() {
    // Prevent default touch behavior that interferes with scrolling
    document.addEventListener('touchmove', function(e) {
        // Allow scrolling only on scrollable elements
        const isScrollable = e.target.closest('.tab-content') || 
                            e.target.closest('#quizContainer') ||
                            e.target.closest('.container');
        
        if (!isScrollable && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
            e.preventDefault();
        }
    }, { passive: false });
    
    // Fix for iOS elastic scrolling
    document.addEventListener('touchstart', function(e) {
        const isScrollable = e.target.closest('.tab-content') || 
                            e.target.closest('#quizContainer') ||
                            e.target.closest('.container');
        
        if (isScrollable) {
            // Store the initial touch position
            this.initialY = e.touches[0].clientY;
            this.initialScrollTop = isScrollable.scrollTop;
        }
    });
    
    document.addEventListener('touchmove', function(e) {
        const scrollable = e.target.closest('.tab-content') || 
                          e.target.closest('#quizContainer') ||
                          e.target.closest('.container');
        
        if (scrollable) {
            const currentY = e.touches[0].clientY;
            const deltaY = currentY - this.initialY;
            
            // Check if we're at the top or bottom and trying to overscroll
            const isAtTop = scrollable.scrollTop === 0;
            const isAtBottom = scrollable.scrollTop + scrollable.clientHeight >= scrollable.scrollHeight - 1;
            
            if ((isAtTop && deltaY > 0) || (isAtBottom && deltaY < 0)) {
                e.preventDefault();
            }
        }
    }, { passive: false });
    
    // Fix for input focus causing layout issues
    const inputs = document.querySelectorAll('input, textarea, select');
    inputs.forEach(input => {
        input.addEventListener('focus', function() {
            // Scroll the input into view
            setTimeout(() => {
                this.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 300);
        });
    });
    
    // Fix for Android keyboard covering inputs
    window.addEventListener('resize', function() {
        const activeElement = document.activeElement;
        if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
            setTimeout(() => {
                activeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 100);
        }
    });
    
    console.log('APK scrolling fixes applied');
}
// ================ EXAM MODE FUNCTIONS ================
let examMode = false;
let pendingExamStart = null;

function enableExamMode() {
    examMode = true;
    document.body.classList.add('exam-mode');
    
    // Disable browser navigation
    window.onbeforeunload = function() {
        return "You are in the middle of a JAMB exam! Are you sure you want to leave?";
    };
    
    // Disable context menu (right-click)
    document.addEventListener('contextmenu', function(e) {
        e.preventDefault();
        showAlert('Right-click is disabled during exam', 'error');
    });
    
    // Disable keyboard shortcuts
    document.addEventListener('keydown', function(e) {
        // Disable F5 (refresh), Ctrl+R, Ctrl+Shift+R
        if (e.key === 'F5' || (e.ctrlKey && e.key === 'r') || (e.ctrlKey && e.shiftKey && e.key === 'R')) {
            e.preventDefault();
            showAlert('Refresh is disabled during exam', 'error');
        }
        // Disable F12 (dev tools)
        if (e.key === 'F12') {
            e.preventDefault();
            showAlert('Developer tools are disabled during exam', 'error');
        }
        // Disable Ctrl+P (print)
        if (e.ctrlKey && e.key === 'p') {
            e.preventDefault();
            showAlert('Print is disabled during exam', 'error');
        }
    });
    
    console.log('Exam mode enabled');
}

function disableExamMode() {
    examMode = false;
    document.body.classList.remove('exam-mode');
    
    // Re-enable browser navigation
    window.onbeforeunload = null;
    
    // Re-enable context menu
    document.removeEventListener('contextmenu', function(e) {
        e.preventDefault();
    });
    
    // Re-enable keyboard shortcuts
    document.removeEventListener('keydown', function(e) {
        // Remove keyboard restrictions
    });
    
    console.log('Exam mode disabled');
}

function showExamWarning() {
    const examWarning = document.getElementById('exam-warning');
    const examTimerDisplay = document.getElementById('exam-timer-display');
    
    // Display current timer settings with better formatting
    let timerText = '';
    if (JAMB_APP.settings.timer.enabled) {
        const minutes = JAMB_APP.settings.timer.minutes;
        if (minutes === 120) {
            timerText = '⏱️ 120 minutes (Real JAMB Timing)';
        } else {
            timerText = `⏱️ ${minutes} minutes (Custom Time)`;
        }
    } else {
        timerText = '⏱️ No Timer (Practice Mode)';
    }
    
    examTimerDisplay.innerHTML = timerText;
    
    examWarning.style.display = 'flex';
    examWarning.style.alignItems = 'flex-start';
    examWarning.style.padding = '20px 0';
    document.body.style.overflow = 'hidden';
    
    // Store the exam start function
    pendingExamStart = function() {
        enableExamMode();
        examWarning.style.display = 'none';
        document.body.style.overflow = '';
        startJAMBQuiz();
    };
}

function startExam() {
    if (pendingExamStart) {
        pendingExamStart();
        pendingExamStart = null;
    }
}

function cancelExam() {
    const examWarning = document.getElementById('exam-warning');
    examWarning.style.display = 'none';
    document.body.style.overflow = '';
    pendingExamStart = null;
}

// ================ UTILITY FUNCTIONS ================
function showAlert(message, type = 'info') {
    const alert = document.getElementById('alert');
    alert.textContent = message;
    alert.className = `alert ${type}`;
    alert.style.display = 'block';
    setTimeout(() => {
        alert.style.display = 'none';
    }, 5000);
}

function switchTab(tabName) {
    // Update tabs
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    // Show selected tab
    const tabIndex = { setup: 1, topics: 2, quiz: 3, results: 4 }[tabName];
    document.querySelector(`.tab:nth-child(${tabIndex})`).classList.add('active');
    document.getElementById(`tab-${tabName}`).classList.add('active');
    
    // Clean up charts if leaving results tab
    if (tabName !== 'results') {
        if (window.overallChart && typeof window.overallChart.destroy === 'function') {
            window.overallChart.destroy();
            window.overallChart = null;
        }
        if (window.subjectChart && typeof window.subjectChart.destroy === 'function') {
            window.subjectChart.destroy();
            window.subjectChart = null;
        }
        if (window.radarChart && typeof window.radarChart.destroy === 'function') {
            window.radarChart.destroy();
            window.radarChart = null;
        }
    }
    
    // Update UI based on tab
    if (tabName === 'topics') {
        updateTopicsTab();
    } else if (tabName === 'quiz') {
        updateQuizTab();
    } else if (tabName === 'results') {
        updateResultsTab();
    }
}

// ================ SETTINGS FUNCTIONS ================
function setupSettingsListeners() {
    // Timer settings
    const timerOptions = document.querySelectorAll('input[name="timer"]');
    const customTimeInput = document.getElementById('custom-time-input');
    
    // Show/hide custom time input based on selection
    timerOptions.forEach(option => {
        option.addEventListener('change', function() {
            updateTimerSettingsUI();
            updateTimerSettings();
        });
    });
    
    const customMinutes = document.getElementById('custom-minutes');
    if (customMinutes) {
        customMinutes.addEventListener('input', updateTimerSettings);
    }
    
    // Question settings
    const questionOptions = document.querySelectorAll('input[name="questionMode"]');
    const customQuestionsInput = document.getElementById('custom-questions-input');
    const questionsPerSubject = document.getElementById('questions-per-subject');
    
    // Show/hide custom questions input based on selection
    questionOptions.forEach(option => {
        option.addEventListener('change', function() {
            updateQuestionSettingsUI();
            updateQuestionSettings();
        });
    });
    
    if (questionsPerSubject) {
        questionsPerSubject.addEventListener('input', updateQuestionSettings);
    }
    
    // Initialize UI
    updateTimerSettingsUI();
    updateQuestionSettingsUI();
}

function updateTimerSettings() {
    const selectedTimer = document.querySelector('input[name="timer"]:checked');
    if (!selectedTimer) return;
    if (selectedTimer.value === 'custom') {
        const customMinutes = document.getElementById('custom-minutes');
        JAMB_APP.settings.timer.minutes = parseInt(customMinutes.value) || 60;
        JAMB_APP.settings.timer.enabled = true;
    } else if (selectedTimer.value === '0') {
        JAMB_APP.settings.timer.enabled = false;
    } else {
        JAMB_APP.settings.timer.minutes = parseInt(selectedTimer.value);
        JAMB_APP.settings.timer.enabled = true;
    }
    saveToStorage();
}

function updateQuestionSettings() {
    const selectedMode = document.querySelector('input[name="questionMode"]:checked');
    if (!selectedMode) return;
    JAMB_APP.settings.questions.mode = selectedMode.value;
    if (selectedMode.value === 'custom') {
        const questionsPerSubject = document.getElementById('questions-per-subject');
        JAMB_APP.settings.questions.perSubject = parseInt(questionsPerSubject.value) || 20;
        saveToStorage();
    }
}

// ================ TIMER FUNCTIONS ================
function startQuizTimer(totalSeconds) {
    if (!JAMB_APP.settings.timer.enabled) return;
    if (JAMB_APP.timerInterval) {
        clearInterval(JAMB_APP.timerInterval);
    }
    let remainingSeconds = totalSeconds;
    JAMB_APP.currentQuiz.remainingTime = remainingSeconds;
    JAMB_APP.timerInterval = setInterval(() => {
        remainingSeconds--;
        JAMB_APP.currentQuiz.remainingTime = remainingSeconds;
        if (remainingSeconds <= 0) {
            endTimer();
            showAlert('Time is up! Quiz will be submitted automatically.', 'error');
            endQuiz();
        }
        updateTimerDisplay();
    }, 1000);
    updateTimerDisplay();
}

function updateTimerDisplay() {
    const timerDisplay = document.getElementById('timer-display');
    if (!timerDisplay) return;
    const remainingSeconds = JAMB_APP.currentQuiz?.remainingTime || 0;
    if (remainingSeconds <= 0) {
        timerDisplay.innerHTML = `<i class="fas fa-hourglass-end"></i> Time's Up!`;
        return;
    }
    const hours = Math.floor(remainingSeconds / 3600);
    const minutes = Math.floor((remainingSeconds % 3600) / 60);
    const seconds = remainingSeconds % 60;
    let timeString = '';
    if (hours > 0) {
        timeString += `${hours.toString().padStart(2, '0')}:`;
    }
    timeString += `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    let timerClass = '';
    if (remainingSeconds < 300) {
        timerClass = 'timer-critical';
    } else if (remainingSeconds < 600) {
        timerClass = 'timer-warning';
    }
    timerDisplay.innerHTML = `<i class="fas fa-clock"></i> ${timeString}`;
    timerDisplay.className = `timer-display ${timerClass}`;
}

function endTimer() {
    if (JAMB_APP.timerInterval) {
        clearInterval(JAMB_APP.timerInterval);
        JAMB_APP.timerInterval = null;
    }
}

function formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

// ================ STORAGE FUNCTIONS ================
function saveToStorage() {
    try {
        const data = {
            selectedSubjects: JAMB_APP.selectedSubjects,
            questions: JAMB_APP.questions,
            topics: JAMB_APP.topics,
            selectedTopics: JAMB_APP.selectedTopics,
            settings: JAMB_APP.settings,
            results: JAMB_APP.results
        };
        localStorage.setItem('jamb_app_v5', JSON.stringify(data));
        console.log('Data saved to storage');
    } catch (e) {
        console.error('Save error:', e);
        showAlert('Error saving data', 'error');
    }
}

function loadFromStorage() {
    try {
        const saved = localStorage.getItem('jamb_app_v5');
        if (saved) {
            const data = JSON.parse(saved);
            JAMB_APP.selectedSubjects = data.selectedSubjects || [];
            JAMB_APP.questions = data.questions || {};
            JAMB_APP.topics = data.topics || {};
            JAMB_APP.selectedTopics = data.selectedTopics || {};
            JAMB_APP.settings = data.settings || {
                timer: { enabled: true, minutes: 120 },
                questions: { mode: 'default', perSubject: 20 }
            };
            JAMB_APP.results = data.results || [];
            
            console.log('Data loaded from storage');
            updateSetupUI();
            updateQuizTab();
            updateSettingsUI();
            return true;
        } else {
            console.log('No saved data found');
            return false;
        }
    } catch (e) {
        console.error('Load error:', e);
        // Initialize empty arrays for all subjects
        Object.keys(JAMB_APP.allSubjects).forEach(subject => {
            JAMB_APP.questions[subject] = [];
        });
        return false;
    }
}

function updateSettingsUI() {
    if (!JAMB_APP.settings.timer.enabled) {
        document.getElementById('timer-none').checked = true;
    } else if (JAMB_APP.settings.timer.minutes === 120) {
        document.getElementById('timer-jamb').checked = true;
    } else {
        document.getElementById('timer-custom').checked = true;
        const customMinutes = document.getElementById('custom-minutes');
        if (customMinutes) {
            customMinutes.value = JAMB_APP.settings.timer.minutes;
        }
    }
    if (document.getElementById(`questions-${JAMB_APP.settings.questions.mode}`)) {
        document.getElementById(`questions-${JAMB_APP.settings.questions.mode}`).checked = true;
    }
    const questionsPerSubject = document.getElementById('questions-per-subject');
    if (questionsPerSubject) {
        questionsPerSubject.value = JAMB_APP.settings.questions.perSubject;
    }
    updateTimerSettingsUI();
    updateQuestionSettingsUI();
    updateSelectedClasses();
}

function updateTimerSettingsUI() {
    const customTimeInput = document.getElementById('custom-time-input');
    const timerCustomRadio = document.getElementById('timer-custom');
    
    if (timerCustomRadio && timerCustomRadio.checked) {
        customTimeInput.style.display = 'block';
        // Set default value if empty
        const customMinutes = document.getElementById('custom-minutes');
        if (customMinutes && !customMinutes.value) {
            customMinutes.value = 60; // Default 60 minutes
        }
    } else {
        customTimeInput.style.display = 'none';
    }
}

function updateQuestionSettingsUI() {
    const customQuestionsInput = document.getElementById('custom-questions-input');
    const questionsCustomRadio = document.getElementById('questions-custom');
    
    if (questionsCustomRadio && questionsCustomRadio.checked) {
        customQuestionsInput.style.display = 'block';
        // Set default value if empty
        const questionsPerSubject = document.getElementById('questions-per-subject');
        if (questionsPerSubject && !questionsPerSubject.value) {
            questionsPerSubject.value = 20; // Default 20 questions
        }
    } else {
        customQuestionsInput.style.display = 'none';
    }
}

function updateSelectedClasses() {
    document.querySelectorAll('.timer-option').forEach(option => option.classList.remove('selected'));
    document.querySelectorAll('.question-option').forEach(option => option.classList.remove('selected'));
    const selectedTimer = document.querySelector('input[name="timer"]:checked');
    const selectedQuestionMode = document.querySelector('input[name="questionMode"]:checked');
    if (selectedTimer && selectedTimer.parentElement) {
        selectedTimer.parentElement.classList.add('selected');
    }
    if (selectedQuestionMode && selectedQuestionMode.parentElement) {
        selectedQuestionMode.parentElement.classList.add('selected');
    }
}

// ================ SETUP TAB FUNCTIONS ================
function updateSetupUI() {
    document.querySelectorAll('.subject-checkbox input').forEach(checkbox => {
        const subject = checkbox.value;
        const isSelected = JAMB_APP.selectedSubjects.includes(subject);
        checkbox.checked = isSelected;
        checkbox.parentElement.classList.toggle('selected', isSelected);
    });
    updateSelectedSubjectsDisplay();
}

function toggleSubject(subject) {
    const index = JAMB_APP.selectedSubjects.indexOf(subject);
    if (index === -1) {
        if (JAMB_APP.selectedSubjects.length < JAMB_APP.MAX_SUBJECTS) {
            JAMB_APP.selectedSubjects.push(subject);
            showAlert(`Added ${JAMB_APP.allSubjects[subject].name}`, 'success');
        } else {
            showAlert(`Maximum ${JAMB_APP.MAX_SUBJECTS} subjects allowed`, 'error');
            return;
        }
    } else {
        JAMB_APP.selectedSubjects.splice(index, 1);
        showAlert(`Removed ${JAMB_APP.allSubjects[subject].name}`, 'info');
    }
    updateSetupUI();
    saveToStorage();
}

function removeSubject(subject) {
    toggleSubject(subject);
}

function updateSelectedSubjectsDisplay() {
    const container = document.getElementById('selected-subjects');
    container.innerHTML = '';
    if (JAMB_APP.selectedSubjects.length === 0) {
        container.innerHTML = '<div style="color: #666; font-style: italic;">No subjects selected yet</div>';
        return;
    }
    JAMB_APP.selectedSubjects.forEach(subject => {
        const subjectInfo = JAMB_APP.allSubjects[subject];
        const tag = document.createElement('div');
        tag.className = 'selected-subject-tag';
        tag.innerHTML = `
            <i class="fas fa-${subjectInfo.icon}"></i> ${subjectInfo.name}
            <button class="remove-subject" onclick="removeSubject('${subject}')">
                <i class="fas fa-times"></i>
            </button>
        `;
        container.appendChild(tag);
    });
    const countDiv = document.createElement('div');
    countDiv.className = 'subject-limit';
    countDiv.innerHTML = `
        <span>Subjects selected:</span>
        <span class="limit-count ${JAMB_APP.selectedSubjects.length >= JAMB_APP.MAX_SUBJECTS ? 'limit-reached' : ''}">
            ${JAMB_APP.selectedSubjects.length}/${JAMB_APP.MAX_SUBJECTS}
        </span>
    `;
    container.appendChild(countDiv);
}

function saveCombination() {
    if (JAMB_APP.selectedSubjects.length === 0) {
        showAlert('Please select at least one subject', 'error');
        return;
    }
    updateTimerSettings();
    updateQuestionSettings();
    saveToStorage();
    showAlert('Settings saved successfully!', 'success');
    switchTab('topics');
}

function loadPreset(presetType) {
    const presets = {
        science: ['english', 'mathematics', 'physics', 'chemistry'],
        art: ['government', 'literature', 'economics', 'english'],
        commercial: ['mathematics', 'commerce', 'accounting', 'economics']
    };
    if (presets[presetType]) {
        JAMB_APP.selectedSubjects = presets[presetType];
        updateSetupUI();
        showAlert(`${presetType.charAt(0).toUpperCase() + presetType.slice(1)} preset loaded`, 'success');
    }
}

function setupSubjectCheckboxes() {
    document.querySelectorAll('.subject-checkbox').forEach(checkbox => {
        checkbox.addEventListener('click', function (e) {
            if (e.target.type === 'checkbox') return;
            const subject = this.querySelector('input').value;
            toggleSubject(subject);
        });
    });
}

// ================ DATA FOLDER LOADING ================
async function loadQuestionsFromDataFolder() {
    console.log('Loading questions from data folder...');
    
    try {
        // First, try to load manifest.json
        let manifest = null;
        try {
            const manifestResponse = await fetch('data/manifest.json');
            if (manifestResponse.ok) {
                manifest = await manifestResponse.json();
                console.log('Manifest loaded:', manifest);
            }
        } catch (e) {
            console.log('No manifest found, will scan data folder');
        }
        
        // Initialize topics structure
        JAMB_APP.topics = {};
        JAMB_APP.selectedTopics = {};
        
        if (manifest && manifest.files && Array.isArray(manifest.files)) {
            // Load files listed in manifest
            await loadFromManifest(manifest.files);
        } else {
            // Scan for common question file patterns
            await scanDataFolder();
        }
        
        // Initialize all subjects with empty topics if no data found
        Object.keys(JAMB_APP.allSubjects).forEach(subject => {
            if (!JAMB_APP.topics[subject]) {
                JAMB_APP.topics[subject] = {
                    'General': JAMB_APP.questions[subject] || []
                };
            }
            // Initialize selected topics (select all by default)
            if (!JAMB_APP.selectedTopics[subject]) {
                JAMB_APP.selectedTopics[subject] = Object.keys(JAMB_APP.topics[subject]);
            }
        });
        
        // Build questions array from selected topics
        rebuildQuestionsFromTopics();
        
        // Save to storage
        saveToStorage();
        
        // Show success message
        let totalQuestions = 0;
        let subjectsWithQuestions = 0;
        
        Object.keys(JAMB_APP.questions).forEach(subject => {
            const count = JAMB_APP.questions[subject]?.length || 0;
            totalQuestions += count;
            if (count > 0) subjectsWithQuestions++;
        });
        
        console.log(`✅ Loaded ${totalQuestions} questions for ${subjectsWithQuestions} subjects from data folder`);
        
        // Update UI
        updateTopicsTab();
        updateQuizTab();
        
        return true;
        
    } catch (error) {
        console.error('Error loading from data folder:', error);
        showAlert('Error loading questions from data folder', 'error');
        return false;
    }
}

async function loadFromManifest(files) {
    console.log('Loading from manifest files:', files);
    
    for (const file of files) {
        try {
            const response = await fetch(`data/${file}`);
            if (response.ok) {
                const data = await response.json();
                processQuestionFile(data, file);
            }
        } catch (error) {
            console.error(`Error loading ${file}:`, error);
        }
    }
}

async function scanDataFolder() {
    console.log('Scanning data folder for question files...');
    
    // Common file patterns to try
    const commonPatterns = [
        'questions.json',
        'english.json',
        'mathematics.json',
        'physics.json',
        'chemistry.json',
        'biology.json',
        'government.json',
        'economics.json',
        'commerce.json',
        'accounting.json',
        'literature.json'
    ];
    
    for (const pattern of commonPatterns) {
        try {
            const response = await fetch(`data/${pattern}`);
            if (response.ok) {
                const data = await response.json();
                processQuestionFile(data, pattern);
            }
        } catch (error) {
            // File not found, continue
        }
    }
}

function processQuestionFile(data, filename) {
    console.log(`Processing ${filename}:`, data);
    
    if (data.subjects && Array.isArray(data.subjects)) {
        // Format B: Multiple subjects
        data.subjects.forEach(subjectData => {
            addSubjectData(subjectData);
        });
    } else if (data.subject && Array.isArray(data.questions)) {
        // Format A: Single subject
        addSubjectData(data);
    } else if (data.topic && Array.isArray(data.questions)) {
        // Topic-based format
        const subject = filename.replace('.json', '').toLowerCase();
        addTopicData(subject, data.topic, data.questions);
    } else {
        console.log(`Unknown format in ${filename}`);
    }
}

function addSubjectData(subjectData) {
    const subject = subjectData.subject.toLowerCase();
    const questions = subjectData.questions || [];
    const topic = subjectData.topic || 'General';
    
    addTopicData(subject, topic, questions);
}

function addTopicData(subject, topicName, questions) {
    if (!JAMB_APP.allSubjects[subject]) {
        console.log(`Unknown subject: ${subject}`);
        return;
    }
    
    if (!JAMB_APP.topics[subject]) {
        JAMB_APP.topics[subject] = {};
    }
    
    if (!JAMB_APP.topics[subject][topicName]) {
        JAMB_APP.topics[subject][topicName] = [];
    }
    
    // Add questions to topic
    JAMB_APP.topics[subject][topicName].push(...questions);
    
    console.log(`Added ${questions.length} questions to ${subject} > ${topicName}`);
}

function rebuildQuestionsFromTopics() {
    // Clear existing questions
    Object.keys(JAMB_APP.questions).forEach(subject => {
        JAMB_APP.questions[subject] = [];
    });
    
    // Rebuild from selected topics
    Object.keys(JAMB_APP.selectedTopics).forEach(subject => {
        if (!JAMB_APP.topics[subject]) return;
        
        const selectedTopics = JAMB_APP.selectedTopics[subject];
        selectedTopics.forEach(topic => {
            if (JAMB_APP.topics[subject][topic]) {
                JAMB_APP.questions[subject].push(...JAMB_APP.topics[subject][topic]);
            }
        });
    });
}

// ================ TOPICS TAB FUNCTIONS ================
function updateTopicsTab() {
    const container = document.getElementById('topics-container');
    
    if (Object.keys(JAMB_APP.topics).length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 40px 20px; color: #666;">
                <i class="fas fa-book" style="font-size: 48px; margin-bottom: 20px;"></i>
                <h3>No Topics Loaded</h3>
                <p>Questions will be loaded automatically from the data folder</p>
                <button class="btn" onclick="loadQuestionsFromDataFolder()" style="margin-top: 20px;">
                    <i class="fas fa-sync"></i> Load Questions Now
                </button>
            </div>
        `;
        return;
    }
    
    let html = '';
    
    // Show only selected subjects
    const subjectsToShow = JAMB_APP.selectedSubjects.length > 0 
        ? JAMB_APP.selectedSubjects 
        : Object.keys(JAMB_APP.topics);
    
    subjectsToShow.forEach(subject => {
        const subjectInfo = JAMB_APP.allSubjects[subject];
        const topics = JAMB_APP.topics[subject];
        
        if (!topics || Object.keys(topics).length === 0) {
            return;
        }
        
        const selectedTopics = JAMB_APP.selectedTopics[subject] || [];
        const totalTopics = Object.keys(topics).length;
        const selectedCount = selectedTopics.length;
        
        html += `
            <div class="topic-category">
                <div class="topic-category-header">
                    <i class="fas fa-${subjectInfo.icon}"></i>
                    <div style="flex: 1;">
                        <h3 style="margin: 0 0 5px 0;">${subjectInfo.name}</h3>
                        <div style="font-size: 14px; color: #666;">
                            ${selectedCount}/${totalTopics} topics selected
                        </div>
                    </div>
                </div>
                
                <div class="topic-actions">
                    <button class="select-all-btn" onclick="selectAllTopics('${subject}')">
                        <i class="fas fa-check-square"></i> Select All
                    </button>
                    <button class="deselect-all-btn" onclick="deselectAllTopics('${subject}')">
                        <i class="fas fa-square"></i> Deselect All
                    </button>
                </div>
                
                <div class="topics-grid">
        `;
        
        Object.keys(topics).forEach(topicName => {
            const topicQuestions = topics[topicName] || [];
            const isSelected = selectedTopics.includes(topicName);
            
            html += `
                <label class="topic-checkbox ${isSelected ? 'selected' : ''}" 
                       onclick="toggleTopic('${subject}', '${topicName}')">
                    <div class="topic-name">
                        ${isSelected ? '<i class="fas fa-check" style="margin-right: 8px; color: #4caf50;"></i>' : ''}
                        ${topicName}
                    </div>
                    <div class="topic-count">${topicQuestions.length} questions</div>
                </label>
            `;
        });
        
        html += `
                </div>
            </div>
        `;
    });
    
    if (html === '') {
        html = `
            <div style="text-align: center; padding: 40px 20px; color: #666;">
                <i class="fas fa-info-circle" style="font-size: 48px; margin-bottom: 20px;"></i>
                <h3>No Topics Available</h3>
                <p>Select subjects in Setup tab or add question files to data folder</p>
                <button class="btn" onclick="switchTab('setup')" style="margin-top: 20px;">
                    <i class="fas fa-cog"></i> Go to Setup
                </button>
            </div>
        `;
    }
    
    container.innerHTML = html;
}

function toggleTopic(subject, topic) {
    if (!JAMB_APP.selectedTopics[subject]) {
        JAMB_APP.selectedTopics[subject] = [];
    }
    
    const index = JAMB_APP.selectedTopics[subject].indexOf(topic);
    if (index === -1) {
        // Add topic
        JAMB_APP.selectedTopics[subject].push(topic);
    } else {
        // Remove topic
        JAMB_APP.selectedTopics[subject].splice(index, 1);
    }
    
    // Rebuild questions from selected topics
    rebuildQuestionsFromTopics();
    
    // Save and update UI
    saveToStorage();
    updateTopicsTab(); // This refreshes the topics display
    updateQuizTab();
    
    const subjectName = JAMB_APP.allSubjects[subject]?.name || subject;
    showAlert(`Updated topics for ${subjectName}`, 'success');
}

function selectAllTopics(subject) {
    if (!JAMB_APP.topics[subject]) return;
    
    // Get ALL available topics for this subject
    const allTopics = Object.keys(JAMB_APP.topics[subject]);
    
    // Select all topics
    JAMB_APP.selectedTopics[subject] = [...allTopics];
    
    // Rebuild questions and update UI
    rebuildQuestionsFromTopics();
    saveToStorage();
    updateTopicsTab();
    updateQuizTab();
    
    const subjectName = JAMB_APP.allSubjects[subject]?.name || subject;
    showAlert(`Selected all ${allTopics.length} topics for ${subjectName}`, 'success');
}

function deselectAllTopics(subject) {
    // Empty the selected topics array
    JAMB_APP.selectedTopics[subject] = [];
    
    // Rebuild questions and update UI
    rebuildQuestionsFromTopics();
    saveToStorage();
    updateTopicsTab();
    updateQuizTab();
    
    const subjectName = JAMB_APP.allSubjects[subject]?.name || subject;
    showAlert(`Deselected all topics for ${subjectName}`, 'info');
}

function deselectAllTopics(subject) {
    JAMB_APP.selectedTopics[subject] = [];
    rebuildQuestionsFromTopics();
    saveToStorage();
    updateTopicsTab();
    updateQuizTab();
    
    const subjectName = JAMB_APP.allSubjects[subject]?.name || subject;
    showAlert(`Deselected all topics for ${subjectName}`, 'info');
}

// ================ QUIZ TAB FUNCTIONS ================
function updateQuizTab() {
    const container = document.getElementById('quizContainer');
    if (JAMB_APP.currentQuiz) {
        return;
    }
    container.innerHTML = `
        <div style="text-align: center; padding: 50px 20px;">
            <h3>Ready for JAMB Practice?</h3>
            <p>Questions loaded from data folder for your selected subjects</p>
            <div class="subjects-grid" style="margin: 30px auto; max-width: 600px;" id="quiz-subjects-grid">
            </div>
            <div style="background: #f5f5f5; padding: 20px; border-radius: 10px; margin: 20px auto; max-width: 600px;">
                <h4><i class="fas fa-cog"></i> Quiz Settings</h4>
                <div style="margin: 15px 0;">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
                        <span>Questions per subject:</span>
                        <span id="selected-questions-count">All available</span>
                    </div>
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
                        <span>Total questions:</span>
                        <span id="total-questions-count">0</span>
                    </div>
                    <div style="display: flex; align-items: center; justify-content: space-between;">
                        <span>Timer:</span>
                        <span id="selected-timer">120 minutes</span>
                    </div>
                </div>
            </div>
            <button class="btn" onclick="startFullJAMBQuiz()" id="start-jamb-btn" disabled>
                <i class="fas fa-play"></i> Start Full JAMB Simulation
            </button>
            <button class="btn btn-secondary" onclick="practiceCustomQuiz()" id="custom-quiz-btn" disabled>
                <i class="fas fa-sliders-h"></i> Custom Quiz
            </button>
        </div>
    `;
    const subjectsGrid = document.getElementById('quiz-subjects-grid');
    subjectsGrid.innerHTML = '';
    let allSubjectsHaveQuestions = true;
    let totalQuestionsAvailable = 0;
    if (JAMB_APP.selectedSubjects.length === 0) {
        subjectsGrid.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 20px; color: #666;">
                <i class="fas fa-info-circle" style="font-size: 24px; margin-bottom: 10px;"></i>
                <p>No subjects selected. Please select subjects in the Setup tab.</p>
            </div>
        `;
        document.getElementById('start-jamb-btn').disabled = true;
        document.getElementById('custom-quiz-btn').disabled = true;
        return;
    }
    JAMB_APP.selectedSubjects.forEach(subject => {
        const subjectInfo = JAMB_APP.allSubjects[subject];
        const count = JAMB_APP.questions[subject]?.length || 0;
        totalQuestionsAvailable += count;
        if (count === 0) allSubjectsHaveQuestions = false;
        const card = document.createElement('div');
        card.className = `subject-card ${count > 0 ? 'has-questions' : 'no-questions'}`;
        if (count > 0) {
            // Count selected topics
            const selectedTopics = JAMB_APP.selectedTopics[subject] || [];
            const totalTopics = JAMB_APP.topics[subject] ? Object.keys(JAMB_APP.topics[subject]).length : 0;
            
            card.innerHTML = `
                <div class="subject-icon">
                    <i class="fas fa-${subjectInfo.icon}"></i>
                </div>
                <div class="subject-name">${subjectInfo.name}</div>
                <div class="question-count">${count} questions available</div>
                <div style="font-size: 12px; color: #4caf50; margin: 5px 0;">
                    <i class="fas fa-check-circle"></i> ${selectedTopics.length}/${totalTopics} topics selected
                </div>
                <button class="btn" onclick="practiceSubject('${subject}')" style="margin-top: 10px; padding: 8px 15px; font-size: 14px;">
                    <i class="fas fa-play"></i> Practice
                </button>
            `;
        } else {
            card.innerHTML = `
                <div class="subject-icon">
                    <i class="fas fa-${subjectInfo.icon}"></i>
                </div>
                <div class="subject-name">${subjectInfo.name}</div>
                <div class="question-count">No questions available</div>
                <div style="font-size: 12px; color: #f44336; margin: 5px 0;">
                    <i class="fas fa-exclamation-circle"></i> No questions in data folder
                </div>
                <button class="btn" onclick="switchTab('topics')" style="margin-top: 10px; padding: 8px 15px; font-size: 14px; background: #666;">
                    <i class="fas fa-book"></i> Check Topics
                </button>
            </div>
            `;
        }
        subjectsGrid.appendChild(card);
    });
    let questionsPerQuiz = 0;
    if (JAMB_APP.settings.questions.mode === 'custom') {
        questionsPerQuiz = JAMB_APP.settings.questions.perSubject * JAMB_APP.selectedSubjects.length;
        document.getElementById('selected-questions-count').textContent = `${JAMB_APP.settings.questions.perSubject} per subject`;
    } else {
        const perSubject = JAMB_APP.selectedSubjects.map(s => {
            const count = JAMB_APP.questions[s]?.length || 0;
            return Math.min(count, JAMB_APP.MAX_QUESTIONS_PER_QUIZ);
        });
        questionsPerQuiz = perSubject.reduce((a, b) => a + b, 0);
        document.getElementById('selected-questions-count').textContent = 'All available';
    }
    document.getElementById('total-questions-count').textContent = questionsPerQuiz;
    const timerText = JAMB_APP.settings.timer.enabled ?
        `${JAMB_APP.settings.timer.minutes} minutes` :
        'No timer (Practice Mode)';
    document.getElementById('selected-timer').textContent = timerText;
    document.getElementById('start-jamb-btn').disabled = !allSubjectsHaveQuestions;
    document.getElementById('custom-quiz-btn').disabled = !allSubjectsHaveQuestions;
}

function practiceSubject(subject) {
    const questions = JAMB_APP.questions[subject];
    if (!questions || questions.length === 0) {
        showAlert(`No questions available for ${JAMB_APP.allSubjects[subject]?.name || subject}`, 'error');
        return;
    }
    
    let questionsToUse;
    if (JAMB_APP.settings.questions.mode === 'custom') {
        questionsToUse = Math.min(JAMB_APP.settings.questions.perSubject, questions.length);
    } else {
        // Use all available questions, but max 100 per quiz
        questionsToUse = Math.min(questions.length, JAMB_APP.MAX_QUESTIONS_PER_QUIZ);
    }
    
    startSubjectQuiz(subject, questionsToUse);
}

function startSubjectQuiz(subject, questionCount, useTimer = JAMB_APP.settings.timer.enabled, minutes = JAMB_APP.settings.timer.minutes) {
    const questions = JAMB_APP.questions[subject];
    if (!questions || questions.length === 0) return;
    
    // Use up to MAX_QUESTIONS_PER_QUIZ (100) for quiz
    const quizQuestions = [...questions]
        .sort(() => Math.random() - 0.5)
        .slice(0, Math.min(questionCount, JAMB_APP.MAX_QUESTIONS_PER_QUIZ));
    
    JAMB_APP.currentQuiz = {
        type: 'subject',
        subject: subject,
        questions: quizQuestions,
        currentIndex: 0,
        score: 0,
        answers: new Array(quizQuestions.length).fill(null),
        startTime: new Date(),
        totalTime: useTimer ? minutes * 60 : 0,
        timerUsed: useTimer,
        timerSetting: minutes,
        results: null
    };
    
    showQuizInterface();
}

// ================ CUSTOM QUIZ FUNCTIONS ================
function practiceCustomQuiz() {
    openCustomQuizModal();
}

function openCustomQuizModal() {
    const modal = document.getElementById('customQuizModal');
    const subjectsList = document.getElementById('custom-quiz-subjects-list');
    const totalQuestionsSpan = document.getElementById('custom-total-questions');
    const subjectsCountSpan = document.getElementById('custom-subjects-count');
    const timerDisplaySpan = document.getElementById('custom-timer-display');

    // Populate selected subjects with individual question inputs
    subjectsList.innerHTML = '';
    if (JAMB_APP.selectedSubjects.length === 0) {
        subjectsList.innerHTML = `
            <div style="color: #f44336; padding: 10px; background: #ffebee; border-radius: 5px;">
                <i class="fas fa-exclamation-triangle"></i> No subjects selected. Please select subjects in the Setup tab.
            </div>
        `;
        return;
    }

    JAMB_APP.selectedSubjects.forEach(subject => {
        const subjectInfo = JAMB_APP.allSubjects[subject];
        const questionCount = JAMB_APP.questions[subject]?.length || 0;
        
        // Maximum questions for quiz (100 per subject)
        const maxQuestionsForQuiz = Math.min(questionCount, JAMB_APP.MAX_QUESTIONS_PER_QUIZ);
        
        // Default questions per subject
        let defaultQuestions = 0;
        if (JAMB_APP.settings.questions.mode === 'custom') {
            defaultQuestions = Math.min(JAMB_APP.settings.questions.perSubject, maxQuestionsForQuiz);
        } else {
            defaultQuestions = Math.min(Math.floor(maxQuestionsForQuiz / 2), 10);
        }
        
        const subjectDiv = document.createElement('div');
        subjectDiv.className = 'subject-question-input';
        subjectDiv.style.cssText = `
            display: flex; justify-content: space-between; align-items: center;
            padding: 12px; margin: 8px 0; background: white;
            border-radius: 8px; border: 1px solid #e0e0e0;
        `;
        subjectDiv.innerHTML = `
            <div style="flex: 1;">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <i class="fas fa-${subjectInfo.icon}" style="color: #6200ea;"></i>
                    <div>
                        <div style="font-weight: 500;">${subjectInfo.name}</div>
                        <div style="font-size: 12px; color: #666;">Available: ${questionCount} questions</div>
                        <div style="font-size: 11px; color: #ff9800; margin-top: 3px;">
                            Max ${JAMB_APP.MAX_QUESTIONS_PER_QUIZ} per quiz
                        </div>
                    </div>
                </div>
            </div>
            <div style="display: flex; align-items: center; gap: 10px;">
                <input type="number" 
                       class="subject-question-count" 
                       data-subject="${subject}"
                       min="1" 
                       max="${maxQuestionsForQuiz}"
                       value="${defaultQuestions}"
                       style="width: 70px; padding: 8px; border: 1px solid #ddd; border-radius: 5px; text-align: center;">
                <div style="font-size: 12px; color: #666; min-width: 80px;">
                    / ${maxQuestionsForQuiz} max
                </div>
            </div>
        `;
        subjectsList.appendChild(subjectDiv);
    });

    // Set up timer info from settings
    let setupTimerText = '';
    if (JAMB_APP.settings.timer.enabled) {
        setupTimerText = `${JAMB_APP.settings.timer.minutes} minutes`;
    } else {
        setupTimerText = 'No timer (Practice Mode)';
    }
    
    // Set initial timer display
    timerDisplaySpan.textContent = setupTimerText;

    // Add event listeners to all question count inputs
    document.querySelectorAll('.subject-question-count').forEach(input => {
        input.addEventListener('input', updateCustomQuizSummary);
        input.addEventListener('change', updateCustomQuizSummary);
    });

    // Initialize
    updateCustomQuizSummary();

    modal.style.display = 'flex';
}

function updateCustomQuizSummary() {
    const totalQuestionsSpan = document.getElementById('custom-total-questions');
    const subjectsCountSpan = document.getElementById('custom-subjects-count');
    const subjectBreakdown = document.getElementById('subject-breakdown');

    if (JAMB_APP.selectedSubjects.length === 0) return;

    let totalQuestions = 0;
    let hasInvalidInput = false;
    let breakdownHTML = '<div style="margin-top: 10px;"><strong>Subject Breakdown:</strong><br>';

    JAMB_APP.selectedSubjects.forEach(subject => {
        const subjectInfo = JAMB_APP.allSubjects[subject];
        const questionCount = JAMB_APP.questions[subject]?.length || 0;
        const maxQuestionsForQuiz = Math.min(questionCount, JAMB_APP.MAX_QUESTIONS_PER_QUIZ);
        
        const input = document.querySelector(`.subject-question-count[data-subject="${subject}"]`);
        if (!input) return;
        
        let requestedQuestions = parseInt(input.value) || 0;
        
        // Validate input
        if (requestedQuestions < 1) {
            requestedQuestions = 1;
            input.value = 1;
        } else if (requestedQuestions > maxQuestionsForQuiz) {
            requestedQuestions = maxQuestionsForQuiz;
            input.value = maxQuestionsForQuiz;
        }
        
        // Check if enough questions available
        if (requestedQuestions > questionCount) {
            hasInvalidInput = true;
            input.style.borderColor = '#f44336';
            input.style.background = '#ffebee';
        } else {
            input.style.borderColor = '#ddd';
            input.style.background = 'white';
        }
        
        totalQuestions += requestedQuestions;
        
        // Add to breakdown
        const statusColor = requestedQuestions <= questionCount ? '#4caf50' : '#f44336';
        breakdownHTML += `
            <div style="display: flex; justify-content: space-between; margin-top: 5px;">
                <span><i class="fas fa-${subjectInfo.icon}"></i> ${subjectInfo.name}</span>
                <span style="color: ${statusColor};">${requestedQuestions} questions</span>
            </div>
        `;
    });
    
    breakdownHTML += '</div>';

    // Update counts
    totalQuestionsSpan.textContent = totalQuestions;
    subjectsCountSpan.textContent = JAMB_APP.selectedSubjects.length;
    subjectBreakdown.innerHTML = breakdownHTML;
    
    // Show warning if any subject doesn't have enough questions
    if (hasInvalidInput) {
        showAlert('Some subjects don\'t have enough questions available. Adjusted to maximum available.', 'error');
    }
}

function closeCustomQuizModal() {
    const modal = document.getElementById('customQuizModal');
    modal.style.display = 'none';
}

function startCustomQuiz() {
    // Collect questions per subject from inputs
    const subjectQuestions = {};
    let hasErrors = false;
    let errorMessages = [];
    
    JAMB_APP.selectedSubjects.forEach(subject => {
        const input = document.querySelector(`.subject-question-count[data-subject="${subject}"]`);
        if (!input) return;
        
        const requestedQuestions = parseInt(input.value) || 0;
        const availableQuestions = JAMB_APP.questions[subject]?.length || 0;
        const maxForQuiz = Math.min(availableQuestions, JAMB_APP.MAX_QUESTIONS_PER_QUIZ);
        
        if (requestedQuestions < 1) {
            hasErrors = true;
            errorMessages.push(`${JAMB_APP.allSubjects[subject].name}: Must have at least 1 question`);
        } else if (requestedQuestions > availableQuestions) {
            hasErrors = true;
            errorMessages.push(`${JAMB_APP.allSubjects[subject].name}: Only ${availableQuestions} questions available (requested ${requestedQuestions})`);
        } else if (requestedQuestions > maxForQuiz) {
            hasErrors = true;
            errorMessages.push(`${JAMB_APP.allSubjects[subject].name}: Maximum ${JAMB_APP.MAX_QUESTIONS_PER_QUIZ} questions allowed per subject in a quiz`);
        } else {
            subjectQuestions[subject] = requestedQuestions;
        }
    });
    
    if (hasErrors) {
        showAlert('Please fix the following errors:<br>' + errorMessages.join('<br>'), 'error');
        return;
    }
    
    // Check if any questions selected
    const totalQuestions = Object.values(subjectQuestions).reduce((a, b) => a + b, 0);
    if (totalQuestions === 0) {
        showAlert('Please select at least 1 question from any subject', 'error');
        return;
    }
    
    // Use timer settings from setup tab
    const timerSettings = {
        enabled: JAMB_APP.settings.timer.enabled,
        minutes: JAMB_APP.settings.timer.minutes
    };
    
    closeCustomQuizModal();
    startCustomQuizWithSettings(subjectQuestions, timerSettings);
}

// ================ QUIZ INTERFACE FUNCTIONS ================
function startFullJAMBQuiz() {
    let missingQuestions = [];
    JAMB_APP.selectedSubjects.forEach(subject => {
        if (JAMB_APP.questions[subject]?.length === 0) {
            missingQuestions.push(JAMB_APP.allSubjects[subject]?.name || subject);
        }
    });
    if (missingQuestions.length > 0) {
        showAlert(`Missing questions for: ${missingQuestions.join(', ')}`, 'error');
        return;
    }
    
    // Show exam warning instead of starting immediately
    showExamWarning();
}

function startJAMBQuiz() {
    let subjectQuestions = {};
    let questionRanges = {};
    let allQuestions = [];
    
    // Group questions by subject (not mixed)
    JAMB_APP.selectedSubjects.forEach(subject => {
        const available = JAMB_APP.questions[subject].length;
        let count;
        if (JAMB_APP.settings.questions.mode === 'custom') {
            count = Math.min(JAMB_APP.settings.questions.perSubject, available);
        } else {
            // Use all available but max 100 per subject for JAMB quiz
            count = Math.min(available, JAMB_APP.MAX_QUESTIONS_PER_QUIZ);
        }
        
        const shuffledQuestions = JAMB_APP.questions[subject]
            .sort(() => Math.random() - 0.5)
            .slice(0, count)
            .map(q => ({ ...q, subject: subject }));
        
        subjectQuestions[subject] = shuffledQuestions;
    });
    
    // Arrange in order: English first (if selected), then others
    const orderedSubjects = [];
    if (JAMB_APP.selectedSubjects.includes('english')) {
        orderedSubjects.push('english');
    }
    JAMB_APP.selectedSubjects.forEach(subject => {
        if (subject !== 'english') {
            orderedSubjects.push(subject);
        }
    });
    
    // Calculate question ranges for each subject
    let startIndex = 1;
    orderedSubjects.forEach(subject => {
        const questions = subjectQuestions[subject] || [];
        if (questions.length > 0) {
            const endIndex = startIndex + questions.length - 1;
            questionRanges[subject] = {
                start: startIndex,
                end: endIndex,
                questions: questions
            };
            allQuestions.push(...questions);
            startIndex = endIndex + 1;
        }
    });
    
    JAMB_APP.currentQuiz = {
        type: 'jamb',
        subjects: orderedSubjects,
        questions: allQuestions,
        questionRanges: questionRanges,
        currentSubject: orderedSubjects[0],
        currentIndex: 0,
        score: 0,
        answers: new Array(allQuestions.length).fill(null),
        startTime: new Date(),
        totalTime: JAMB_APP.settings.timer.enabled ? JAMB_APP.settings.timer.minutes * 60 : 0,
        timerUsed: JAMB_APP.settings.timer.enabled,
        timerSetting: JAMB_APP.settings.timer.minutes,
        results: null
    };
    
    showQuizInterface();
}

function startCustomQuizWithSettings(subjectQuestions, timerSettings) {
    let questionRanges = {};
    let allQuestions = [];
    
    // Arrange in order: English first (if selected), then others
    const orderedSubjects = [];
    if (JAMB_APP.selectedSubjects.includes('english')) {
        orderedSubjects.push('english');
    }
    JAMB_APP.selectedSubjects.forEach(subject => {
        if (subject !== 'english') {
            orderedSubjects.push(subject);
        }
    });
    
    // Calculate question ranges for each subject
    let startIndex = 1;
    orderedSubjects.forEach(subject => {
        const requestedCount = subjectQuestions[subject] || 0;
        const questions = JAMB_APP.questions[subject] || [];
        
        if (requestedCount > 0 && questions.length > 0) {
            const shuffledQuestions = [...questions]
                .sort(() => Math.random() - 0.5)
                .slice(0, Math.min(requestedCount, JAMB_APP.MAX_QUESTIONS_PER_QUIZ))
                .map(q => ({ ...q, subject: subject }));
            
            const endIndex = startIndex + shuffledQuestions.length - 1;
            questionRanges[subject] = {
                start: startIndex,
                end: endIndex,
                questions: shuffledQuestions
            };
            allQuestions.push(...shuffledQuestions);
            startIndex = endIndex + 1;
        }
    });
    
    JAMB_APP.currentQuiz = {
        type: 'jamb',
        subjects: orderedSubjects.filter(subject => subjectQuestions[subject] > 0),
        questions: allQuestions,
        questionRanges: questionRanges,
        currentSubject: orderedSubjects[0],
        currentIndex: 0,
        score: 0,
        answers: new Array(allQuestions.length).fill(null),
        startTime: new Date(),
        totalTime: timerSettings.enabled ? timerSettings.minutes * 60 : 0,
        timerUsed: timerSettings.enabled,
        timerSetting: timerSettings.minutes,
        results: null
    };
    
    // Enable exam mode for Custom Quiz if it has multiple subjects
    if (JAMB_APP.currentQuiz.subjects.length > 1) {
        enableExamMode();
    }
    
    showQuizInterface();
}

// ================ QUIZ DISPLAY FUNCTIONS ================
function showQuizInterface() {
    const quiz = JAMB_APP.currentQuiz;
    if (!quiz) return;
    
    // Calculate global question number
    const globalQuestionNumber = quiz.currentIndex + 1;
    const currentSubject = quiz.questions[quiz.currentIndex]?.subject || quiz.currentSubject;
    const subjectStart = quiz.questionRanges?.[currentSubject]?.start || 1;
    const subjectQuestionNumber = (quiz.currentIndex - getSubjectStartIndex(quiz, currentSubject)) + 1;
    const subjectTotalQuestions = quiz.questionRanges?.[currentSubject]?.questions.length || 0;
    
    // Calculate progress
    const answeredCount = quiz.answers.filter(answer => answer !== null).length;
    const progress = ((answeredCount) / quiz.questions.length) * 100;
    
    let html = '';
    
    // Add exam mode header if in exam mode
    if (examMode && quiz.type === 'jamb') {
        html += `
            <div style="background: linear-gradient(to right, #3700b3, #6200ea); color: white; padding: 15px; text-align: center; border-bottom: 3px solid #ff9800;">
                <h2 style="margin: 0;">
                    <i class="fas fa-graduation-cap"></i> JAMB SIMULATION EXAM
                </h2>
                <p style="margin: 5px 0 0 0; font-size: 14px;">
                    <i class="fas fa-exclamation-triangle"></i> Do not close or refresh this page
                </p>
            </div>
        `;
    }
    
    // Create timer display if timer is enabled
    if (quiz.timerUsed && quiz.totalTime > 0) {
        html += `
            <div style="background: ${examMode ? '#3700b3' : '#6200ea'}; color: white; padding: 12px; border-radius: ${examMode ? '0' : '10px'}; margin: 10px 0; text-align: center;">
                <div id="timer-display" class="timer-display">
                    <i class="fas fa-clock"></i> Loading...
                </div>
            </div>
        `;
    }
    
    // ================ TOP CONTROLS BAR ================
    html += `
        <div class="quiz-top-controls" style="display: flex; justify-content: space-between; align-items: center; margin: 15px 0; padding: 15px; background: #f8f9fa; border-radius: 12px; border: 2px solid #e0e0e0;">
            <!-- Left: End Quiz Button -->
            <div>
                <button class="btn" onclick="endQuiz()" style="background: #f44336; padding: 10px 20px;">
                    <i class="fas fa-stop"></i> End Quiz
                </button>
            </div>
            
            <!-- Center: Jump to Question -->
            <div class="jump-menu-wrapper" style="position: relative;">
                <button class="btn" onclick="toggleJumpMenu()" style="background: #2196f3; padding: 10px 20px;">
                    <i class="fas fa-forward"></i> Jump to Question
                </button>
                <div class="jump-menu" id="jump-menu" style="display: none; position: absolute; top: 100%; right: 0; background: white; border: 2px solid #6200ea; border-radius: 10px; padding: 15px; z-index: 1000; box-shadow: 0 5px 15px rgba(0,0,0,0.2); min-width: 250px;">
                    <div style="margin-bottom: 10px; font-weight: 500; color: #6200ea; font-size: 16px;">
                        <i class="fas fa-arrow-right"></i> Go to Question
                    </div>
                    <div style="display: flex; gap: 10px; align-items: center; margin-bottom: 10px;">
                        <input type="number" id="jump-to-number" 
                               min="1" max="${quiz.questions.length}" 
                               value="${quiz.currentIndex + 1}" 
                               style="flex: 1; padding: 12px; border: 2px solid #ddd; border-radius: 8px; font-size: 16px; text-align: center;">
                        <button class="btn" onclick="jumpToQuestionNumber()" style="padding: 12px 20px;">
                            <i class="fas fa-check"></i> Go
                        </button>
                    </div>
                    <div style="font-size: 12px; color: #666; text-align: center;">
                        Enter number (1-${quiz.questions.length})
                    </div>
                </div>
            </div>
            
            <!-- Right: Stats -->
            <div style="display: flex; align-items: center; gap: 20px;">
                <div style="text-align: center;">
                    <div style="font-size: 12px; color: #666; margin-bottom: 5px;">Answered</div>
                    <div style="font-size: 24px; font-weight: bold; color: #4caf50;">
                        ${answeredCount}
                    </div>
                </div>
                <div style="text-align: center;">
                    <div style="font-size: 12px; color: #666; margin-bottom: 5px;">Remaining</div>
                    <div style="font-size: 24px; font-weight: bold; color: #ff9800;">
                        ${quiz.questions.length - answeredCount}
                    </div>
                </div>
                <div style="text-align: center;">
                    <div style="font-size: 12px; color: #666; margin-bottom: 5px;">Total</div>
                    <div style="font-size: 24px; font-weight: bold; color: #6200ea;">
                        ${quiz.questions.length}
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // ================ PROGRESS BAR ================
    html += `
        <div class="progress-container" style="margin: 10px 0 20px 0;">
            <div class="progress-bar">
                <div class="progress-fill" style="width: ${progress}%"></div>
            </div>
            <div style="text-align: center; margin-top: 5px; color: #666; font-size: 14px; display: flex; justify-content: space-between;">
                <span>${Math.round(progress)}% Complete</span>
                <span>Question ${globalQuestionNumber} of ${quiz.questions.length}</span>
                <span>${answeredCount} answered</span>
            </div>
        </div>
    `;
    
    // ================ SUBJECT SELECTOR (for JAMB quiz) ================
    if (quiz.type === 'jamb') {
        html += `
            <div class="quiz-subject-selector" style="margin-bottom: 20px; overflow-x: auto; white-space: nowrap; padding-bottom: 10px; -webkit-overflow-scrolling: touch;">
                ${quiz.subjects.map(subject => {
                    const subjectInfo = JAMB_APP.allSubjects[subject];
                    const range = quiz.questionRanges?.[subject];
                    if (!range) return '';
                    
                    const answeredInSubject = range.questions.filter((q, idx) => {
                        const globalIdx = getSubjectStartIndex(quiz, subject) + idx;
                        return quiz.answers[globalIdx] !== null;
                    }).length;
                    
                    const isCurrentSubject = currentSubject === subject;
                    const rangeText = `Q${range.start}-${range.end}`;
                    
                    return `
                        <div class="quiz-subject-tab ${isCurrentSubject ? 'active' : ''}" 
                             onclick="switchToSubject('${subject}')"
                             style="display: inline-block; padding: 10px 20px; margin: 0 5px; background: ${isCurrentSubject ? '#6200ea' : '#f5f5f5'}; color: ${isCurrentSubject ? 'white' : '#333'}; border-radius: 20px; border: 2px solid ${isCurrentSubject ? '#6200ea' : '#ddd'}; cursor: pointer; font-weight: 500; min-width: 140px; text-align: center;">
                            <div style="font-size: 14px; display: flex; align-items: center; justify-content: center; gap: 8px;">
                                <i class="fas fa-${subjectInfo?.icon || 'book'}"></i>
                                ${subjectInfo.name}
                            </div>
                            <div style="font-size: 11px; margin-top: 5px; color: ${isCurrentSubject ? 'rgba(255,255,255,0.8)' : '#666'}">
                                ${rangeText} • ${answeredInSubject}/${range.questions.length}
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }
    
    // ================ QUESTION BOX ================
    const currentQuestion = quiz.questions[quiz.currentIndex];
    const userAnswer = quiz.answers[quiz.currentIndex];
    
    html += `
        <div class="question-box" style="background: white; padding: 25px; border-radius: 12px; box-shadow: 0 3px 10px rgba(0,0,0,0.08); margin-bottom: 20px; border: 1px solid #e0e0e0;">
    `;

    // Subject indicator for ALL quiz types
    const subjectInfo = JAMB_APP.allSubjects[currentSubject] || JAMB_APP.allSubjects[quiz.subject];
    if (subjectInfo) {
        let subjectDisplayName = subjectInfo.name;
        
        // If it's a JAMB quiz with multiple subjects, show which one
        if (quiz.type === 'jamb') {
            subjectDisplayName = `${subjectInfo.name} (Subject ${quiz.subjects.indexOf(currentSubject) + 1} of ${quiz.subjects.length})`;
        }
        
        html += `
            <div style="margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; padding: 12px; background: #e8eaf6; border-radius: 8px;">
                <span style="display: flex; align-items: center; gap: 10px; font-weight: 500; color: #6200ea;">
                    <i class="fas fa-${subjectInfo.icon || 'book'}"></i>
                    ${subjectDisplayName}
                </span>
                <span style="font-size: 14px; color: #666; background: white; padding: 5px 12px; border-radius: 15px; border: 1px solid #ddd;">
                    ${quiz.type === 'jamb' ? 
                      `Question ${subjectQuestionNumber} of ${subjectTotalQuestions} in this subject` : 
                      `Question ${globalQuestionNumber} of ${quiz.questions.length}`}
                </span>
            </div>
        `;
    }
    
    // Question text
    html += `
            <div class="question-text" style="font-size: 20px; line-height: 1.6; margin-bottom: 25px; color: #333;">
                <strong>${globalQuestionNumber}.</strong> ${currentQuestion.question}
            </div>
            
            <div class="options-grid" style="display: grid; gap: 15px;">
    `;
    
    // Options
    currentQuestion.options.forEach((option, index) => {
        let buttonClass = 'option-btn';
        let selectedText = '';
        
        if (userAnswer !== null && index === userAnswer) {
            buttonClass += ' selected';
            selectedText = '<span style="margin-left: auto; color: #6200ea;"><i class="fas fa-check-circle"></i> Selected</span>';
        }
        
        html += `
                <button class="${buttonClass}" onclick="selectAnswer(${index})" style="padding: 15px; border: 2px solid #e0e0e0; border-radius: 8px; background: white; text-align: left; cursor: pointer; font-size: 16px; display: flex; align-items: center; transition: all 0.2s;">
                    <span class="option-letter" style="display: inline-flex; align-items: center; justify-content: center; width: 36px; height: 36px; background: #6200ea; color: white; border-radius: 50%; margin-right: 15px; font-weight: bold; font-size: 16px;">
                        ${String.fromCharCode(65 + index)}
                    </span>
                    <span style="flex: 1; text-align: left;">${option}</span>
                    ${selectedText}
                </button>
        `;
    });
    
    html += `
            </div>
        </div>
    `;
    
    // ================ QUESTION NAVIGATION NUMBERS ================
    html += `
        <div style="margin: 25px 0;">
            <div style="margin-bottom: 15px; font-weight: 500; color: #6200ea; display: flex; align-items: center; gap: 10px;">
                <i class="fas fa-list-ol"></i>
                Question Navigation
                <span style="font-size: 14px; color: #666; font-weight: normal; margin-left: auto;">
                    Click any number to jump
                </span>
            </div>
    `;
    
    if (quiz.type === 'jamb') {
        // Grouped by subject for JAMB quiz
        quiz.subjects.forEach(subject => {
            const range = quiz.questionRanges?.[subject];
            if (!range) return;
            
            const subjectInfo = JAMB_APP.allSubjects[subject];
            
            html += `
                <div style="margin: 15px 0;">
                    <div style="margin-bottom: 10px; font-size: 14px; color: #666; display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: #f8f9fa; border-radius: 8px;">
                        <i class="fas fa-${subjectInfo?.icon || 'book'}"></i>
                        <strong>${subjectInfo?.name || subject}</strong>
                        <span style="margin-left: auto; font-size: 12px; color: #999;">
                            Questions ${range.start}-${range.end}
                        </span>
                    </div>
                    <div style="display: flex; flex-wrap: wrap; gap: 8px;">
            `;
            
            for (let i = range.start; i <= range.end; i++) {
                const questionIndex = i - 1;
                const isCurrent = questionIndex === quiz.currentIndex;
                const isAnswered = quiz.answers[questionIndex] !== null;
                const buttonClass = isCurrent ? 'question-nav-btn current' : 
                                   isAnswered ? 'question-nav-btn answered' : 
                                   'question-nav-btn';
                
                html += `
                    <button class="${buttonClass}" onclick="jumpToQuestion(${questionIndex})" 
                            style="width: 40px; height: 40px; border-radius: 50%; border: 2px solid #ddd; background: white; display: flex; align-items: center; justify-content: center; cursor: pointer; font-weight: 500; font-size: 14px; transition: all 0.2s;">
                        ${i}
                    </button>
                `;
            }
            
            html += `
                    </div>
                </div>
            `;
        });
    } else {
        // Single subject navigation
        html += `<div style="display: flex; flex-wrap: wrap; gap: 8px; justify-content: center;">`;
        
        for (let i = 0; i < quiz.questions.length; i++) {
            const isCurrent = i === quiz.currentIndex;
            const isAnswered = quiz.answers[i] !== null;
            const buttonClass = isCurrent ? 'question-nav-btn current' : 
                               isAnswered ? 'question-nav-btn answered' : 
                               'question-nav-btn';
            
            html += `
                <button class="${buttonClass}" onclick="jumpToQuestion(${i})" 
                        style="width: 40px; height: 40px; border-radius: 50%; border: 2px solid #ddd; background: white; display: flex; align-items: center; justify-content: center; cursor: pointer; font-weight: 500; font-size: 14px; transition: all 0.2s;">
                    ${i + 1}
                </button>
            `;
        }
        
        html += `</div>`;
    }
    
    html += `
            <div style="margin-top: 15px; font-size: 12px; color: #666; display: flex; justify-content: center; flex-wrap: wrap; gap: 15px;">
                <span style="display: inline-flex; align-items: center;">
                    <span style="display: inline-block; width: 12px; height: 12px; background: #6200ea; border-radius: 50%; margin-right: 5px;"></span> Current
                </span>
                <span style="display: inline-flex; align-items: center;">
                    <span style="display: inline-block; width: 12px; height: 12px; background: #4caf50; border-radius: 50%; margin-right: 5px;"></span> Answered
                </span>
                <span style="display: inline-flex; align-items: center;">
                    <span style="display: inline-block; width: 12px; height: 12px; background: #f5f5f5; border-radius: 50%; border: 1px solid #ddd; margin-right: 5px;"></span> Unanswered
                </span>
            </div>
        </div>
    `;
    
    // ================ BOTTOM NAVIGATION ================
    html += `
        <div class="quiz-bottom-nav" style="display: flex; justify-content: space-between; margin-top: 30px; padding-top: 20px; border-top: 2px solid #f0f0f0;">
            <button class="btn btn-secondary" onclick="previousQuestion()" ${quiz.currentIndex === 0 ? 'disabled' : ''} 
                    style="padding: 12px 25px; background: #666; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 500; display: flex; align-items: center; gap: 8px;">
                <i class="fas fa-arrow-left"></i> Previous
            </button>
            
            <button class="btn" onclick="markForReview()" 
                    style="background: #ff9800; padding: 12px 25px; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 500; display: flex; align-items: center; gap: 8px;">
                <i class="fas fa-flag"></i> ${quiz.review && quiz.review.includes(quiz.currentIndex) ? 'Unmark Review' : 'Mark for Review'}
            </button>
            
            <button class="btn" onclick="nextQuestion()" 
                    style="background: #6200ea; padding: 12px 25px; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 500; display: flex; align-items: center; gap: 8px;">
                ${quiz.currentIndex === quiz.questions.length - 1 ? 'Finish Quiz' : 'Next'} 
                <i class="fas fa-arrow-right"></i>
            </button>
        </div>
    `;
    
    // Set the HTML
    document.getElementById('quizContainer').innerHTML = html;
    
    // Start timer if enabled
    if (quiz.timerUsed && quiz.totalTime > 0) {
        startQuizTimer(quiz.totalTime);
    }
    // Helper function to add dynamic styles for quiz buttons
function addQuizButtonStyles() {
    const styleId = 'quiz-button-styles';
    if (document.getElementById(styleId)) return;
    
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
        .option-btn:hover {
            border-color: #6200ea !important;
            background: #f3e5f5 !important;
            transform: translateY(-2px) !important;
            box-shadow: 0 3px 8px rgba(98,0,234,0.2) !important;
        }
        
        .option-btn.selected {
            background: #e8eaf6 !important;
            border-color: #6200ea !important;
        }
        
        .option-btn.selected .option-letter {
            background: #6200ea !important;
        }
        
        .question-nav-btn:hover {
            transform: scale(1.1) !important;
            border-color: #6200ea !important;
        }
        
        .question-nav-btn.current {
            background: #6200ea !important;
            color: white !important;
            border-color: #6200ea !important;
            font-weight: bold !important;
        }
        
        .question-nav-btn.answered {
            background: #4caf50 !important;
            color: white !important;
            border-color: #4caf50 !important;
        }
        
        .quiz-subject-tab:hover {
            transform: translateY(-2px) !important;
            box-shadow: 0 3px 8px rgba(0,0,0,0.1) !important;
        }
        
        .quiz-subject-tab.active {
            background: #6200ea !important;
            color: white !important;
            border-color: #6200ea !important;
        }
        
        button:disabled {
            opacity: 0.5 !important;
            cursor: not-allowed !important;
        }
        
        button:disabled:hover {
            transform: none !important;
            box-shadow: none !important;
        }
        
        @media (max-width: 768px) {
            .quiz-top-controls {
                flex-direction: column !important;
                gap: 15px !important;
            }
            
            .quiz-top-controls > div {
                width: 100% !important;
                justify-content: center !important;
                display: flex !important;
            }
            
            .quiz-bottom-nav {
                flex-direction: column !important;
                gap: 12px !important;
                position: sticky !important;
                bottom: 0 !important;
                background: white !important;
                padding: 15px !important;
                margin-top: 20px !important;
                border-top: 3px solid #6200ea !important;
                box-shadow: 0 -5px 15px rgba(0,0,0,0.1) !important;
            }
            
            .quiz-bottom-nav button {
                width: 100% !important;
                padding: 15px !important;
                font-size: 16px !important;
            }
            
            .question-nav-btn {
                width: 35px !important;
                height: 35px !important;
                font-size: 13px !important;
            }
            
            .option-btn {
                padding: 12px !important;
                font-size: 15px !important;
            }
            
            .option-letter {
                width: 32px !important;
                height: 32px !important;
                font-size: 14px !important;
            }
        }
        
        @media (max-width: 480px) {
            .quiz-top-controls {
                padding: 12px !important;
                gap: 12px !important;
            }
            
            .quiz-bottom-nav {
                padding: 12px !important;
            }
            
            .question-nav-btn {
                width: 32px !important;
                height: 32px !important;
                font-size: 12px !important;
            }
            
            .option-btn {
                padding: 12px !important;
                font-size: 15px !important;
            }
            
            .question-text {
                font-size: 18px !important;
            }
        }
    `;
    
    document.head.appendChild(style);
}
    
    // Add CSS for button states
    addQuizButtonStyles();
    
    switchTab('quiz');
}

// Helper function to get starting index of a subject
function getSubjectStartIndex(quiz, subject) {
    const range = quiz.questionRanges?.[subject];
    if (!range) return 0;
    return range.start - 1;
}

// Function to switch between subjects in JAMB quiz
function switchToSubject(subject) {
    const quiz = JAMB_APP.currentQuiz;
    if (!quiz || quiz.type !== 'jamb') return;
    
    const range = quiz.questionRanges?.[subject];
    if (!range) return;
    
    // Go to first unanswered question in this subject, or first question
    const startIndex = range.start - 1;
    const endIndex = range.end - 1;
    
    // Find first unanswered question in this subject
    let firstUnanswered = startIndex;
    for (let i = startIndex; i <= endIndex; i++) {
        if (quiz.answers[i] === null) {
            firstUnanswered = i;
            break;
        }
    }
    
    quiz.currentIndex = firstUnanswered;
    quiz.currentSubject = subject;
    showQuizInterface();
}

// Jump to any question
function jumpToQuestion(index) {
    const quiz = JAMB_APP.currentQuiz;
    if (!quiz) return;
    
    if (index >= 0 && index < quiz.questions.length) {
        quiz.currentIndex = index;
        if (quiz.type === 'jamb') {
            quiz.currentSubject = quiz.questions[index]?.subject || quiz.currentSubject;
        }
        showQuizInterface();
    }
}

// Toggle jump menu
function toggleJumpMenu() {
    const jumpMenu = document.getElementById('jump-menu');
    if (!jumpMenu) return;
    
    const isMobile = window.innerWidth <= 768;
    
    if (jumpMenu.style.display === 'none' || jumpMenu.style.display === '') {
        jumpMenu.style.display = 'block';
        
        if (isMobile) {
            // On mobile, show as centered modal
            jumpMenu.style.position = 'fixed';
            jumpMenu.style.top = '50%';
            jumpMenu.style.left = '50%';
            jumpMenu.style.transform = 'translate(-50%, -50%)';
            jumpMenu.style.width = '90%';
            jumpMenu.style.maxWidth = '300px';
            
            // Add overlay
            const overlay = document.createElement('div');
            overlay.className = 'jump-menu-overlay';
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0,0,0,0.5);
                z-index: 999;
            `;
            overlay.onclick = function() {
                jumpMenu.style.display = 'none';
                document.body.removeChild(overlay);
            };
            document.body.appendChild(overlay);
            
            // Focus on input
            setTimeout(() => {
                const input = document.getElementById('jump-to-number');
                if (input) {
                    input.focus();
                    input.setAttribute('inputmode', 'numeric');
                }
            }, 100);
        }
    } else {
        jumpMenu.style.display = 'none';
        
        // Remove overlay if exists
        const overlay = document.querySelector('.jump-menu-overlay');
        if (overlay) {
            document.body.removeChild(overlay);
        }
    }
}

// Jump to specific question number
function jumpToQuestionNumber() {
    const input = document.getElementById('jump-to-number');
    if (!input) return;
    
    const quiz = JAMB_APP.currentQuiz;
    if (!quiz) return;
    
    const questionNumber = parseInt(input.value);
    if (questionNumber >= 1 && questionNumber <= quiz.questions.length) {
        jumpToQuestion(questionNumber - 1);
        
        // Close jump menu
        const jumpMenu = document.getElementById('jump-menu');
        if (jumpMenu) {
            jumpMenu.style.display = 'none';
        }
        
        // Remove overlay if exists
        const overlay = document.querySelector('.jump-menu-overlay');
        if (overlay) {
            document.body.removeChild(overlay);
        }
    } else {
        showAlert(`Please enter a number between 1 and ${quiz.questions.length}`, 'error');
    }
}

function selectAnswer(answerIndex) {
    const quiz = JAMB_APP.currentQuiz;
    const current = quiz.currentIndex;
    
    // If already selected this answer, deselect it
    if (quiz.answers[current] === answerIndex) {
        quiz.answers[current] = null;
        // Decrease score if it was correct
        if (answerIndex === quiz.questions[current].correctAnswer) {
            quiz.score--;
        }
    } else {
        // If previously selected a different answer
        if (quiz.answers[current] !== null) {
            // Decrease score if previous answer was correct
            if (quiz.answers[current] === quiz.questions[current].correctAnswer) {
                quiz.score--;
            }
            // Increase score if new answer is correct
            if (answerIndex === quiz.questions[current].correctAnswer) {
                quiz.score++;
            }
        } else {
            // First time answering this question
            if (answerIndex === quiz.questions[current].correctAnswer) {
                quiz.score++;
            }
        }
        
        // Set new answer
        quiz.answers[current] = answerIndex;
    }
    
    showQuizInterface();
}

function previousQuestion() {
    const quiz = JAMB_APP.currentQuiz;
    if (quiz.currentIndex > 0) {
        quiz.currentIndex--;
        if (quiz.type === 'jamb') {
            quiz.currentSubject = quiz.questions[quiz.currentIndex]?.subject || quiz.currentSubject;
        }
        showQuizInterface();
    }
}

function nextQuestion() {
    const quiz = JAMB_APP.currentQuiz;
    
    // If we're at the last question, end the quiz
    if (quiz.currentIndex >= quiz.questions.length - 1) {
        // Check if there are unanswered questions
        const unanswered = quiz.answers.filter(answer => answer === null).length;
        
        if (unanswered > 0) {
            if (confirm(`You have ${unanswered} unanswered questions. Do you want to finish the quiz anyway?`)) {
                endQuiz();
            }
        } else {
            endQuiz();
        }
        return;
    }
    
    quiz.currentIndex++;
    if (quiz.type === 'jamb') {
        quiz.currentSubject = quiz.questions[quiz.currentIndex]?.subject || quiz.currentSubject;
    }
    showQuizInterface();
}

// Close jump menu when clicking outside
document.addEventListener('click', function(event) {
    const jumpMenu = document.getElementById('jump-menu');
    const jumpButton = document.querySelector('button[onclick="toggleJumpMenu()"]');
    
    if (jumpMenu && jumpButton && 
        !jumpMenu.contains(event.target) && 
        !jumpButton.contains(event.target)) {
        jumpMenu.style.display = 'none';
    }
});

function markForReview() {
    const quiz = JAMB_APP.currentQuiz;
    if (!quiz.review) quiz.review = [];
    
    const index = quiz.currentIndex;
    if (!quiz.review.includes(index)) {
        quiz.review.push(index);
        showAlert('Question marked for review', 'success');
    } else {
        const reviewIndex = quiz.review.indexOf(index);
        quiz.review.splice(reviewIndex, 1);
        showAlert('Question removed from review', 'info');
    }
    
    // Refresh interface to update button text
    showQuizInterface();
}

// ================ QUIZ RESULTS FUNCTIONS ================
function endQuiz() {
    const quiz = JAMB_APP.currentQuiz;
    if (!quiz) return;
    
    // Disable exam mode
    if (examMode) {
        disableExamMode();
    }
    
    endTimer();
    const endTime = new Date();
    const timeTaken = Math.floor((endTime - quiz.startTime) / 1000);
    const minutes = Math.floor(timeTaken / 60);
    const seconds = timeTaken % 60;

    // Calculate scores
    const isFullJAMB = quiz.type === 'jamb' && quiz.subjects && quiz.subjects.length >= 2;
    const jambTotal = isFullJAMB ? 400 : 100; // Full JAMB = 400, single subject = 100
    const jambScore = Math.round((quiz.score / quiz.questions.length) * jambTotal);
    const jambPercentage = Math.round((jambScore / jambTotal) * 100);

    const result = {
        id: Date.now(),
        type: quiz.type,
        date: endTime.toISOString(),
        timeTaken: `${minutes}:${seconds.toString().padStart(2, '0')}`,
        timerUsed: quiz.timerUsed,
        timerSetting: quiz.timerSetting,
        totalScore: quiz.score,
        totalQuestions: quiz.questions.length,
        percentage: Math.round((quiz.score / quiz.questions.length) * 100),
        // JAMB SCORE FIELDS
        jambScore: jambScore,
        jambTotal: jambTotal,
        jambPercentage: jambPercentage,
        isFullJAMB: isFullJAMB,
        details: {}
    };

    if (quiz.type === 'jamb') {
        quiz.subjects.forEach(subject => {
            const subjectQuestions = quiz.questions.filter(q => q.subject === subject);
            const subjectAnswers = subjectQuestions.map((q, idx) =>
                quiz.answers[quiz.questions.indexOf(q)]
            );
            const subjectCorrect = subjectAnswers.filter((answer, idx) =>
                answer === subjectQuestions[idx].correctAnswer
            ).length;
            
            // Calculate JAMB score for this subject (out of 100)
            const subjectJambScore = Math.round((subjectCorrect / subjectQuestions.length) * 100);
            
            result.details[subject] = {
                score: subjectCorrect,
                total: subjectQuestions.length,
                percentage: Math.round((subjectCorrect / subjectQuestions.length) * 100),
                jambScore: subjectJambScore,
                jambTotal: 100
            };
        });
    } else {
        // Single subject quiz
        const subject = quiz.subject;
        const subjectName = JAMB_APP.allSubjects[subject]?.name || subject;
        const subjectJambScore = Math.round((quiz.score / quiz.questions.length) * 100);
        
        result.details[subject] = {
            score: quiz.score,
            total: quiz.questions.length,
            percentage: Math.round((quiz.score / quiz.questions.length) * 100),
            jambScore: subjectJambScore,
            jambTotal: 100
        };
        result.subjectName = subjectName;
    }

    quiz.results = result;
    JAMB_APP.results.push(result);
    saveToStorage();
    showQuizResults(result);
}

function showQuizResults(result) {
    let html = `
        <div style="text-align: center; padding: 20px;">
            <h2><i class="fas fa-trophy"></i> Quiz Complete!</h2>
            
            <!-- JAMB Score Display -->
            <div style="background: linear-gradient(135deg, #6200ea, #3700b3); color: white; padding: 25px; border-radius: 15px; margin: 20px 0;">
                <h3 style="margin-bottom: 15px; font-size: 22px;">
                    <i class="fas fa-graduation-cap"></i> 
                    ${result.isFullJAMB ? 'JAMB SCORE (OUT OF 400)' : 'SUBJECT SCORE (OUT OF 100)'}
                </h3>
                <div style="font-size: 64px; font-weight: bold; margin: 20px 0; color: #ff9800;">
                    ${result.jambScore}<span style="font-size: 24px; color: rgba(255,255,255,0.8);">/${result.jambTotal}</span>
                </div>
                <div style="font-size: 20px; background: rgba(255,255,255,0.1); padding: 10px; border-radius: 10px;">
                    ${result.jambPercentage}%
                </div>
            </div>
            
            <!-- Original Score -->
            <div style="background: #f8f9fa; padding: 15px; border-radius: 10px; margin: 15px 0;">
                <h4 style="color: #666; margin-bottom: 10px;">Raw Score</h4>
                <div style="font-size: 28px; color: #333; font-weight: bold;">
                    ${result.totalScore}/${result.totalQuestions} 
                    <span style="font-size: 18px; color: #666;">(${result.percentage}%)</span>
                </div>
                <p>Time taken: ${result.timeTaken}</p>
                ${result.timerUsed ? `<p>Timer setting: ${result.timerSetting} minutes</p>` : ''}
            </div>
            
            <div style="margin: 20px 0;">
                <button class="btn" onclick="reviewQuiz()" style="margin: 5px;">
                    <i class="fas fa-search"></i> Review Answers
                </button>
                <button class="btn" onclick="resetQuizAndGoToSetup()" style="margin: 5px;">
                    <i class="fas fa-home"></i> Quiz Home
                </button>
                <button class="btn" onclick="startFullJAMBQuiz()" style="margin: 5px;">
                    <i class="fas fa-redo"></i> Try Again
                </button>
                <button class="btn btn-secondary" onclick="switchTab('results')" style="margin: 5px;">
                    <i class="fas fa-chart-bar"></i> View All Results
                </button>
            </div>
            <div class="results-grid" style="margin: 30px 0;">
    `;
    Object.entries(result.details).forEach(([subject, details]) => {
        const subjectInfo = JAMB_APP.allSubjects[subject];
        const jambPercentage = Math.round((details.jambScore / details.jambTotal) * 100);
        
        html += `
            <div class="result-card" style="background: white; border: 2px solid #e0e0e0; border-radius: 10px; padding: 20px; text-align: center;">
                <div class="subject-name" style="color: #6200ea; margin-bottom: 15px; font-size: 18px; font-weight: bold;">
                    <i class="fas fa-${subjectInfo?.icon || 'book'}"></i> ${subjectInfo?.name || subject}
                </div>
                
                <!-- JAMB Score for Subject -->
                <div style="background: #e8eaf6; padding: 15px; border-radius: 8px; margin-bottom: 10px;">
                    <div style="font-size: 12px; color: #666; margin-bottom: 5px;">JAMB Score</div>
                    <div style="font-size: 32px; font-weight: bold; color: #6200ea;">
                        ${details.jambScore}<span style="font-size: 16px; color: #666;">/${details.jambTotal}</span>
                    </div>
                    <div style="font-size: 14px; color: #666;">${jambPercentage}%</div>
                </div>
                
                <!-- Raw Score -->
                <div style="font-size: 14px; color: #333;">
                    <strong>Raw:</strong> ${details.score}/${details.total} (${details.percentage}%)
                </div>
            </div>
        `;
    });
    html += `
        </div>
        </div>
    `;
    document.getElementById('quizContainer').innerHTML = html;
}

function reviewQuiz() {
    const quiz = JAMB_APP.currentQuiz;
    if (!quiz) return;
    quiz.reviewMode = true;
    quiz.currentIndex = 0;
    showReviewInterface();
}

function showReviewInterface() {
    const quiz = JAMB_APP.currentQuiz;
    if (!quiz || !quiz.reviewMode) return;
    const currentQuestion = quiz.questions[quiz.currentIndex];
    const userAnswer = quiz.answers[quiz.currentIndex];
    const isCorrect = userAnswer === currentQuestion.correctAnswer;
    
    let html = `
        <div style="text-align: center; padding: 20px;">
            <h2><i class="fas fa-search"></i> Review Answers</h2>
            <p>Question ${quiz.currentIndex + 1} of ${quiz.questions.length}</p>
            <div class="progress-container" style="margin: 20px 0;">
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${((quiz.currentIndex + 1) / quiz.questions.length) * 100}%"></div>
                </div>
            </div>
        </div>
        <div class="question-box">
    `;
    
   // Always show subject indicator
const currentSubject = quiz.type === 'jamb' ? currentQuestion.subject : quiz.subject;
const subjectInfo = JAMB_APP.allSubjects[currentSubject];
if (subjectInfo) {
    html += `
        <div style="margin-bottom: 15px;">
            <span class="selected-subject-tag" style="font-size: 16px; padding: 10px 20px;">
                <i class="fas fa-${subjectInfo.icon || 'book'}"></i>
                ${subjectInfo.name} ${quiz.type === 'subject' ? '(Practice Quiz)' : ''}
            </span>
        </div>
    `;
}
    html += `
            <div class="question-text">${currentQuestion.question}</div>
            <div class="options-grid">
    `;
    
    currentQuestion.options.forEach((option, index) => {
        let buttonClass = 'option-btn';
        if (index === currentQuestion.correctAnswer) {
            buttonClass += ' correct';
        } else if (index === userAnswer && index !== currentQuestion.correctAnswer) {
            buttonClass += ' incorrect';
        } else if (index === userAnswer) {
            buttonClass += ' selected';
        }
        html += `
            <div class="${buttonClass}" style="cursor: default;">
                <span class="option-letter">${String.fromCharCode(65 + index)}</span>
                <span>${option}</span>
                ${index === currentQuestion.correctAnswer ?
                    '<span style="margin-left: 10px; color: #2e7d32;"><i class="fas fa-check-circle"></i> Correct Answer</span>' :
                    ''}
                ${index === userAnswer && index !== currentQuestion.correctAnswer ?
                    '<span style="margin-left: 10px; color: #c62828;"><i class="fas fa-times-circle"></i> Your Answer</span>' :
                    ''}
            </div>
        `;
    });
    
    html += `
        </div>
        <div style="margin-top: 25px; padding: 15px; background: ${isCorrect ? '#e8f5e9' : '#ffebee'}; border-radius: 8px;">
            <strong><i class="fas fa-lightbulb"></i> Explanation:</strong>
            ${currentQuestion.explanation || 'No explanation provided'}
            <div style="margin-top: 10px; padding: 10px; background: ${isCorrect ? '#c8e6c9' : '#ffcdd2'}; border-radius: 5px;">
                <strong>Your answer: </strong>${userAnswer !== null ?
                    `${String.fromCharCode(65 + userAnswer)}. ${currentQuestion.options[userAnswer]}` :
                    'Not answered'}
                ${isCorrect ?
                    '<span style="color: #2e7d32; margin-left: 10px;"><i class="fas fa-check"></i> Correct!</span>' :
                    '<span style="color: #c62828; margin-left: 10px;"><i class="fas fa-times"></i> Incorrect</span>'}
            </div>
        </div>
        </div>
        <div class="quiz-navigation">
            <div>
                <button class="btn btn-secondary" onclick="previousReviewQuestion()" ${quiz.currentIndex === 0 ? 'disabled' : ''}>
                    <i class="fas fa-arrow-left"></i> Previous
                </button>
                <button class="btn" onclick="backToResults()" style="background: #6200ea; margin-left: 10px;">
                    <i class="fas fa-arrow-left"></i> Back to Results
                </button>
            </div>
            <div>
                <button class="btn" onclick="nextReviewQuestion()">
                    ${quiz.currentIndex === quiz.questions.length - 1 ? 'Finish Review' : 'Next Question'}
                    <i class="fas fa-arrow-right"></i>
                </button>
            </div>
        </div>
        <div style="margin-top: 30px; text-align: center;">
            <div style="display: flex; justify-content: center; flex-wrap: wrap; gap: 5px; margin-bottom: 10px;">
    `;
    
    for (let i = 0; i < quiz.questions.length; i++) {
        const question = quiz.questions[i];
        const answer = quiz.answers[i];
        const isCorrectQ = answer === question.correctAnswer;
        const dotClass = i === quiz.currentIndex ? 'question-dot current' :
                         answer === null ? 'question-dot unanswered' :
                         isCorrectQ ? 'question-dot answered' : 'question-dot incorrect';
        html += `
            <div class="${dotClass}" onclick="goToReviewQuestion(${i})">
                ${i + 1}
            </div>
        `;
    }
    
    html += `
        </div>
        <div style="font-size: 12px; color: #666;">
            <span style="display: inline-block; width: 10px; height: 10px; background: #4caf50; border-radius: 50%; margin-right: 5px;"></span> Correct
            <span style="display: inline-block; width: 10px; height: 10px; background: #f44336; border-radius: 50%; margin-left: 15px; margin-right: 5px;"></span> Incorrect
            <span style="display: inline-block; width: 10px; height: 10px; background: #f5f5f5; border-radius: 50%; margin-left: 15px; margin-right: 5px; border: 1px solid #ddd;"></span> Unanswered
        </div>
        </div>
    `;
    
    document.getElementById('quizContainer').innerHTML = html;
}

function nextReviewQuestion() {
    const quiz = JAMB_APP.currentQuiz;
    if (!quiz || !quiz.reviewMode) return;
    if (quiz.currentIndex < quiz.questions.length - 1) {
        quiz.currentIndex++;
        showReviewInterface();
    } else {
        quiz.reviewMode = false;
        showQuizResults(quiz.results);
    }
}

function previousReviewQuestion() {
    const quiz = JAMB_APP.currentQuiz;
    if (!quiz || !quiz.reviewMode) return;
    if (quiz.currentIndex > 0) {
        quiz.currentIndex--;
        showReviewInterface();
    }
}

function goToReviewQuestion(index) {
    const quiz = JAMB_APP.currentQuiz;
    if (!quiz || !quiz.reviewMode) return;
    if (index >= 0 && index < quiz.questions.length) {
        quiz.currentIndex = index;
        showReviewInterface();
    }
}

function backToResults() {
    const quiz = JAMB_APP.currentQuiz;
    if (!quiz) return;
    quiz.reviewMode = false;
    showQuizResults(quiz.results);
}

function resetQuizAndGoToSetup() {
    JAMB_APP.currentQuiz = null;
    endTimer();
    
    // Make sure exam mode is disabled
    if (examMode) {
        disableExamMode();
    }
    
    switchTab('quiz');
    updateQuizTab();
}

// ================ RESULTS TAB FUNCTIONS ================
function updateResultsTab() {
    const container = document.getElementById('results-grid');
    if (JAMB_APP.results.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 40px 20px; grid-column: 1 / -1;">
                <i class="fas fa-chart-line" style="font-size: 64px; color: #ddd; margin-bottom: 20px;"></i>
                <h3>No Results Yet</h3>
                <p>Complete a quiz to see your performance here</p>
            </div>
        `;
        document.getElementById('performance-section').style.display = 'none';
        return;
    }
    
    const latestResults = JAMB_APP.results.slice(-5).reverse();
    container.innerHTML = '';
    latestResults.forEach(result => {
        const resultCard = document.createElement('div');
        resultCard.className = 'result-card';
        resultCard.style.gridColumn = '1 / -1';
        resultCard.style.textAlign = 'left';
        const date = new Date(result.date);
        const dateStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
        let detailsHtml = '';
        Object.entries(result.details).forEach(([subject, details]) => {
            const subjectInfo = JAMB_APP.allSubjects[subject];
            const percentage = Math.round((details.score / details.total) * 100);
            const jambPercentage = Math.round((details.jambScore / details.jambTotal) * 100);
            
            detailsHtml += `
                <div style="display: flex; justify-content: space-between; margin: 5px 0; padding: 8px; background: #f5f5f5; border-radius: 5px; align-items: center;">
                    <span style="display: flex; align-items: center; gap: 8px;">
                        <i class="fas fa-${subjectInfo?.icon || 'book'}" style="color: #6200ea;"></i>
                        ${subjectInfo?.name || subject}
                    </span>
                    <span style="text-align: right;">
                        <div style="font-weight: 500; color: ${percentage >= 70 ? '#4caf50' : percentage >= 50 ? '#ff9800' : '#f44336'}">
                            <strong>${details.score}/${details.total}</strong> (${percentage}%)
                        </div>
                        <div style="font-size: 12px; color: #666;">
                            JAMB: ${details.jambScore}/${details.jambTotal} (${jambPercentage}%)
                        </div>
                    </span>
                </div>
            `;
        });
        const quizType = result.type === 'jamb' ? '🎯 JAMB Simulation' : '📚 Practice Quiz';
        const subjectName = result.subjectName ? ` - ${result.subjectName}` : '';
        const percentage = Math.round((result.totalScore / result.totalQuestions) * 100);
        const jambPercentage = Math.round((result.jambScore / result.jambTotal) * 100);
        const cardColor = percentage >= 70 ? '#4caf50' : percentage >= 50 ? '#ff9800' : '#f44336';
        const jambColor = jambPercentage >= 70 ? '#4caf50' : jambPercentage >= 50 ? '#ff9800' : '#f44336';
        
        resultCard.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                <h3 style="color: ${cardColor};">${quizType}${subjectName}</h3>
                <span style="color: #666; font-size: 14px;">${dateStr}</span>
            </div>
            <div style="text-align: center; margin: 15px 0;">
                <!-- JAMB Score -->
                <div style="background: #e8eaf6; padding: 15px; border-radius: 10px; margin-bottom: 10px;">
                    <div style="font-size: 16px; color: #6200ea; margin-bottom: 5px;">
                        ${result.isFullJAMB ? 'JAMB Score (400)' : 'Subject Score (100)'}
                    </div>
                    <div style="font-size: 32px; font-weight: bold; color: ${jambColor};">${result.jambScore}<span style="font-size: 18px; color: #666;">/${result.jambTotal}</span></div>
                    <div style="font-size: 16px; color: ${jambColor};">${jambPercentage}%</div>
                </div>
                
                <!-- Raw Score -->
                <div style="font-size: 20px; color: #333;">
                    <strong>Raw:</strong> ${result.totalScore}/${result.totalQuestions} (${percentage}%)
                </div>
                <div style="color: #666; font-size: 14px;">Time: ${result.timeTaken}</div>
                ${result.timerUsed ? `<div style="color: #666; font-size: 12px;">Timer: ${result.timerSetting} minutes</div>` : ''}
            </div>
            ${detailsHtml}
            <div style="margin-top: 15px; text-align: center;">
                <button class="btn" onclick="viewResultDetails('${result.id}')" style="padding: 8px 15px; font-size: 14px;">
                    <i class="fas fa-eye"></i> View Details
                </button>
            </div>
        `;
        container.appendChild(resultCard);
    });
    
    // Update performance analytics
    updatePerformanceAnalytics();
}

function viewResultDetails(resultId) {
    const result = JAMB_APP.results.find(r => r.id === Number(resultId));
    if (!result) return;
    
    alert(`Detailed Result Analysis:
    
JAMB Score: ${result.jambScore}/${result.jambTotal} (${result.jambPercentage}%)
Raw Score: ${result.totalScore}/${result.totalQuestions} (${result.percentage}%)
Time Taken: ${result.timeTaken}
Date: ${new Date(result.date).toLocaleString()}

Breakdown by Subject:
${Object.entries(result.details).map(([subject, details]) => {
    const subjectInfo = JAMB_APP.allSubjects[subject];
    const jambPercentage = Math.round((details.jambScore / details.jambTotal) * 100);
    return `${subjectInfo?.name || subject}: 
    - Raw: ${details.score}/${details.total} (${details.percentage}%)
    - JAMB: ${details.jambScore}/${details.jambTotal} (${jambPercentage}%)`;
}).join('\n')}`);
}

// ================ PERFORMANCE ANALYTICS FUNCTIONS ================
function updatePerformanceAnalytics() {
    const performanceSection = document.getElementById('performance-section');
    const statsGrid = document.getElementById('stats-grid');
    
    if (JAMB_APP.results.length === 0) {
        performanceSection.style.display = 'none';
        return;
    }
    
    performanceSection.style.display = 'block';
    
    // Calculate statistics
    const stats = calculatePerformanceStats();
    
    // Update statistics grid
    statsGrid.innerHTML = `
        <div class="stat-box total-attempts">
            <div class="stat-value">${stats.totalAttempts}</div>
            <div class="stat-label">Total Attempts</div>
        </div>
        <div class="stat-box average-score">
            <div class="stat-value">${stats.averageScore}%</div>
            <div class="stat-label">Average Score</div>
        </div>
        <div class="stat-box best-subject">
            <div class="stat-value">${stats.bestSubject}</div>
            <div class="stat-label">Best Subject</div>
        </div>
        <div class="stat-box">
            <div class="stat-value">${stats.averageJAMBScore}/${stats.jambTotal}</div>
            <div class="stat-label">Avg JAMB Score</div>
        </div>
    `;
    
    // Render charts
    renderCharts(stats);
}

function calculatePerformanceStats() {
    if (JAMB_APP.results.length === 0) {
        return {
            totalAttempts: 0,
            averageScore: 0,
            bestSubject: 'N/A',
            improvementRate: 0,
            averageJAMBScore: 0,
            jambTotal: 400,
            subjectPerformance: {},
            progressData: [],
            radarData: {}
        };
    }
    
    const stats = {
        totalAttempts: JAMB_APP.results.length,
        averageScore: 0,
        bestSubject: '',
        bestSubjectScore: 0,
        improvementRate: 0,
        averageJAMBScore: 0,
        jambTotal: 0,
        subjectPerformance: {},
        progressData: [],
        radarData: {
            subjects: [],
            scores: []
        }
    };
    
    // Calculate average score and progress over time
    let totalScore = 0;
    let totalJAMBScore = 0;
    let totalJAMBTotal = 0;
    
    JAMB_APP.results.forEach((result, index) => {
        totalScore += result.percentage;
        totalJAMBScore += result.jambScore;
        totalJAMBTotal += result.jambTotal;
        
        // Progress data for line chart
        stats.progressData.push({
            attempt: index + 1,
            score: result.percentage,
            jambScore: result.jambScore,
            jambTotal: result.jambTotal,
            date: new Date(result.date).toLocaleDateString()
        });
        
        // Collect subject performance data
        Object.entries(result.details).forEach(([subject, details]) => {
            if (!stats.subjectPerformance[subject]) {
                stats.subjectPerformance[subject] = {
                    totalScore: 0,
                    totalQuestions: 0,
                    correctAnswers: 0,
                    attempts: 0,
                    jambScore: 0,
                    jambTotal: 0,
                    name: JAMB_APP.allSubjects[subject]?.name || subject
                };
            }
            
            stats.subjectPerformance[subject].totalScore += details.percentage;
            stats.subjectPerformance[subject].correctAnswers += details.score;
            stats.subjectPerformance[subject].totalQuestions += details.total;
            stats.subjectPerformance[subject].jambScore += details.jambScore;
            stats.subjectPerformance[subject].jambTotal += details.jambTotal;
            stats.subjectPerformance[subject].attempts++;
        });
    });
    
    // Calculate average score
    stats.averageScore = Math.round(totalScore / JAMB_APP.results.length);
    stats.averageJAMBScore = Math.round(totalJAMBScore / JAMB_APP.results.length);
    stats.jambTotal = Math.round(totalJAMBTotal / JAMB_APP.results.length);
    
    // Calculate improvement rate (compare first half vs second half)
    if (JAMB_APP.results.length >= 2) {
        const midIndex = Math.floor(JAMB_APP.results.length / 2);
        const firstHalf = JAMB_APP.results.slice(0, midIndex);
        const secondHalf = JAMB_APP.results.slice(midIndex);
        
        const firstHalfAvg = firstHalf.reduce((sum, r) => sum + r.percentage, 0) / firstHalf.length;
        const secondHalfAvg = secondHalf.reduce((sum, r) => sum + r.percentage, 0) / secondHalf.length;
        
        stats.improvementRate = Math.round(((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100);
    }
    
    // Find best subject
    Object.entries(stats.subjectPerformance).forEach(([subject, data]) => {
        const average = Math.round(data.totalScore / data.attempts);
        const jambAverage = Math.round(data.jambScore / data.attempts);
        
        if (average > stats.bestSubjectScore) {
            stats.bestSubjectScore = average;
            stats.bestSubject = data.name;
        }
        
        // Prepare radar chart data
        stats.radarData.subjects.push(data.name);
        stats.radarData.scores.push(average);
    });
    
    return stats;
}

function renderCharts(stats) {
    // Destroy existing charts if they exist
    if (window.overallChart && typeof window.overallChart.destroy === 'function') {
        window.overallChart.destroy();
    }
    if (window.subjectChart && typeof window.subjectChart.destroy === 'function') {
        window.subjectChart.destroy();
    }
    if (window.radarChart && typeof window.radarChart.destroy === 'function') {
        window.radarChart.destroy();
    }
    
    if (stats.totalAttempts === 0) return;
    
    // Chart colors
    const chartColors = {
        primary: 'rgba(98, 0, 234, 0.8)',
        secondary: 'rgba(55, 0, 179, 0.8)',
        success: 'rgba(76, 175, 80, 0.8)',
        warning: 'rgba(255, 152, 0, 0.8)',
        danger: 'rgba(244, 67, 54, 0.8)',
        gridColor: 'rgba(0, 0, 0, 0.05)'
    };
    
    // 1. Overall Progress Line Chart
    const overallCanvas = document.getElementById('overallProgressChart');
    if (overallCanvas) {
        const overallCtx = overallCanvas.getContext('2d');
        const labels = stats.progressData.map(data => `Attempt ${data.attempt}`);
        const scores = stats.progressData.map(data => data.score);
        const jambScores = stats.progressData.map(data => Math.round((data.jambScore / data.jambTotal) * 100));
        const dates = stats.progressData.map(data => data.date);
        
        window.overallChart = new Chart(overallCtx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Score (%)',
                    data: scores,
                    borderColor: chartColors.primary,
                    backgroundColor: chartColors.primary.replace('0.8', '0.1'),
                    borderWidth: 3,
                    fill: true,
                    tension: 0.3,
                    pointBackgroundColor: chartColors.primary,
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointRadius: 6,
                    pointHoverRadius: 8
                },
                {
                    label: 'JAMB Score (%)',
                    data: jambScores,
                    borderColor: chartColors.success,
                    backgroundColor: chartColors.success.replace('0.8', '0.1'),
                    borderWidth: 3,
                    fill: false,
                    tension: 0.3,
                    pointBackgroundColor: chartColors.success,
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointRadius: 6,
                    pointHoverRadius: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const dataIndex = context.dataIndex;
                                if (context.datasetIndex === 0) {
                                    return [
                                        `Score: ${context.parsed.y}%`,
                                        `Date: ${dates[dataIndex]}`
                                    ];
                                } else {
                                    return [
                                        `JAMB Score: ${context.parsed.y}%`,
                                        `Date: ${dates[dataIndex]}`
                                    ];
                                }
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        grid: {
                            color: chartColors.gridColor
                        },
                        ticks: {
                            callback: function(value) {
                                return value + '%';
                            }
                        }
                    },
                    x: {
                        grid: {
                            color: chartColors.gridColor
                        }
                    }
                }
            }
        });
    }
    
    // 2. Subject Performance Bar Chart
    const subjectCanvas = document.getElementById('subjectPerformanceChart');
    if (subjectCanvas) {
        const subjectCtx = subjectCanvas.getContext('2d');
        const subjectNames = Object.values(stats.subjectPerformance).map(data => data.name);
        const subjectAverages = Object.values(stats.subjectPerformance).map(data => 
            Math.round(data.totalScore / data.attempts)
        );
        const subjectJAMB = Object.values(stats.subjectPerformance).map(data => 
            Math.round(data.jambScore / data.attempts)
        );
        
        window.subjectChart = new Chart(subjectCtx, {
            type: 'bar',
            data: {
                labels: subjectNames,
                datasets: [{
                    label: 'Average Score (%)',
                    data: subjectAverages,
                    backgroundColor: chartColors.primary.replace('0.8', '0.6'),
                    borderColor: chartColors.primary.replace('0.8', '1'),
                    borderWidth: 1,
                    borderRadius: 5
                },
                {
                    label: 'JAMB Score',
                    data: subjectJAMB,
                    backgroundColor: chartColors.success.replace('0.8', '0.6'),
                    borderColor: chartColors.success.replace('0.8', '1'),
                    borderWidth: 1,
                    borderRadius: 5
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const subject = stats.subjectPerformance[Object.keys(stats.subjectPerformance)[context.dataIndex]];
                                if (context.datasetIndex === 0) {
                                    return `Average: ${context.parsed.y}%`;
                                } else {
                                    return `JAMB: ${context.parsed.y}%`;
                                }
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        grid: {
                            color: chartColors.gridColor
                        },
                        ticks: {
                            callback: function(value) {
                                return value + '%';
                            }
                        }
                    },
                    x: {
                        grid: {
                            color: chartColors.gridColor
                        }
                    }
                }
            }
        });
    }
    
    // 3. Strengths & Weaknesses Radar Chart
    const radarCanvas = document.getElementById('radarChart');
    if (radarCanvas) {
        if (stats.radarData.subjects.length >= 3) {
            const radarCtx = radarCanvas.getContext('2d');
            
            window.radarChart = new Chart(radarCtx, {
                type: 'radar',
                data: {
                    labels: stats.radarData.subjects,
                    datasets: [{
                        label: 'Performance (%)',
                        data: stats.radarData.scores,
                        backgroundColor: chartColors.primary.replace('0.8', '0.2'),
                        borderColor: chartColors.primary,
                        borderWidth: 2,
                        pointBackgroundColor: chartColors.primary,
                        pointBorderColor: '#fff',
                        pointBorderWidth: 2,
                        pointRadius: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        r: {
                            beginAtZero: true,
                            max: 100,
                            ticks: {
                                stepSize: 20,
                                callback: function(value) {
                                    return value + '%';
                                }
                            },
                            grid: {
                                color: chartColors.gridColor
                            },
                            pointLabels: {
                                font: {
                                    size: 12
                                }
                            }
                        }
                    },
                    plugins: {
                        legend: {
                            display: false
                        }
                    }
                }
            });
        } else {
            const radarContainer = radarCanvas.parentElement;
            radarContainer.innerHTML = `
                <div class="no-data-message">
                    <i class="fas fa-chart-pie"></i>
                    <p>Complete at least 3 different subjects<br>to see radar chart</p>
                </div>
            `;
        }
    }
}

function cleanupCharts() {
    if (window.overallChart && typeof window.overallChart.destroy === 'function') {
        window.overallChart.destroy();
        window.overallChart = null;
    }
    if (window.subjectChart && typeof window.subjectChart.destroy === 'function') {
        window.subjectChart.destroy();
        window.subjectChart = null;
    }
    if (window.radarChart && typeof window.radarChart.destroy === 'function') {
        window.radarChart.destroy();
        window.radarChart = null;
    }
}

// Call cleanup when page is unloaded
window.addEventListener('beforeunload', cleanupCharts);

// Mobile touch support for question navigation
function setupMobileTouchSupport() {
    let touchStartY = 0;
    let touchEndY = 0;
    
    document.addEventListener('touchstart', function(e) {
        touchStartY = e.changedTouches[0].screenY;
    });
    
    document.addEventListener('touchend', function(e) {
        touchEndY = e.changedTouches[0].screenY;
        handleSwipe();
    });
    
    function handleSwipe() {
        const swipeThreshold = 50; // Minimum swipe distance in pixels
        
        // Swipe down to show jump menu
        if (touchStartY - touchEndY > swipeThreshold) {
            // Swipe up - scroll to top
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }
}
// ================ MOBILE NAVIGATION HANDLER ================
function setupMobileNavigation() {
    // Check if mobile
    function isMobile() {
        return window.innerWidth <= 768;
    }
    
    // Update tab active state based on scroll
    function updateActiveTabOnScroll() {
        if (!isMobile()) return;
        
        const tabs = document.querySelectorAll('.tab');
        const tabContents = document.querySelectorAll('.tab-content');
        let activeTab = 'setup';
        
        // Find which tab content is most visible
        tabContents.forEach(content => {
            const rect = content.getBoundingClientRect();
            if (rect.top < window.innerHeight / 2 && rect.bottom > window.innerHeight / 2) {
                const tabName = content.id.replace('tab-', '');
                activeTab = tabName;
            }
        });
        
        // Update active tab
        tabs.forEach(tab => {
            const tabText = tab.querySelector('span').textContent.toLowerCase();
            if (tabText === activeTab) {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        });
    }
    
    // Handle tab click animations
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', function() {
            if (!isMobile()) return;
            
            // Add click feedback
            this.style.transform = 'scale(0.95)';
            setTimeout(() => {
                this.style.transform = '';
            }, 200);
        });
    });
    
    // Update on scroll
    window.addEventListener('scroll', updateActiveTabOnScroll);
    
    // Initial update
    updateActiveTabOnScroll();
    
    console.log('Mobile navigation initialized');
}

// ================ INITIALIZATION ================
document.addEventListener('DOMContentLoaded', function () {
    console.log('JAMB Test Driller Initializing...');
    
    // Initialize question arrays for all subjects
    Object.keys(JAMB_APP.allSubjects).forEach(subject => {
        if (!JAMB_APP.questions[subject]) {
            JAMB_APP.questions[subject] = [];
        }
    });
    
    loadFromStorage();
    fixAPKScrolling();
    setupSubjectCheckboxes();
    setupSettingsListeners();
    updateSetupUI();
    setupMobileTouchSupport();
    setupMobileNavigation(); // Add this line
    
    // Load questions from data folder
    loadQuestionsFromDataFolder();
    
    // Force update UI settings after everything loads
    setTimeout(() => {
        updateTimerSettingsUI();
        updateQuestionSettingsUI();
    }, 1000);
    
    console.log('JAMB Test Driller initialized successfully');
});