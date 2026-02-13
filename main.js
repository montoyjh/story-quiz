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

    selectQuizItems(items, vocabCount = 5, kanjiCount = 0) {
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

                    // Check if this is a suffix/prefix vocab with placeholder
                    if (characters.includes('〜') || characters.includes('~')) {
                        prompt += `- ${characters} (${primaryMeaning}) - NOTE: 〜 is a placeholder; use this suffix/prefix naturally attached to another word\n`;
                    } else {
                        prompt += `- ${characters} (${primaryMeaning})\n`;
                    }
                });

                prompt += '\nThe paragraph should be coherent and natural. Include all items naturally in context.\n';
                prompt += 'This is for Japanese language learning, so use simple vocabulary and grammar appropriate for beginners.\n';
                prompt += 'Return only the Japanese paragraph, no additional text or explanations.';

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

    // Generate possible verb conjugations for a given word
    getVerbForms(word) {
        const forms = [word];

        // Skip if word contains placeholder markers
        if (word.includes('〜') || word.includes('~')) {
            // For suffix/prefix, just use the base without the placeholder
            const baseWord = word.replace(/[〜~]/g, '');
            if (baseWord) forms.push(baseWord);
            return forms;
        }

        // Irregular verb - 行く (iku - to go)
        if (word === '行く') {
            forms.push('行って');     // te-form (irregular!)
            forms.push('行った');     // past
            forms.push('行かない');   // negative
            forms.push('行かなかった'); // past negative
            forms.push('行きます');   // polite
            forms.push('行きました'); // polite past
            forms.push('行きません'); // polite negative
            forms.push('行ける');     // potential
            forms.push('行こう');     // volitional
            forms.push('行け');       // imperative
            forms.push('行けば');     // conditional
            forms.push('行ったり');   // tari-form
            forms.push('行っている'); // progressive
            forms.push('行ってる');   // casual progressive
            forms.push('行っていた'); // past progressive
            forms.push('行ってた');   // casual past progressive
        }

        // Common verb endings and their conjugations
        // る-verbs (ichidan) - generate these forms
        if (word.endsWith('る')) {
            const stem = word.slice(0, -1);
            // Ichidan forms (for verbs like 食べる, 見る, 起きる)
            forms.push(stem + 'て');      // te-form
            forms.push(stem + 'た');      // past
            forms.push(stem + 'ない');    // negative
            forms.push(stem + 'なかった'); // past negative
            forms.push(stem + 'ます');    // polite
            forms.push(stem + 'ました');  // polite past
            forms.push(stem + 'ません');  // polite negative
            forms.push(stem + 'られる');  // potential/passive
            forms.push(stem + 'よう');    // volitional
            forms.push(stem + 'ろ');      // imperative
            forms.push(stem + 'れば');    // conditional
            forms.push(stem + 'たり');    // tari-form
            forms.push(stem + 'ている');  // progressive
            forms.push(stem + 'てる');    // casual progressive
            forms.push(stem + 'ていた');  // past progressive
            forms.push(stem + 'てた');    // casual past progressive

            // Also generate godan-る forms (for verbs like 帰る, 走る, 切る, 知る)
            // These verbs end in る but conjugate like う-verbs
            forms.push(stem + 'って');    // te-form (godan)
            forms.push(stem + 'った');    // past (godan)
            forms.push(stem + 'らない');  // negative (godan)
            forms.push(stem + 'らなかった'); // past negative (godan)
            forms.push(stem + 'ります');  // polite (godan)
            forms.push(stem + 'りました'); // polite past (godan)
            forms.push(stem + 'りません'); // polite negative (godan)
            forms.push(stem + 'れる');    // potential (godan)
            forms.push(stem + 'ろう');    // volitional (godan)
            forms.push(stem + 'れ');      // imperative (godan)
            forms.push(stem + 'ったり');  // tari-form (godan)
            forms.push(stem + 'っている'); // progressive (godan)
            forms.push(stem + 'ってる');  // casual progressive (godan)
            forms.push(stem + 'っていた'); // past progressive (godan)
            forms.push(stem + 'ってた');  // casual past progressive (godan)
        }

        // う-verbs (godan) - various endings
        // う ending
        if (word.endsWith('う')) {
            const stem = word.slice(0, -1);
            forms.push(stem + 'って');    // te-form
            forms.push(stem + 'った');    // past
            forms.push(stem + 'わない');  // negative
            forms.push(stem + 'わなかった'); // past negative
            forms.push(stem + 'います');  // polite
            forms.push(stem + 'いました'); // polite past
            forms.push(stem + 'いません'); // polite negative
            forms.push(stem + 'える');    // potential
            forms.push(stem + 'おう');    // volitional
            forms.push(stem + 'え');      // imperative
            forms.push(stem + 'えば');    // conditional
            forms.push(stem + 'ったり');  // tari-form
            forms.push(stem + 'っている'); // progressive
            forms.push(stem + 'ってる');  // casual progressive
        }

        // く ending
        if (word.endsWith('く')) {
            const stem = word.slice(0, -1);
            forms.push(stem + 'いて');    // te-form
            forms.push(stem + 'いた');    // past
            forms.push(stem + 'かない');  // negative
            forms.push(stem + 'かなかった'); // past negative
            forms.push(stem + 'きます');  // polite
            forms.push(stem + 'きました'); // polite past
            forms.push(stem + 'きません'); // polite negative
            forms.push(stem + 'ける');    // potential
            forms.push(stem + 'こう');    // volitional
            forms.push(stem + 'け');      // imperative
            forms.push(stem + 'けば');    // conditional
            forms.push(stem + 'いたり');  // tari-form
            forms.push(stem + 'いている'); // progressive
            forms.push(stem + 'いてる');  // casual progressive
        }

        // ぐ ending
        if (word.endsWith('ぐ')) {
            const stem = word.slice(0, -1);
            forms.push(stem + 'いで');    // te-form
            forms.push(stem + 'いだ');    // past
            forms.push(stem + 'がない');  // negative
            forms.push(stem + 'がなかった'); // past negative
            forms.push(stem + 'ぎます');  // polite
            forms.push(stem + 'ぎました'); // polite past
            forms.push(stem + 'ぎません'); // polite negative
            forms.push(stem + 'げる');    // potential
            forms.push(stem + 'ごう');    // volitional
            forms.push(stem + 'げ');      // imperative
            forms.push(stem + 'げば');    // conditional
            forms.push(stem + 'いだり');  // tari-form
            forms.push(stem + 'いでいる'); // progressive
            forms.push(stem + 'いでる');  // casual progressive
        }

        // す ending
        if (word.endsWith('す')) {
            const stem = word.slice(0, -1);
            forms.push(stem + 'して');    // te-form
            forms.push(stem + 'した');    // past
            forms.push(stem + 'さない');  // negative
            forms.push(stem + 'さなかった'); // past negative
            forms.push(stem + 'します');  // polite
            forms.push(stem + 'しました'); // polite past
            forms.push(stem + 'しません'); // polite negative
            forms.push(stem + 'せる');    // potential
            forms.push(stem + 'そう');    // volitional
            forms.push(stem + 'せ');      // imperative
            forms.push(stem + 'せば');    // conditional
            forms.push(stem + 'したり');  // tari-form
            forms.push(stem + 'している'); // progressive
            forms.push(stem + 'してる');  // casual progressive
        }

        // つ ending
        if (word.endsWith('つ')) {
            const stem = word.slice(0, -1);
            forms.push(stem + 'って');    // te-form
            forms.push(stem + 'った');    // past
            forms.push(stem + 'たない');  // negative
            forms.push(stem + 'たなかった'); // past negative
            forms.push(stem + 'ちます');  // polite
            forms.push(stem + 'ちました'); // polite past
            forms.push(stem + 'ちません'); // polite negative
            forms.push(stem + 'てる');    // potential
            forms.push(stem + 'とう');    // volitional
            forms.push(stem + 'て');      // imperative
            forms.push(stem + 'てば');    // conditional
            forms.push(stem + 'ったり');  // tari-form
            forms.push(stem + 'っている'); // progressive
            forms.push(stem + 'ってる');  // casual progressive
        }

        // ぬ ending
        if (word.endsWith('ぬ')) {
            const stem = word.slice(0, -1);
            forms.push(stem + 'んで');    // te-form
            forms.push(stem + 'んだ');    // past
            forms.push(stem + 'なない');  // negative
            forms.push(stem + 'ななかった'); // past negative
            forms.push(stem + 'にます');  // polite
            forms.push(stem + 'にました'); // polite past
            forms.push(stem + 'にません'); // polite negative
            forms.push(stem + 'ねる');    // potential
            forms.push(stem + 'のう');    // volitional
            forms.push(stem + 'ね');      // imperative
            forms.push(stem + 'ねば');    // conditional
            forms.push(stem + 'んだり');  // tari-form
            forms.push(stem + 'んでいる'); // progressive
            forms.push(stem + 'んでる');  // casual progressive
        }

        // ぶ ending
        if (word.endsWith('ぶ')) {
            const stem = word.slice(0, -1);
            forms.push(stem + 'んで');    // te-form
            forms.push(stem + 'んだ');    // past
            forms.push(stem + 'ばない');  // negative
            forms.push(stem + 'ばなかった'); // past negative
            forms.push(stem + 'びます');  // polite
            forms.push(stem + 'びました'); // polite past
            forms.push(stem + 'びません'); // polite negative
            forms.push(stem + 'べる');    // potential
            forms.push(stem + 'ぼう');    // volitional
            forms.push(stem + 'べ');      // imperative
            forms.push(stem + 'べば');    // conditional
            forms.push(stem + 'んだり');  // tari-form
            forms.push(stem + 'んでいる'); // progressive
            forms.push(stem + 'んでる');  // casual progressive
        }

        // む ending
        if (word.endsWith('む')) {
            const stem = word.slice(0, -1);
            forms.push(stem + 'んで');    // te-form
            forms.push(stem + 'んだ');    // past
            forms.push(stem + 'まない');  // negative
            forms.push(stem + 'まなかった'); // past negative
            forms.push(stem + 'みます');  // polite
            forms.push(stem + 'みました'); // polite past
            forms.push(stem + 'みません'); // polite negative
            forms.push(stem + 'める');    // potential
            forms.push(stem + 'もう');    // volitional
            forms.push(stem + 'め');      // imperative
            forms.push(stem + 'めば');    // conditional
            forms.push(stem + 'んだり');  // tari-form
            forms.push(stem + 'んでいる'); // progressive
            forms.push(stem + 'んでる');  // casual progressive
        }

        // Irregular verbs - する
        if (word === 'する' || word.endsWith('する')) {
            const prefix = word.slice(0, -2);
            forms.push(prefix + 'して');      // te-form
            forms.push(prefix + 'した');      // past
            forms.push(prefix + 'しない');    // negative
            forms.push(prefix + 'しなかった'); // past negative
            forms.push(prefix + 'します');    // polite
            forms.push(prefix + 'しました');  // polite past
            forms.push(prefix + 'しません');  // polite negative
            forms.push(prefix + 'できる');    // potential
            forms.push(prefix + 'しよう');    // volitional
            forms.push(prefix + 'しろ');      // imperative
            forms.push(prefix + 'すれば');    // conditional
            forms.push(prefix + 'したり');    // tari-form
            forms.push(prefix + 'している');  // progressive
            forms.push(prefix + 'してる');    // casual progressive
            forms.push(prefix + 'していた');  // past progressive
            forms.push(prefix + 'してた');    // casual past progressive
            forms.push(prefix + 'される');    // passive
            forms.push(prefix + 'させる');    // causative
        }

        // Irregular verbs - くる/来る
        if (word === 'くる' || word === '来る') {
            forms.push('きて');      // te-form
            forms.push('きた');      // past
            forms.push('こない');    // negative
            forms.push('こなかった'); // past negative
            forms.push('きます');    // polite
            forms.push('きました');  // polite past
            forms.push('きません');  // polite negative
            forms.push('こられる');  // potential
            forms.push('こよう');    // volitional
            forms.push('こい');      // imperative
            forms.push('くれば');    // conditional
            forms.push('きたり');    // tari-form
            forms.push('きている');  // progressive
            forms.push('きてる');    // casual progressive
            forms.push('きていた');  // past progressive
            forms.push('きてた');    // casual past progressive
            forms.push('来て');      // kanji te-form
            forms.push('来た');      // kanji past
            forms.push('来ない');    // kanji negative
            forms.push('来ます');    // kanji polite
            forms.push('来ました');  // kanji polite past
            forms.push('来ている');  // kanji progressive
            forms.push('来てる');    // kanji casual progressive
        }

        // Irregular verb - ある (to exist, inanimate)
        if (word === 'ある') {
            forms.push('あって');    // te-form
            forms.push('あった');    // past
            forms.push('ない');      // negative (irregular!)
            forms.push('なかった');  // past negative
            forms.push('あります');  // polite
            forms.push('ありました'); // polite past
            forms.push('ありません'); // polite negative
            forms.push('あれば');    // conditional
            forms.push('あったり');  // tari-form
        }

        // Irregular verb - いる (to exist, animate)
        if (word === 'いる') {
            forms.push('いて');      // te-form
            forms.push('いた');      // past
            forms.push('いない');    // negative
            forms.push('いなかった'); // past negative
            forms.push('います');    // polite
            forms.push('いました');  // polite past
            forms.push('いません');  // polite negative
            forms.push('いれば');    // conditional
            forms.push('いたり');    // tari-form
            forms.push('いられる');  // potential
        }

        // Irregular verb - いく (hiragana version of 行く)
        if (word === 'いく') {
            forms.push('いって');    // te-form (irregular!)
            forms.push('いった');    // past
            forms.push('いかない');  // negative
            forms.push('いかなかった'); // past negative
            forms.push('いきます');  // polite
            forms.push('いきました'); // polite past
            forms.push('いきません'); // polite negative
            forms.push('いける');    // potential
            forms.push('いこう');    // volitional
            forms.push('いけ');      // imperative
            forms.push('いけば');    // conditional
            forms.push('いったり');  // tari-form
            forms.push('いっている'); // progressive
            forms.push('いってる');  // casual progressive
        }

        // い-adjective conjugations (includes しい adjectives)
        // Exclude いい which is irregular
        if (word.endsWith('い') && word !== 'いい' && word !== '良い') {
            const stem = word.slice(0, -1);
            forms.push(stem + 'くない');    // negative
            forms.push(stem + 'かった');    // past
            forms.push(stem + 'くなかった'); // past negative
            forms.push(stem + 'くて');      // te-form
            forms.push(stem + 'く');        // adverb form
            forms.push(stem + 'ければ');    // conditional
            forms.push(stem + 'さ');        // noun form
            forms.push(stem + 'そう');      // seems like
            forms.push(stem + 'すぎる');    // too much
        }

        // Irregular adjective - いい/良い (good)
        if (word === 'いい' || word === '良い') {
            forms.push('よくない');    // negative
            forms.push('よかった');    // past
            forms.push('よくなかった'); // past negative
            forms.push('よくて');      // te-form
            forms.push('よく');        // adverb form
            forms.push('よければ');    // conditional
            forms.push('よさ');        // noun form
            forms.push('よさそう');    // seems good
            forms.push('良くない');    // kanji negative
            forms.push('良かった');    // kanji past
            forms.push('良くて');      // kanji te-form
            forms.push('良く');        // kanji adverb
        }

        // Add compound verb forms for te-form combinations
        // These are common patterns that attach to the te-form
        if (word.endsWith('る') || word.endsWith('う') || word.endsWith('く') ||
            word.endsWith('ぐ') || word.endsWith('す') || word.endsWith('つ') ||
            word.endsWith('ぬ') || word.endsWith('ぶ') || word.endsWith('む')) {
            // Get all te-forms we've generated and add common compounds
            const teForms = forms.filter(f => f.endsWith('て') || f.endsWith('で'));
            teForms.forEach(teForm => {
                forms.push(teForm + 'いる');    // progressive (formal)
                forms.push(teForm + 'る');      // progressive (casual contraction)
                forms.push(teForm + 'いた');    // past progressive
                forms.push(teForm + 'た');      // past progressive (casual)
                forms.push(teForm + 'みる');    // try doing
                forms.push(teForm + 'みた');    // tried doing
                forms.push(teForm + 'しまう');  // completely do
                forms.push(teForm + 'しまった'); // completely did
                forms.push(teForm + 'おく');    // do in advance
                forms.push(teForm + 'おいた');  // did in advance
                forms.push(teForm + 'くる');    // come to do
                forms.push(teForm + 'きた');    // came to do
                forms.push(teForm + 'いく');    // go on doing
                forms.push(teForm + 'いった');  // went on doing
                forms.push(teForm + 'から');    // after doing
                forms.push(teForm + 'も');      // even if
                forms.push(teForm + 'ください'); // please do
                forms.push(teForm + 'くれる');  // do for me
                forms.push(teForm + 'くれた');  // did for me
                forms.push(teForm + 'もらう');  // have someone do
                forms.push(teForm + 'もらった'); // had someone do
                forms.push(teForm + 'あげる');  // do for someone
                forms.push(teForm + 'あげた');  // did for someone
            });
        }

        // Remove duplicates and empty strings
        return [...new Set(forms.filter(f => f && f.length > 0))];
    }

    displayStory(story, items) {
        let highlightedStory = story;

        // Build a list of all forms to highlight with their type
        const highlights = [];

        items.forEach(item => {
            const characters = item.data.characters || item.data.character || item.data.slug;
            const type = item.object; // 'vocabulary', 'kanji', or 'radical'

            if (type === 'vocabulary') {
                // Get all verb/adjective forms for vocabulary
                const forms = this.getVerbForms(characters);
                console.log(`[Highlight] Vocab "${characters}" - generated ${forms.length} forms:`, forms);
                forms.forEach(form => {
                    highlights.push({ text: form, type: 'vocab', source: characters });
                });
            } else if (type === 'kanji') {
                // For kanji, just highlight the single character wherever it appears
                console.log(`[Highlight] Kanji "${characters}"`);
                highlights.push({ text: characters, type: 'kanji', source: characters });
            } else if (type === 'radical') {
                highlights.push({ text: characters, type: 'radical', source: characters });
            }
        });

        // Sort by length (longest first) to prevent partial matches
        highlights.sort((a, b) => b.text.length - a.text.length);

        // Use placeholder tokens to avoid double-highlighting
        const placeholders = [];

        highlights.forEach((highlight, index) => {
            const placeholder = `\x00${index}\x00`; // Use null char as delimiter
            const escapedText = highlight.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(escapedText, 'g');

            if (highlightedStory.includes(highlight.text)) {
                console.log(`[Highlight] MATCHED: "${highlight.text}" (from ${highlight.source})`);
                highlightedStory = highlightedStory.replace(regex, placeholder);
                placeholders.push({
                    placeholder,
                    text: highlight.text,
                    type: highlight.type
                });
            }
        });

        // Replace placeholders with highlighted spans
        placeholders.forEach(({ placeholder, text, type }) => {
            const cssClass = type === 'vocab' ? 'highlight-vocab' :
                            type === 'kanji' ? 'highlight-kanji' : 'highlight-radical';
            highlightedStory = highlightedStory.split(placeholder).join(
                `<span class="${cssClass}">${text}</span>`
            );
        });

        console.log('[Highlight] Story text:', story);
        console.log('[Highlight] Final highlighted:', highlightedStory);
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
