# WaniKani Story Quiz

A web application that generates contextual Japanese stories from WaniKani review items and presents comprehensive quizzes for language learning.

## Features

- 📚 **Contextual Story Generation**: Uses Google Gemini AI to create natural Japanese stories containing selected vocabulary and kanji
- 🎨 **Color-Coded Highlighting**: Vocabulary highlighted in purple, kanji in magenta
- 📝 **Comprehensive Quizzes**: Tests both meaning and reading for each item
- 🎯 **Focused Learning**: Each story contains exactly 3 vocabulary words and 2 kanji
- 📊 **Progress Tracking**: Visual progress bar and score display
- 🔑 **API Key Management**: Secure storage and validation for WaniKani and Gemini API keys

## Setup

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- WaniKani API token ([Get one here](https://www.wanikani.com/settings/personal_access_tokens))
- Google Gemini API key ([Get one here](https://aistudio.google.com/app/apikey))

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

### Build

```bash
npm run build
```

## Usage

1. **Enter API Keys**: Input your WaniKani API token and Gemini API key
2. **Validate**: Use the individual validation buttons to test each API key
3. **Generate Quiz**: Click "Generate New Quiz" to create a story with 5 items (3 vocab + 2 kanji)
4. **Read Story**: Review the generated story with highlighted vocabulary and kanji
5. **Start Quiz**: Answer 10 questions (2 per item: meaning + reading)
6. **Review Results**: See your score and percentage

## Quiz Structure

Each quiz contains:
- **3 Vocabulary items** (purple highlighting)
- **2 Kanji items** (magenta highlighting)
- **10 Questions total**:
  - Each vocabulary: meaning question + reading question
  - Each kanji: meaning question + reading question

## Technology Stack

- **Frontend**: Vanilla JavaScript (ES Modules)
- **Build Tool**: Vite
- **AI**: Google Generative AI SDK (`@google/generative-ai`)
- **API**: WaniKani API v2
- **Styling**: Custom CSS with WaniKani-inspired design

## Project Structure

```
story-quiz/
├── index.html          # Main HTML structure
├── main.js             # Application logic
├── styles.css          # Styling
├── package.json        # Dependencies
├── vite.config.js      # Vite configuration
└── README.md          # This file
```

## License

MIT

