import { GoogleGenerativeAI } from '@google/generative-ai';

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

            // Story
            storySection: document.getElementById('storySection'),
            storyText: document.getElementById('storyText'),
            generateQuiz: document.getElementById('generateQuiz'),
            startQuiz: document.getElementById('startQuiz'),

            // Quiz
            quizSection: document.getElementById('quizSection'),
            progressFill: document.getElementById('progressFill'),
            progressText: document.getElementById('progressText'),
            quizItemType: document.getElementById('quizItemType'),
            quizItemCharacter: document.getElementById('quizItemCharacter'),
            quizQuestion: document.getElementById('quizQuestion'),
            answerInput: document.getElementById('answerInput'),
            submitAnswer: document.getElementById('submitAnswer'),
            resultSection: document.getElementById('resultSection'),
            resultMessage: document.getElementById('resultMessage'),
            nextQuestion: document.getElementById('nextQuestion'),

            // Quiz Complete
            quizComplete: document.getElementById('quizComplete'),
            scoreDisplay: document.getElementById('scoreDisplay'),
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
            if (e.key === 'Enter') this.submitAnswer();
        });
        this.elements.nextQuestion.addEventListener('click', () => this.nextQuestion());
        this.elements.newQuiz.addEventListener('click', () => this.generateQuiz());
        this.elements.retryButton.addEventListener('click', () => this.generateQuiz());
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
            // Test with a simple request
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

        // Validate both keys
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
            // Fetch review items
            const reviewItems = await this.fetchReviewItems();

            // Check if we have enough vocabulary and kanji
            const vocabCount = reviewItems.filter(item => item.object === 'vocabulary').length;
            const kanjiCount = reviewItems.filter(item => item.object === 'kanji').length;

            if (vocabCount < 3) {
                this.showError(`Not enough vocabulary items available. You have ${vocabCount} vocabulary items. Need at least 3.`);
                return;
            }

            if (kanjiCount < 2) {
                this.showError(`Not enough kanji items available. You have ${kanjiCount} kanji items. Need at least 2.`);
                return;
            }

            this.showLoading('Selecting quiz items...');
            this.selectedItems = this.selectQuizItems(reviewItems);

            // Calculate total questions (each item gets 2 questions: meaning + reading)
            const totalQuestions = this.calculateTotalQuestions(this.selectedItems);
            console.log(`Selected ${this.selectedItems.length} items (${this.selectedItems.filter(i => i.object === 'vocabulary').length} vocab, ${this.selectedItems.filter(i => i.object === 'kanji').length} kanji) for ${totalQuestions} questions`);

            this.showLoading('Generating story...');
            this.story = await this.generateStory(this.selectedItems);

            this.displayStory(this.story, this.selectedItems);
            this.showMainContent();
            this.elements.storySection.style.display = 'block';
            this.elements.storySection.classList.remove('quiz-active');
            this.elements.quizSection.style.display = 'none';
            this.elements.quizComplete.style.display = 'none';
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
        return subjectsData.data || [];
    }

    selectQuizItems(items) {
        // Separate by type
        const vocabulary = items.filter(item => item.object === 'vocabulary');
        const kanji = items.filter(item => item.object === 'kanji');

        // Select exactly 3 vocabulary and 2 kanji
        const shuffledVocab = this.shuffleArray([...vocabulary]);
        const shuffledKanji = this.shuffleArray([...kanji]);

        const selected = [
            ...shuffledVocab.slice(0, 3), // Exactly 3 vocabulary
            ...shuffledKanji.slice(0, 2)   // Exactly 2 kanji
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

    calculateTotalQuestions(items) {
        // Each vocabulary and kanji item gets 2 questions (meaning + reading)
        // With exactly 3 vocab + 2 kanji, we get 10 questions total
        return items.length * 2;
    }

    async generateStory(items) {
        if (!this.geminiClient) {
            throw new Error('Gemini client not initialized');
        }

        // Try different models in order of preference
        const models = ['gemini-2.5-flash', 'gemini-1.5-pro', 'gemini-1.0-pro'];

        for (const modelName of models) {
            try {
                const model = this.geminiClient.getGenerativeModel({ model: modelName });

                // Build prompt with all items
                let prompt = 'Generate a natural 3-4 sentence Japanese paragraph that includes all of these items:\n\n';

                items.forEach(item => {
                    const characters = item.data.characters || item.data.character || item.data.slug;
                    const meanings = item.data.meanings || [];
                    const primaryMeaning = meanings.find(m => m.primary)?.meaning || meanings[0]?.meaning || 'unknown';

                    prompt += `- ${characters} (${primaryMeaning})\n`;
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
                // Continue to next model
            }
        }

        throw new Error('All Gemini models failed. Please check your API key and try again.');
    }

    displayStory(story, items) {
        let highlightedStory = story;

        // Sort items by length (longest first) to handle overlapping matches
        const sortedItems = [...items].sort((a, b) => {
            const aChars = (a.data.characters || a.data.character || a.data.slug || '').length;
            const bChars = (b.data.characters || b.data.character || b.data.slug || '').length;
            return bChars - aChars;
        });

        // Highlight each item
        sortedItems.forEach(item => {
            const characters = item.data.characters || item.data.character || item.data.slug;
            const type = item.object;

            let colorClass = '';
            if (type === 'vocabulary') {
                colorClass = 'highlight-vocab'; // Purple (#9e5aff)
            } else if (type === 'kanji') {
                colorClass = 'highlight-kanji'; // Magenta (#ff0066)
            }
            // Radicals are not highlighted in the story

            // Escape special regex characters
            const escapedChars = characters.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(escapedChars, 'g');

            highlightedStory = highlightedStory.replace(regex, (match) => {
                return `<span class="${colorClass}">${match}</span>`;
            });
        });

        this.elements.storyText.innerHTML = highlightedStory;
    }

    startQuizSession() {
        this.quizItems = this.createQuizQuestions(this.selectedItems);
        this.currentQuizIndex = 0;
        this.quizScore = 0;
        this.elements.storySection.classList.add('quiz-active');
        this.elements.quizSection.style.display = 'block';
        this.elements.quizComplete.style.display = 'none';
        this.displayQuestion(0);
    }

    createQuizQuestions(items) {
        const questions = [];

        items.forEach(item => {
            // All items (vocabulary and kanji) get both meaning and reading questions
            questions.push({
                item: item,
                type: 'meaning',
                question: `What is the meaning of ${item.data.characters || item.data.character}?`
            });
            questions.push({
                item: item,
                type: 'reading',
                question: `What is the reading of ${item.data.characters || item.data.character}?`
            });
        });

        return questions;
    }

    displayQuestion(index) {
        if (index >= this.quizItems.length) {
            this.completeQuiz();
            return;
        }

        const question = this.quizItems[index];
        const item = question.item;
        const characters = item.data.characters || item.data.character || item.data.slug;
        const type = item.object;

        this.elements.quizItemType.textContent = type.toUpperCase();
        this.elements.quizItemCharacter.textContent = characters;

        // Use the pre-defined question
        this.elements.quizQuestion.textContent = question.question;

        // Store question info for answer checking
        this.currentQuestion = question;

        // Update progress
        const progress = ((index + 1) / this.quizItems.length) * 100;
        this.elements.progressFill.style.width = `${progress}%`;
        this.elements.progressText.textContent = `Question ${index + 1} of ${this.quizItems.length}`;

        // Reset UI
        this.elements.answerInput.value = '';
        this.elements.resultSection.style.display = 'none';
        this.elements.answerInput.focus();
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

        if (isCorrect) {
            this.quizScore++;
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
            this.elements.resultMessage.textContent = '✅ Correct!';
            this.elements.resultMessage.className = 'result-message correct';
        } else {
            this.elements.resultMessage.textContent = `❌ Incorrect: the answer is ${correctAnswerText}`;
            this.elements.resultMessage.className = 'result-message incorrect';
        }
    }

    nextQuestion() {
        this.currentQuizIndex++;
        this.displayQuestion(this.currentQuizIndex);
    }

    completeQuiz() {
        this.elements.quizSection.style.display = 'none';
        this.elements.quizComplete.style.display = 'block';

        const totalQuestions = this.quizItems.length;
        const percentage = Math.round((this.quizScore / totalQuestions) * 100);

        this.elements.scoreDisplay.innerHTML = `
            <div>You got ${this.quizScore} out of ${totalQuestions} correct!</div>
            <div style="font-size: 0.9em; margin-top: 10px; color: #666;">
                Score: ${percentage}%
            </div>
        `;
    }
}

// Initialize the app when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new StoryQuizApp();
});
