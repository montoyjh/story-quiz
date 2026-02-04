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
            clearKeys: document.getElementById('clearKeys'),
            validateWanikani: document.getElementById('validateWanikani'),
            validateGemini: document.getElementById('validateGemini'),
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
        this.elements.clearKeys.addEventListener('click', () => this.clearApiKeys());
        this.elements.validateWanikani.addEventListener('click', () => this.validateWanikaniOnly());
        this.elements.validateGemini.addEventListener('click', () => this.validateGeminiOnly());
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

    async saveApiKeys() {
        const wanikaniToken = this.elements.wanikaniToken.value.trim();
        const geminiKey = this.elements.geminiKey.value.trim();

        if (!wanikaniToken || !geminiKey) {
            this.showStatus('Please enter both API keys', 'error');
            return;
        }

        this.showStatus('Validating API keys...', 'success');

        // Validate keys
        const isValid = await this.validateApiKeys(wanikaniToken, geminiKey);
        
        if (isValid) {
            this.wanikaniToken = wanikaniToken;
            this.geminiKey = geminiKey;
            localStorage.setItem('wanikani_api_token', wanikaniToken);
            localStorage.setItem('gemini_api_key', geminiKey);
            this.showStatus('API keys saved successfully!', 'success');
            setTimeout(() => {
                this.showMainContent();
            }, 1000);
        } else {
            this.showStatus('Invalid API keys. Please check and try again.', 'error');
        }
    }

    async validateApiKeys(wanikaniToken, geminiKey) {
        try {
            // Validate WaniKani token
            const wkResponse = await fetch('https://api.wanikani.com/v2/user', {
                headers: {
                    'Authorization': `Bearer ${wanikaniToken}`,
                    'Wanikani-Revision': '20170710'
                }
            });

            if (!wkResponse.ok) {
                return false;
            }

            const geminiOk = await this.validateGeminiKey(geminiKey);
            return geminiOk;
        } catch (error) {
            console.error('Validation error:', this.extractErrorMessage(error));
            return false;
        }
    }

    async validateWanikaniOnly() {
        const token = this.elements.wanikaniToken.value.trim();
        if (!token) {
            this.showStatus('Enter WaniKani token first.', 'error');
            return;
        }
        this.showStatus('Validating WaniKani token...', 'success');
        const ok = await this.validateWanikaniToken(token);
        this.showStatus(ok ? 'WaniKani token is valid.' : 'WaniKani token is invalid.', ok ? 'success' : 'error');
    }

    async validateGeminiOnly() {
        const key = this.elements.geminiKey.value.trim();
        if (!key) {
            this.showStatus('Enter Gemini key first.', 'error');
            return;
        }
        this.showStatus('Validating Gemini key...', 'success');
        const ok = await this.validateGeminiKey(key);
        this.showStatus(ok ? 'Gemini key is valid.' : 'Gemini key is invalid.', ok ? 'success' : 'error');
    }

    async validateWanikaniToken(token) {
        try {
            const wkResponse = await fetch('https://api.wanikani.com/v2/user', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Wanikani-Revision': '20170710'
                }
            });
            return wkResponse.ok;
        } catch {
            return false;
        }
    }

    async validateGeminiKey(key) {
        // Use REST v1 with known-good models
        const models = ['gemini-1.5-flash', 'gemini-1.5-pro'];
        for (const modelName of models) {
            try {
                const resp = await fetch(`https://generativelanguage.googleapis.com/v1/models/${modelName}:generateContent?key=${key}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        contents: [{
                            parts: [{
                                text: 'test'
                            }]
                        }]
                    })
                });
                if (resp.ok) return true;
            } catch (e) {
                continue;
            }
        }
        return false;
    }

    clearApiKeys() {
        if (confirm('Are you sure you want to clear your API keys?')) {
            localStorage.removeItem('wanikani_api_token');
            localStorage.removeItem('gemini_api_key');
            this.wanikaniToken = null;
            this.geminiKey = null;
            this.elements.wanikaniToken.value = '';
            this.elements.geminiKey.value = '';
            this.showStatus('API keys cleared', 'success');
        }
    }

    showStatus(message, type) {
        this.elements.statusMessage.textContent = message;
        this.elements.statusMessage.className = `status-message ${type}`;
    }

    async generateQuiz() {
        this.showLoading('Fetching review items...');
        
        try {
            // Fetch review items
            const reviewItems = await this.fetchReviewItems();
            
            if (reviewItems.length < 5) {
                this.showError(`Not enough review items available. You have ${reviewItems.length} items. Need at least 5.`);
                return;
            }

            this.showLoading('Selecting quiz items...');
            this.selectedItems = this.selectQuizItems(reviewItems);

            this.showLoading('Generating story...');
            this.story = await this.generateStory(this.selectedItems);

            this.displayStory(this.story, this.selectedItems);
            this.showMainContent();
            this.elements.storySection.style.display = 'block';
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
        const radicals = items.filter(item => item.object === 'radical');

        const selected = [];
        
        // Select 3-4 vocabulary
        const vocabCount = Math.floor(Math.random() * 2) + 3; // 3 or 4
        const shuffledVocab = this.shuffleArray([...vocabulary]);
        selected.push(...shuffledVocab.slice(0, vocabCount));

        // Select 1-2 kanji
        const kanjiCount = Math.floor(Math.random() * 2) + 1; // 1 or 2
        const shuffledKanji = this.shuffleArray([...kanji]);
        selected.push(...shuffledKanji.slice(0, kanjiCount));

        // Select 0-1 radical
        if (radicals.length > 0 && selected.length < 5) {
            const shuffledRadicals = this.shuffleArray([...radicals]);
            selected.push(shuffledRadicals[0]);
        }

        // Ensure exactly 5 items
        return selected.slice(0, 5);
    }

    shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    async generateStory(items) {
        // Try models in order of preference (REST v1 endpoints)
        const models = ['gemini-1.5-flash', 'gemini-1.5-pro'];
        for (const modelName of models) {
            try {
                return await this.generateStoryWithModel(items, modelName);
            } catch (error) {
                console.log(`Model ${modelName} failed:`, error.message);
                if (!error.message.includes('404') && !error.message.includes('Not Found')) {
                    throw error;
                }
                continue;
            }
        }
        throw new Error('All Gemini models failed. Please check your API key and try again.');
    }

    async generateStoryWithModel(items, modelName) {
        // Build prompt with all items
        let prompt = 'Generate a natural 3-4 sentence Japanese paragraph that includes all of these items:\n\n';
        
        items.forEach(item => {
            const characters = item.data.characters || item.data.character || item.data.slug;
            const meanings = item.data.meanings || [];
            const primaryMeaning = meanings.find(m => m.primary)?.meaning || meanings[0]?.meaning || 'unknown';
            
            prompt += `- ${characters} (${primaryMeaning})\n`;
        });

        prompt += '\nThe paragraph should be coherent and natural. Include all items naturally in context.\n';
        prompt += 'Return only the Japanese paragraph, no additional text or explanations.';

        const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/${modelName}:generateContent?key=${this.geminiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: prompt
                    }]
                }]
            })
        });

        if (!response.ok) {
            let errorMessage = `API error: ${response.status}`;
            try {
                const errorData = await response.json();
                errorMessage = errorData.error?.message || errorMessage;
            } catch (e) {
                const errorText = await response.text();
                errorMessage = errorText || errorMessage;
            }
            throw new Error(errorMessage);
        }

        const data = await response.json();
        const storyText = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!storyText) {
            throw new Error('No story text returned from API');
        }

        return storyText.trim();
    }

    extractErrorMessage(error) {
        if (!error) return 'Unknown error';
        // SDK error format
        if (error.response && error.response.error) {
            return error.response.error.message || JSON.stringify(error.response.error);
        }
        // Direct message
        if (error.message) return error.message;
        try {
            return JSON.stringify(error);
        } catch {
            return 'Unknown error';
        }
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
                colorClass = 'highlight-vocab';
            } else if (type === 'kanji') {
                colorClass = 'highlight-kanji';
            } else if (type === 'radical') {
                colorClass = 'highlight-radical';
            }

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
        this.quizItems = [...this.selectedItems];
        this.currentQuizIndex = 0;
        this.quizScore = 0;
        this.elements.storySection.style.display = 'none';
        this.elements.quizSection.style.display = 'block';
        this.elements.quizComplete.style.display = 'none';
        this.displayQuestion(0);
    }

    displayQuestion(index) {
        if (index >= this.quizItems.length) {
            this.completeQuiz();
            return;
        }

        const item = this.quizItems[index];
        const characters = item.data.characters || item.data.character || item.data.slug;
        const type = item.object;

        this.elements.quizItemType.textContent = type.toUpperCase();
        this.elements.quizItemCharacter.textContent = characters;
        
        // Determine question type (reading or meaning)
        const questionType = Math.random() < 0.5 ? 'reading' : 'meaning';
        
        if (type === 'radical') {
            this.elements.quizQuestion.textContent = 'What is the name of this radical?';
        } else if (questionType === 'reading') {
            this.elements.quizQuestion.textContent = `What is the reading of ${characters}?`;
        } else {
            this.elements.quizQuestion.textContent = `What is the meaning of ${characters}?`;
        }

        // Store question type and correct answers
        this.currentQuestionType = questionType;
        this.currentQuestionItem = item;

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
        if (item.object === 'radical') {
            const meanings = item.data.meanings || [];
            return meanings.filter(m => m.accepted_answer).map(m => m.meaning.toLowerCase());
        }

        if (questionType === 'reading') {
            const readings = item.data.readings || [];
            return readings.filter(r => r.accepted_answer).map(r => r.reading);
        } else {
            const meanings = item.data.meanings || [];
            return meanings.filter(m => m.accepted_answer).map(m => m.meaning.toLowerCase());
        }
    }

    async submitAnswer() {
        const userAnswer = this.elements.answerInput.value.trim();
        
        if (!userAnswer) {
            return;
        }

        const correctAnswers = this.getCorrectAnswers(this.currentQuestionItem, this.currentQuestionType);
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
        this.elements.scoreDisplay.textContent = `You got ${this.quizScore} out of ${this.quizItems.length} correct!`;
    }
}

// Initialize the app when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new StoryQuizApp();
});

