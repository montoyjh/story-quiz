import { GoogleGenerativeAI } from '@google/generative-ai';
import * as wanakana from 'wanakana';

class StoryQuizApp {
    constructor() {
        this.wanikaniToken = localStorage.getItem('wanikani_api_token');
        this.geminiKey = localStorage.getItem('gemini_api_key');
        this.selectedItems = [];
        this.story = '';
        this.quizItems = [];
        this.currentQuizIndex = 0;
        this.quizScore = 0;
        this.geminiClient = null;

        // Review tracking for WaniKani submission
        this.assignmentMap = new Map(); // subjectId -> assignmentId
        this.srsStageMap = new Map(); // subjectId -> current SRS stage
        this.reviewResults = new Map(); // subjectId -> { meaning: bool|null, reading: bool|null, meaningIncorrect: number, readingIncorrect: number, newSrsStage: number|null }
        this.lastAnswerResult = null; // Track last answer for undo
        this.undoTimeout = null;
        this.wanakanaBound = false; // Track if wanakana is bound to input
        this.totalOriginalQuestions = 0; // Track original question count for progress
        this.correctlyAnswered = new Set(); // Track questions answered correctly (by unique key)

        this.initializeElements();
        this.initializeEventListeners();

        if (this.wanikaniToken && this.geminiKey) {
            this.initializeGeminiClient();
            this.showMainContent();
        } else {
            this.showApiSetup();
        }
    }

    initializeElements() {
        this.elements = {
            apiSetup: document.getElementById('apiSetup'),
            mainContent: document.getElementById('mainContent'),
            loading: document.getElementById('loading'),
            error: document.getElementById('error'),
            errorMessage: document.getElementById('errorMessage'),
            loadingText: document.getElementById('loadingText'),

            // API Setup
            wanikaniToken: document.getElementById('wanikaniToken'),
            geminiKey: document.getElementById('geminiKey'),
            saveKeys: document.getElementById('saveKeys'),
            validateWanikani: document.getElementById('validateWanikani'),
            validateGemini: document.getElementById('validateGemini'),
            clearKeys: document.getElementById('clearKeys'),
            wanikaniStatus: document.getElementById('wanikaniStatus'),
            geminiStatus: document.getElementById('geminiStatus'),
            statusMessage: document.getElementById('statusMessage'),

            // Item Cards
            itemCardsSection: document.getElementById('itemCardsSection'),
            itemCardsContainer: document.getElementById('itemCardsContainer'),

            // Quiz Config
            quizConfig: document.getElementById('quizConfig'),
            vocabCount: document.getElementById('vocabCount'),
            kanjiCount: document.getElementById('kanjiCount'),

            // Story
            storySection: document.getElementById('storySection'),
            storyText: document.getElementById('storyText'),
            generateQuiz: document.getElementById('generateQuiz'),
            startQuiz: document.getElementById('startQuiz'),

            // Quiz
            quizSection: document.getElementById('quizSection'),
            progressFill: document.getElementById('progressFill'),
            progressText: document.getElementById('progressText'),
            quizCard: document.getElementById('quizCard'),
            quizItemBadge: document.getElementById('quizItemBadge'),
            quizItemType: document.getElementById('quizItemType'),
            quizItemCharacter: document.getElementById('quizItemCharacter'),
            quizQuestionType: document.getElementById('quizQuestionType'),
            quizQuestion: document.getElementById('quizQuestion'),
            answerInput: document.getElementById('answerInput'),
            submitAnswer: document.getElementById('submitAnswer'),
            resultSection: document.getElementById('resultSection'),
            resultIcon: document.getElementById('resultIcon'),
            resultMessage: document.getElementById('resultMessage'),
            acceptedAnswers: document.getElementById('acceptedAnswers'),
            undoAnswer: document.getElementById('undoAnswer'),
            nextQuestion: document.getElementById('nextQuestion'),

            // Quiz Complete
            quizComplete: document.getElementById('quizComplete'),
            scoreDisplay: document.getElementById('scoreDisplay'),
            reviewSummary: document.getElementById('reviewSummary'),
            reviewItemsList: document.getElementById('reviewItemsList'),
            submissionControls: document.getElementById('submissionControls'),
            submitToWanikani: document.getElementById('submitToWanikani'),
            discardReviews: document.getElementById('discardReviews'),
            submissionStatus: document.getElementById('submissionStatus'),
            newQuiz: document.getElementById('newQuiz'),

            // Error
            retryButton: document.getElementById('retryButton')
        };
    }

    initializeEventListeners() {
        this.elements.saveKeys.addEventListener('click', () => this.saveApiKeys());
        this.elements.validateWanikani.addEventListener('click', () => this.validateWanikaniKey());
        this.elements.validateGemini.addEventListener('click', () => this.validateGeminiKey());
        this.elements.clearKeys.addEventListener('click', () => this.clearApiKeys());
        this.elements.generateQuiz.addEventListener('click', () => this.generateQuiz());
        this.elements.startQuiz.addEventListener('click', () => this.startQuizSession());
        this.elements.submitAnswer.addEventListener('click', () => this.submitAnswer());
        this.elements.answerInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                // If result is showing, go to next question; otherwise submit answer
                if (this.elements.resultSection.style.display !== 'none') {
                    this.nextQuestion();
                } else {
                    this.submitAnswer();
                }
            }
        });
        this.elements.nextQuestion.addEventListener('click', () => this.nextQuestion());
        this.elements.undoAnswer.addEventListener('click', () => this.undoLastAnswer());
        this.elements.newQuiz.addEventListener('click', () => this.generateQuiz());
        this.elements.retryButton.addEventListener('click', () => this.generateQuiz());
        this.elements.submitToWanikani.addEventListener('click', () => this.submitReviewsToWanikani());
        this.elements.discardReviews.addEventListener('click', () => this.discardReviews());
    }

    initializeGeminiClient() {
        try {
            this.geminiClient = new GoogleGenerativeAI(this.geminiKey);
            console.log('Gemini client initialized');
        } catch (error) {
            console.error('Failed to initialize Gemini client:', error);
            this.geminiClient = null;
        }
    }

    showApiSetup() {
        this.elements.apiSetup.style.display = 'flex';
        this.elements.mainContent.style.display = 'none';
        this.elements.loading.style.display = 'none';
        this.elements.error.style.display = 'none';
    }

    showMainContent() {
        this.elements.apiSetup.style.display = 'none';
        this.elements.mainContent.style.display = 'block';
        this.elements.loading.style.display = 'none';
        this.elements.error.style.display = 'none';
    }

    showLoading(text = 'Loading...') {
        this.elements.loadingText.textContent = text;
        this.elements.loading.style.display = 'flex';
        this.elements.apiSetup.style.display = 'none';
        this.elements.mainContent.style.display = 'none';
        this.elements.error.style.display = 'none';
    }

    showError(message) {
        this.elements.errorMessage.textContent = message;
        this.elements.error.style.display = 'block';
        this.elements.loading.style.display = 'none';
        this.elements.apiSetup.style.display = 'none';
        this.elements.mainContent.style.display = 'none';
    }

    async validateWanikaniKey() {
        const token = this.elements.wanikaniToken.value.trim();
        if (!token) {
            this.showStatusMessage(this.elements.wanikaniStatus, 'Please enter a WaniKani token', 'error');
            return;
        }

        this.showStatusMessage(this.elements.wanikaniStatus, 'Validating...', 'success');

        try {
            const response = await fetch('https://api.wanikani.com/v2/user', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Wanikani-Revision': '20170710'
                }
            });

            if (response.ok) {
                this.showStatusMessage(this.elements.wanikaniStatus, 'Valid!', 'success');
                return true;
            } else {
                this.showStatusMessage(this.elements.wanikaniStatus, 'Invalid token', 'error');
                return false;
            }
        } catch (error) {
            this.showStatusMessage(this.elements.wanikaniStatus, 'Network error', 'error');
            return false;
        }
    }

    async validateGeminiKey() {
        const key = this.elements.geminiKey.value.trim();
        if (!key) {
            this.showStatusMessage(this.elements.geminiStatus, 'Please enter a Gemini key', 'error');
            return;
        }

        this.showStatusMessage(this.elements.geminiStatus, 'Validating...', 'success');

        try {
            const genAI = new GoogleGenerativeAI(key);
            const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
            const result = await model.generateContent('Test');

            if (result) {
                this.showStatusMessage(this.elements.geminiStatus, 'Valid!', 'success');
                return true;
            }
        } catch (error) {
            console.error('Gemini validation error:', error);
            this.showStatusMessage(this.elements.geminiStatus, 'Invalid key', 'error');
        }

        return false;
    }

    async saveApiKeys() {
        const wanikaniToken = this.elements.wanikaniToken.value.trim();
        const geminiKey = this.elements.geminiKey.value.trim();

        if (!wanikaniToken || !geminiKey) {
            this.showStatus('Please enter both API keys', 'error');
            return;
        }

        this.showStatus('Validating API keys...', 'success');

        const wanikaniValid = await this.validateWanikaniKey();
        const geminiValid = await this.validateGeminiKey();

        if (wanikaniValid && geminiValid) {
            this.wanikaniToken = wanikaniToken;
            this.geminiKey = geminiKey;
            localStorage.setItem('wanikani_api_token', wanikaniToken);
            localStorage.setItem('gemini_api_key', geminiKey);
            this.initializeGeminiClient();
            this.showStatus('API keys saved successfully!', 'success');
            setTimeout(() => {
                this.showMainContent();
            }, 1000);
        } else {
            this.showStatus('One or more API keys are invalid. Please check and try again.', 'error');
        }
    }

    clearApiKeys() {
        if (confirm('Are you sure you want to clear your API keys?')) {
            localStorage.removeItem('wanikani_api_token');
            localStorage.removeItem('gemini_api_key');
            this.wanikaniToken = null;
            this.geminiKey = null;
            this.geminiClient = null;
            this.elements.wanikaniToken.value = '';
            this.elements.geminiKey.value = '';
            this.showStatusMessage(this.elements.wanikaniStatus, '', '');
            this.showStatusMessage(this.elements.geminiStatus, '', '');
            this.showStatus('API keys cleared', 'success');
        }
    }

    showStatusMessage(element, message, type) {
        element.textContent = message;
        element.className = type ? `status-message ${type}` : 'status-message';
    }

    showStatus(message, type) {
        this.showStatusMessage(this.elements.statusMessage, message, type);
    }

    async generateQuiz() {
        this.showLoading('Fetching review items...');

        try {
            // Get requested counts from config
            const requestedVocab = parseInt(this.elements.vocabCount.value) || 0;
            const requestedKanji = parseInt(this.elements.kanjiCount.value) || 0;

            if (requestedVocab + requestedKanji === 0) {
                this.showError('Please select at least 1 vocabulary or kanji item.');
                return;
            }

            // Clear previous review data
            this.assignmentMap.clear();
            this.srsStageMap.clear();
            this.reviewResults.clear();
            this.correctlyAnswered.clear();

            // Fetch review items with assignments
            const { items: reviewItems, assignments } = await this.fetchReviewItems();

            // Store assignment mappings and SRS stages
            assignments.forEach(assignment => {
                this.assignmentMap.set(assignment.data.subject_id, assignment.id);
                this.srsStageMap.set(assignment.data.subject_id, assignment.data.srs_stage);
            });

            // Check if we have enough vocabulary and kanji
            const availableVocab = reviewItems.filter(item => item.object === 'vocabulary').length;
            const availableKanji = reviewItems.filter(item => item.object === 'kanji').length;

            if (requestedVocab > 0 && availableVocab < requestedVocab) {
                this.showError(`Not enough vocabulary items available. You have ${availableVocab} but requested ${requestedVocab}.`);
                return;
            }

            if (requestedKanji > 0 && availableKanji < requestedKanji) {
                this.showError(`Not enough kanji items available. You have ${availableKanji} but requested ${requestedKanji}.`);
                return;
            }

            this.showLoading('Selecting quiz items...');
            this.selectedItems = this.selectQuizItems(reviewItems, requestedVocab, requestedKanji);

            // Initialize review results for selected items
            this.selectedItems.forEach(item => {
                this.reviewResults.set(item.id, {
                    meaning: null,
                    reading: null,
                    meaningIncorrect: 0,
                    readingIncorrect: 0,
                    newSrsStage: null
                });
            });

            const totalQuestions = this.calculateTotalQuestions(this.selectedItems);
            console.log(`Selected ${this.selectedItems.length} items for ${totalQuestions} questions`);

            this.showLoading('Generating story...');
            this.story = await this.generateStory(this.selectedItems);

            // Display item cards
            this.displayItemCards(this.selectedItems);

            this.displayStory(this.story, this.selectedItems);
            this.showMainContent();
            this.elements.itemCardsSection.style.display = 'block';
            this.elements.storySection.style.display = 'block';
            this.elements.storySection.classList.remove('quiz-active');
            this.elements.quizSection.style.display = 'none';
            this.elements.quizComplete.style.display = 'none';
            // Show quiz config and controls again
            this.elements.quizConfig.style.display = 'flex';
            this.elements.generateQuiz.style.display = 'inline-block';
            this.elements.startQuiz.style.display = 'block';
        } catch (error) {
            console.error('Error generating quiz:', error);
            this.showError(`Failed to generate quiz: ${error.message}`);
        }
    }

    async fetchReviewItems() {
        const response = await fetch('https://api.wanikani.com/v2/assignments?immediately_available_for_review=true', {
            headers: {
                'Authorization': `Bearer ${this.wanikaniToken}`,
                'Wanikani-Revision': '20170710'
            }
        });

        if (!response.ok) {
            throw new Error(`WaniKani API error: ${response.status}`);
        }

        const data = await response.json();
        const assignments = data.data || [];

        // Fetch subject details for each assignment
        const subjectIds = assignments.map(a => a.data.subject_id);
        const subjectsResponse = await fetch(`https://api.wanikani.com/v2/subjects?ids=${subjectIds.join(',')}`, {
            headers: {
                'Authorization': `Bearer ${this.wanikaniToken}`,
                'Wanikani-Revision': '20170710'
            }
        });

        if (!subjectsResponse.ok) {
            throw new Error(`WaniKani API error: ${subjectsResponse.status}`);
        }

        const subjectsData = await subjectsResponse.json();
        return {
            items: subjectsData.data || [],
            assignments: assignments
        };
    }

    selectQuizItems(items, vocabCount = 3, kanjiCount = 2) {
        const vocabulary = items.filter(item => item.object === 'vocabulary');
        const kanji = items.filter(item => item.object === 'kanji');

        const shuffledVocab = this.shuffleArray([...vocabulary]);
        const shuffledKanji = this.shuffleArray([...kanji]);

        const selected = [
            ...shuffledVocab.slice(0, vocabCount),
            ...shuffledKanji.slice(0, kanjiCount)
        ];

        return selected;
    }

    shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    getSrsStageInfo(stage) {
        const stages = {
            0: { name: 'Lesson', color: '#999' },
            1: { name: 'Apprentice 1', color: '#dd0093' },
            2: { name: 'Apprentice 2', color: '#dd0093' },
            3: { name: 'Apprentice 3', color: '#dd0093' },
            4: { name: 'Apprentice 4', color: '#dd0093' },
            5: { name: 'Guru 1', color: '#882d9e' },
            6: { name: 'Guru 2', color: '#882d9e' },
            7: { name: 'Master', color: '#294ddb' },
            8: { name: 'Enlightened', color: '#0093dd' },
            9: { name: 'Burned', color: '#434343' }
        };
        return stages[stage] || { name: `Stage ${stage}`, color: '#666' };
    }

    calculatePredictedSrsStage(currentStage, meaningIncorrect, readingIncorrect) {
        // WaniKani SRS calculation logic
        const totalIncorrect = meaningIncorrect + readingIncorrect;

        if (totalIncorrect === 0) {
            // All correct: advance one stage (max 9 for burned)
            return Math.min(currentStage + 1, 9);
        }

        // Incorrect answers cause stage drops
        // The penalty increases with higher stages
        const incorrectAdjustment = Math.ceil(totalIncorrect / 2);

        let penaltyFactor;
        if (currentStage >= 5) {
            // Guru and above: larger penalty
            penaltyFactor = 2;
        } else {
            // Apprentice: smaller penalty
            penaltyFactor = 1;
        }

        const newStage = currentStage - (incorrectAdjustment * penaltyFactor);

        // Minimum stage is 1 (Apprentice 1)
        return Math.max(newStage, 1);
    }

    calculateTotalQuestions(items) {
        return items.length * 2;
    }

    async generateStory(items) {
        if (!this.geminiClient) {
            throw new Error('Gemini client not initialized');
        }

        const models = ['gemini-2.5-flash', 'gemini-1.5-pro', 'gemini-1.0-pro'];

        for (const modelName of models) {
            try {
                const model = this.geminiClient.getGenerativeModel({ model: modelName });

                let prompt = 'Generate a natural 3-4 sentence Japanese paragraph that includes all of these items:\n\n';

                items.forEach(item => {
                    const characters = item.data.characters || item.data.character || item.data.slug;
                    const meanings = item.data.meanings || [];
                    const primaryMeaning = meanings.find(m => m.primary)?.meaning || meanings[0]?.meaning || 'unknown';

                    prompt += `- ${characters} (${primaryMeaning})\n`;
                });

                prompt += '\nThe paragraph should be coherent and natural. Include all items naturally in context.\n';
                prompt += 'This is for Japanese language learning, so use simple vocabulary and grammar appropriate for beginners.\n';
                prompt += 'IMPORTANT: Wrap each target word (including any conjugated forms) with markers:\n';
                prompt += '- For vocabulary words: [[v:word]] (e.g., if 食べる appears as 食べた, write [[v:食べた]])\n';
                prompt += '- For kanji: [[k:kanji]]\n';
                prompt += 'Return only the Japanese paragraph with these markers, no additional text or explanations.';

                const result = await model.generateContent(prompt);
                const response = await result.response;
                const storyText = response.text();

                if (storyText && storyText.trim()) {
                    return storyText.trim();
                }
            } catch (error) {
                console.log(`Model ${modelName} failed:`, error.message);
            }
        }

        throw new Error('All Gemini models failed. Please check your API key and try again.');
    }

    displayItemCards(items) {
        this.elements.itemCardsContainer.innerHTML = '';

        items.forEach(item => {
            const characters = item.data.characters || item.data.character || item.data.slug;
            const type = item.object;
            const srsStage = this.srsStageMap.get(item.id) || 1;

            // Only show meaning/reading hints for Apprentice items (stage 1-4)
            const showHints = srsStage < 5;

            const meanings = item.data.meanings || [];
            const primaryMeaning = meanings.find(m => m.primary)?.meaning || meanings[0]?.meaning || '';
            const readings = item.data.readings || [];
            const primaryReading = readings.find(r => r.primary)?.reading || readings[0]?.reading || '';

            const card = document.createElement('div');
            card.className = `item-card ${type}`;

            if (showHints) {
                card.innerHTML = `
                    <div class="item-card-tooltip">${primaryMeaning}${primaryReading ? ' ・ ' + primaryReading : ''}</div>
                    <div class="item-card-character">${characters}</div>
                    <div class="item-card-meaning">${primaryMeaning}</div>
                    ${primaryReading ? `<div class="item-card-reading">${primaryReading}</div>` : ''}
                `;
            } else {
                // No hints for Guru+ items - just show the character and SRS level indicator
                const stageInfo = this.getSrsStageInfo(srsStage);
                card.innerHTML = `
                    <div class="item-card-character">${characters}</div>
                    <div class="item-card-srs-badge" style="color: ${stageInfo.color}; font-size: 0.65rem; opacity: 0.8;">${stageInfo.name}</div>
                `;
            }

            this.elements.itemCardsContainer.appendChild(card);
        });
    }

    displayStory(story, items) {
        let highlightedStory = story;

        // Replace [[v:word]] markers with vocabulary highlighting
        highlightedStory = highlightedStory.replace(
            /\[\[v:([^\]]+)\]\]/g,
            '<span class="highlight-vocab">$1</span>'
        );

        // Replace [[k:word]] markers with kanji highlighting
        highlightedStory = highlightedStory.replace(
            /\[\[k:([^\]]+)\]\]/g,
            '<span class="highlight-kanji">$1</span>'
        );

        // Replace [[r:word]] markers with radical highlighting (if used)
        highlightedStory = highlightedStory.replace(
            /\[\[r:([^\]]+)\]\]/g,
            '<span class="highlight-radical">$1</span>'
        );

        this.elements.storyText.innerHTML = highlightedStory;
    }

    startQuizSession() {
        this.quizItems = this.createQuizQuestions(this.selectedItems);
        this.currentQuizIndex = 0;
        this.quizScore = 0;
        this.lastAnswerResult = null;
        this.totalOriginalQuestions = this.quizItems.length;
        this.correctlyAnswered.clear();

        this.elements.itemCardsSection.style.display = 'none';
        this.elements.storySection.classList.add('quiz-active');
        this.elements.quizSection.style.display = 'block';
        this.elements.quizComplete.style.display = 'none';
        // Hide quiz config and controls during quiz (story stays visible)
        this.elements.quizConfig.style.display = 'none';
        this.elements.generateQuiz.style.display = 'none';
        this.elements.startQuiz.style.display = 'none';
        this.displayQuestion(0);
    }

    createQuizQuestions(items) {
        const questions = [];

        items.forEach(item => {
            questions.push({
                item: item,
                type: 'meaning',
                question: `What is the meaning of ${item.data.characters || item.data.character}?`,
                key: `${item.id}-meaning` // Unique key for tracking
            });
            questions.push({
                item: item,
                type: 'reading',
                question: `What is the reading of ${item.data.characters || item.data.character}?`,
                key: `${item.id}-reading` // Unique key for tracking
            });
        });

        return this.shuffleArray(questions);
    }

    displayQuestion(index) {
        // Quiz is complete when all original questions have been answered correctly
        if (this.correctlyAnswered.size >= this.totalOriginalQuestions) {
            this.completeQuiz();
            return;
        }

        if (index >= this.quizItems.length) {
            this.completeQuiz();
            return;
        }

        const question = this.quizItems[index];
        const item = question.item;
        const characters = item.data.characters || item.data.character || item.data.slug;
        const type = item.object;

        // Update quiz card class for type-specific styling
        this.elements.quizCard.className = `quiz-card ${type}`;

        // Update badge
        this.elements.quizItemBadge.className = `quiz-item-badge ${type}`;
        this.elements.quizItemType.textContent = type.toUpperCase();

        this.elements.quizItemCharacter.textContent = characters;

        // Show question type (MEANING or READING)
        this.elements.quizQuestionType.textContent = question.type.toUpperCase();
        this.elements.quizQuestion.textContent = question.question;

        // Store question info for answer checking
        this.currentQuestion = question;

        // Update progress based on correctly answered questions
        const completedCount = this.correctlyAnswered.size;
        const progress = (completedCount / this.totalOriginalQuestions) * 100;
        this.elements.progressFill.style.width = `${progress}%`;
        const remaining = this.totalOriginalQuestions - completedCount;
        this.elements.progressText.textContent = `${completedCount}/${this.totalOriginalQuestions} complete (${remaining} remaining)`;

        // Configure input based on question type
        this.configureInputForQuestionType(question.type);

        // Reset UI
        this.elements.answerInput.value = '';
        this.elements.resultSection.style.display = 'none';
        this.elements.undoAnswer.style.display = 'none';

        // Clear undo timeout
        if (this.undoTimeout) {
            clearTimeout(this.undoTimeout);
            this.undoTimeout = null;
        }

        // Focus input after a brief delay (for animation)
        setTimeout(() => {
            this.elements.answerInput.focus();
        }, 100);
    }

    configureInputForQuestionType(questionType) {
        const input = this.elements.answerInput;

        // Remove existing classes
        input.classList.remove('reading-input', 'meaning-input');

        if (questionType === 'reading') {
            // Bind wanakana for auto-hiragana conversion
            if (!this.wanakanaBound) {
                wanakana.bind(input);
                this.wanakanaBound = true;
            }
            input.classList.add('reading-input');
            input.placeholder = 'Your reading in hiragana...';
        } else {
            // Unbind wanakana for meaning questions
            if (this.wanakanaBound) {
                wanakana.unbind(input);
                this.wanakanaBound = false;
            }
            input.classList.add('meaning-input');
            input.placeholder = 'Your answer in English...';
        }
    }

    getCorrectAnswers(item, questionType) {
        if (questionType === 'reading') {
            const readings = item.data.readings || [];
            return readings.filter(r => r.accepted_answer).map(r => r.reading);
        } else if (questionType === 'meaning') {
            const meanings = item.data.meanings || [];
            return meanings.filter(m => m.accepted_answer).map(m => m.meaning.toLowerCase());
        }

        return [];
    }

    async submitAnswer() {
        const userAnswer = this.elements.answerInput.value.trim();

        if (!userAnswer) {
            return;
        }

        const correctAnswers = this.getCorrectAnswers(this.currentQuestion.item, this.currentQuestion.type);
        const isCorrect = this.checkAnswer(userAnswer, correctAnswers);

        // Track result for this subject
        const subjectId = this.currentQuestion.item.id;
        const questionType = this.currentQuestion.type;
        const questionKey = this.currentQuestion.key;
        const reviewResult = this.reviewResults.get(subjectId);
        const wasAlreadyAnsweredCorrectly = this.correctlyAnswered.has(questionKey);

        // Track if this was the first attempt (result was null before)
        const wasFirstAttempt = questionType === 'meaning'
            ? reviewResult?.meaning === null
            : reviewResult?.reading === null;

        if (reviewResult) {
            if (questionType === 'meaning') {
                // Only set to true if this is the FIRST attempt and it's correct
                // Once marked incorrect, it stays incorrect for SRS purposes
                if (reviewResult.meaning === null) {
                    // First attempt for this question
                    if (isCorrect) {
                        // Commit correct answers immediately
                        reviewResult.meaning = true;
                    }
                    // Don't commit incorrect answers yet - wait until user advances
                    // This allows undo for typos on first attempt
                } else if (!isCorrect && reviewResult.meaning === false) {
                    // Additional incorrect attempt (recycled question)
                    reviewResult.meaningIncorrect++;
                }
                // If already marked (true or false), don't change it
            } else {
                if (reviewResult.reading === null) {
                    if (isCorrect) {
                        reviewResult.reading = true;
                    }
                    // Don't commit incorrect answers yet - wait until user advances
                } else if (!isCorrect && reviewResult.reading === false) {
                    reviewResult.readingIncorrect++;
                }
            }
        }

        // Store for potential undo
        this.lastAnswerResult = {
            subjectId,
            questionType,
            questionKey,
            isCorrect,
            wasAlreadyAnsweredCorrectly,
            wasFirstAttempt,
            previousScore: this.quizScore
        };

        // Only increment score on first correct answer for this question
        if (isCorrect && !wasAlreadyAnsweredCorrectly) {
            this.quizScore++;
            this.correctlyAnswered.add(questionKey);
        }

        this.showResult(isCorrect, correctAnswers);
    }

    checkAnswer(userAnswer, correctAnswers) {
        const normalizedUserAnswer = userAnswer.toLowerCase().trim();

        for (const correctAnswer of correctAnswers) {
            const normalizedCorrect = correctAnswer.toLowerCase().trim();

            if (normalizedUserAnswer === normalizedCorrect) {
                return true;
            }
        }

        return false;
    }

    showResult(isCorrect, correctAnswers) {
        this.elements.resultSection.style.display = 'block';

        const correctAnswerText = correctAnswers.join(', ');

        if (isCorrect) {
            this.elements.resultIcon.textContent = '✓';
            this.elements.resultIcon.style.color = 'var(--wk-correct)';
            this.elements.resultMessage.textContent = 'Correct!';
            this.elements.resultMessage.className = 'result-message correct';
            this.elements.acceptedAnswers.style.display = 'none';

            // Show undo button for correct answers
            this.elements.undoAnswer.style.display = 'inline-block';

            // Add pulse animation
            this.elements.quizCard.classList.add('pulse');
            setTimeout(() => {
                this.elements.quizCard.classList.remove('pulse');
            }, 400);
        } else {
            this.elements.resultIcon.textContent = '✗';
            this.elements.resultIcon.style.color = 'var(--wk-incorrect)';
            this.elements.resultMessage.textContent = 'Incorrect';
            this.elements.resultMessage.className = 'result-message incorrect';

            // Show accepted answers
            this.elements.acceptedAnswers.innerHTML = `<strong>Accepted answers:</strong> ${correctAnswerText}`;
            this.elements.acceptedAnswers.style.display = 'block';

            // Show undo for first incorrect attempts (allows fixing typos)
            if (this.lastAnswerResult && this.lastAnswerResult.wasFirstAttempt) {
                this.elements.undoAnswer.style.display = 'inline-block';
            } else {
                this.elements.undoAnswer.style.display = 'none';
            }

            // Add shake animation
            this.elements.quizCard.classList.add('shake');
            setTimeout(() => {
                this.elements.quizCard.classList.remove('shake');
            }, 500);
        }
    }

    undoLastAnswer() {
        if (!this.lastAnswerResult) return;

        const { subjectId, questionType, questionKey, isCorrect, wasAlreadyAnsweredCorrectly, wasFirstAttempt, previousScore } = this.lastAnswerResult;

        // Revert score
        this.quizScore = previousScore;

        // Remove from correctly answered if it was just added
        if (isCorrect && !wasAlreadyAnsweredCorrectly) {
            this.correctlyAnswered.delete(questionKey);
        }

        // Revert review result
        const reviewResult = this.reviewResults.get(subjectId);
        if (reviewResult) {
            if (questionType === 'meaning') {
                if (wasFirstAttempt) {
                    // If this was a first correct attempt, reset to null
                    // First incorrect attempts were never committed, so nothing to revert
                    if (isCorrect) {
                        reviewResult.meaning = null;
                    }
                } else if (!isCorrect) {
                    // This was a re-attempt, just decrement incorrect count
                    reviewResult.meaningIncorrect = Math.max(0, reviewResult.meaningIncorrect - 1);
                }
            } else {
                if (wasFirstAttempt) {
                    if (isCorrect) {
                        reviewResult.reading = null;
                    }
                } else if (!isCorrect) {
                    reviewResult.readingIncorrect = Math.max(0, reviewResult.readingIncorrect - 1);
                }
            }
        }

        // Clear last answer
        this.lastAnswerResult = null;

        // Clear timeout
        if (this.undoTimeout) {
            clearTimeout(this.undoTimeout);
            this.undoTimeout = null;
        }

        // Reset UI to re-answer
        this.elements.resultSection.style.display = 'none';
        this.elements.answerInput.value = '';
        this.elements.answerInput.focus();
    }

    nextQuestion() {
        const currentQuestion = this.quizItems[this.currentQuizIndex];
        const questionKey = currentQuestion.key;

        // Commit pending incorrect status before advancing
        // This happens when user advances after an incorrect first attempt without undoing
        if (this.lastAnswerResult && !this.lastAnswerResult.isCorrect && this.lastAnswerResult.wasFirstAttempt) {
            const reviewResult = this.reviewResults.get(this.lastAnswerResult.subjectId);
            if (reviewResult) {
                if (this.lastAnswerResult.questionType === 'meaning' && reviewResult.meaning === null) {
                    reviewResult.meaning = false;
                    reviewResult.meaningIncorrect++;
                } else if (this.lastAnswerResult.questionType === 'reading' && reviewResult.reading === null) {
                    reviewResult.reading = false;
                    reviewResult.readingIncorrect++;
                }
            }
        }

        // If this question hasn't been answered correctly yet, recycle it
        if (!this.correctlyAnswered.has(questionKey)) {
            // Push a copy of the question to the end of the queue
            this.quizItems.push({ ...currentQuestion });
        }

        this.lastAnswerResult = null;
        this.currentQuizIndex++;
        this.displayQuestion(this.currentQuizIndex);
    }

    completeQuiz() {
        // Unbind wanakana
        if (this.wanakanaBound) {
            wanakana.unbind(this.elements.answerInput);
            this.wanakanaBound = false;
        }

        this.elements.quizSection.style.display = 'none';
        this.elements.quizComplete.style.display = 'block';

        // Use original question count, not inflated count from recycled questions
        const totalQuestions = this.totalOriginalQuestions;
        const percentage = Math.round((this.quizScore / totalQuestions) * 100);

        this.elements.scoreDisplay.innerHTML = `
            <div>You got ${this.quizScore} out of ${totalQuestions} correct!</div>
            <div style="font-size: 0.9em; margin-top: 10px; color: #666;">
                Score: ${percentage}%
            </div>
        `;

        // Display review summary
        this.displayReviewSummary();

        // Reset submission status
        this.elements.submissionStatus.style.display = 'none';
        this.elements.submissionControls.style.display = 'flex';
    }

    displayReviewSummary() {
        this.elements.reviewItemsList.innerHTML = '';

        this.selectedItems.forEach(item => {
            const subjectId = item.id;
            const result = this.reviewResults.get(subjectId);
            const characters = item.data.characters || item.data.character || item.data.slug;
            const type = item.object;
            const meanings = item.data.meanings || [];
            const primaryMeaning = meanings.find(m => m.primary)?.meaning || meanings[0]?.meaning || '';

            // Get current SRS stage and calculate predicted new stage
            const currentStage = this.srsStageMap.get(subjectId) || 1;
            const predictedStage = this.calculatePredictedSrsStage(
                currentStage,
                result?.meaningIncorrect || 0,
                result?.readingIncorrect || 0
            );

            const currentInfo = this.getSrsStageInfo(currentStage);
            const predictedInfo = this.getSrsStageInfo(predictedStage);
            const isLevelUp = predictedStage > currentStage;
            const arrow = isLevelUp ? '↑' : '↓';
            const changeClass = isLevelUp ? 'srs-up' : 'srs-down';

            const reviewItem = document.createElement('div');
            reviewItem.className = 'review-item';
            reviewItem.dataset.subjectId = subjectId;

            const meaningStatus = result?.meaning === true ? 'correct' : (result?.meaning === false ? 'incorrect' : 'pending');
            const readingStatus = result?.reading === true ? 'correct' : (result?.reading === false ? 'incorrect' : 'pending');

            reviewItem.innerHTML = `
                <div class="review-item-character ${type}">${characters}</div>
                <div class="review-item-details">
                    <div class="review-item-meaning">${primaryMeaning}</div>
                    <div class="review-item-results">
                        <span class="review-result-badge ${meaningStatus}">
                            Meaning: ${meaningStatus === 'correct' ? '✓' : (meaningStatus === 'incorrect' ? '✗' : '?')}
                        </span>
                        <span class="review-result-badge ${readingStatus}">
                            Reading: ${readingStatus === 'correct' ? '✓' : (readingStatus === 'incorrect' ? '✗' : '?')}
                        </span>
                    </div>
                    <div class="review-item-srs-change">
                        <span class="srs-stage" style="color: ${currentInfo.color}">${currentInfo.name}</span>
                        <span class="srs-arrow ${changeClass}">${arrow}</span>
                        <span class="srs-stage" style="color: ${predictedInfo.color}">${predictedInfo.name}</span>
                    </div>
                </div>
            `;

            this.elements.reviewItemsList.appendChild(reviewItem);
        });
    }

    async submitReviewsToWanikani() {
        this.elements.submissionStatus.style.display = 'block';
        this.elements.submissionStatus.className = 'submission-status loading';
        this.elements.submissionStatus.textContent = 'Submitting reviews to WaniKani...';
        this.elements.submissionControls.style.display = 'none';

        let successCount = 0;
        let errorCount = 0;

        for (const item of this.selectedItems) {
            const subjectId = item.id;
            const assignmentId = this.assignmentMap.get(subjectId);
            const result = this.reviewResults.get(subjectId);

            if (!assignmentId || !result) {
                console.warn(`Missing assignment or result for subject ${subjectId}`);
                errorCount++;
                continue;
            }

            // Calculate incorrect counts
            const incorrectMeaning = result.meaningIncorrect;
            const incorrectReading = result.readingIncorrect;

            try {
                const response = await fetch('https://api.wanikani.com/v2/reviews', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.wanikaniToken}`,
                        'Wanikani-Revision': '20170710',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        review: {
                            assignment_id: assignmentId,
                            incorrect_meaning_answers: incorrectMeaning,
                            incorrect_reading_answers: incorrectReading
                        }
                    })
                });

                if (response.ok) {
                    const responseData = await response.json();
                    // Extract the new SRS stage from the response (ending_srs_stage is in data object)
                    const newSrsStage = responseData?.data?.ending_srs_stage;
                    if (newSrsStage !== undefined && newSrsStage !== null) {
                        result.newSrsStage = newSrsStage;
                    }
                    successCount++;
                    console.log(`Successfully submitted review for subject ${subjectId}, new SRS stage: ${newSrsStage}`);
                } else {
                    const errorData = await response.json().catch(() => ({}));
                    console.error(`Failed to submit review for subject ${subjectId}:`, errorData);
                    errorCount++;
                }
            } catch (error) {
                console.error(`Error submitting review for subject ${subjectId}:`, error);
                errorCount++;
            }
        }

        // Update the review summary with SRS stage changes
        this.updateReviewSummaryWithSrsChanges();

        // Show result
        if (errorCount === 0) {
            this.elements.submissionStatus.className = 'submission-status success';
            this.elements.submissionStatus.textContent = `Successfully submitted ${successCount} reviews to WaniKani!`;
        } else if (successCount > 0) {
            this.elements.submissionStatus.className = 'submission-status error';
            this.elements.submissionStatus.textContent = `Submitted ${successCount} reviews, but ${errorCount} failed. Check console for details.`;
        } else {
            this.elements.submissionStatus.className = 'submission-status error';
            this.elements.submissionStatus.textContent = 'Failed to submit reviews. Please check your connection and try again.';
            this.elements.submissionControls.style.display = 'flex';
        }
    }

    updateReviewSummaryWithSrsChanges() {
        this.selectedItems.forEach(item => {
            const subjectId = item.id;
            const result = this.reviewResults.get(subjectId);
            const oldStage = this.srsStageMap.get(subjectId);
            const newStage = result?.newSrsStage;

            const reviewItemEl = this.elements.reviewItemsList.querySelector(`[data-subject-id="${subjectId}"]`);
            if (reviewItemEl && newStage !== undefined && newStage !== null) {
                const oldInfo = this.getSrsStageInfo(oldStage);
                const newInfo = this.getSrsStageInfo(newStage);

                const isLevelUp = newStage > oldStage;
                const arrow = isLevelUp ? '↑' : '↓';
                const changeClass = isLevelUp ? 'srs-up' : 'srs-down';

                // Update the existing SRS change element (already created in displayReviewSummary)
                const existingSrsEl = reviewItemEl.querySelector('.review-item-srs-change');
                if (existingSrsEl) {
                    existingSrsEl.innerHTML = `
                        <span class="srs-stage" style="color: ${oldInfo.color}">${oldInfo.name}</span>
                        <span class="srs-arrow ${changeClass}">${arrow}</span>
                        <span class="srs-stage" style="color: ${newInfo.color}">${newInfo.name}</span>
                        <span class="srs-confirmed">(confirmed)</span>
                    `;
                }
            }
        });
    }

    discardReviews() {
        if (confirm('Are you sure you want to discard these reviews? They will not be submitted to WaniKani.')) {
            this.elements.submissionControls.style.display = 'none';
            this.elements.submissionStatus.style.display = 'block';
            this.elements.submissionStatus.className = 'submission-status';
            this.elements.submissionStatus.style.background = '#f0f0f0';
            this.elements.submissionStatus.style.color = '#666';
            this.elements.submissionStatus.style.border = '1px solid #ccc';
            this.elements.submissionStatus.textContent = 'Reviews discarded. Your WaniKani SRS was not affected.';
        }
    }
}

// Initialize the app when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new StoryQuizApp();
});
