# 🎓 Classmate - Transform Your Learning Experience

> **A community-driven platform that makes course content more accessible, collaborative, and efficient for college students.**

![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)
![Express.js](https://img.shields.io/badge/Express.js-404D59?style=for-the-badge)
![OpenAI](https://img.shields.io/badge/OpenAI-412991?style=for-the-badge&logo=openai&logoColor=white)

## ✨ Features

- 🎧 **AI-Powered Lecture Recordings** - Automatic transcription and GPT-4 summaries
- ✅ **Real-Time Attendance Alerts** - Never miss participation points
- 👥 **Course Communities** - Class-specific chat and study sessions
- 📚 **Smart Resource Library** - Drag-and-drop file sharing with organization

## 🚀 Quick Start

1. **Clone and install**
   ```bash
   git clone https://github.com/yourusername/classmate.git
   cd classmate
   npm install
   ```

2. **Set OpenAI API key**
   ```bash
   export OPENAI_API_KEY=your_openai_api_key_here
   ```

3. **Start the server**
   ```bash
   npm start
   ```

4. **Open browser** → `http://localhost:3000`

## 🛠️ Technology Stack

- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Backend**: Node.js, Express.js, Multer
- **AI**: OpenAI Whisper (transcription), GPT-4 (summarization)
- **Storage**: File-based JSON (database-ready)

## 📁 Project Structure

```
classmate/
├── index.html              # Landing page
├── auth.html               # Authentication
├── dashboard.html          # Main dashboard
├── lecture-recorder.js     # Recording functionality
├── server.js              # Backend API
├── package.json           # Dependencies
├── uploads/               # File storage
└── data/                  # JSON data
```

## 🔧 Key API Endpoints

- `POST /api/process-recording` - Upload and process audio
- `POST /api/upload-resource` - Upload files
- `GET /api/recordings` - List recordings
- `GET /api/resources` - List resources

## 📈 Usage

### Recording Lectures
1. Dashboard → Recordings → Select course
2. Click "🔴 Start Recording" → Record → Stop
3. Wait for AI processing → Get transcript + summary

### Sharing Resources
1. Dashboard → Resources → "Upload Resource"
2. Select course, add title, drag file → Upload

### Getting Alerts
1. Join course communities → Enable notifications
2. Receive real-time attendance alerts