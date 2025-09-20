// server.js
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const OpenAI = require('openai');

const app = express();
const port = 3000;

// Initialize OpenAI client
const openai = new OpenAI();

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = './uploads';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'lecture-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 100 * 1024 * 1024 // 100MB limit
    },
    fileFilter: (req, file, cb) => {
        // Accept audio files
        if (file.mimetype.startsWith('audio/')) {
            cb(null, true);
        } else {
            cb(new Error('Only audio files are allowed!'), false);
        }
    }
});

// Serve static files
app.use(express.static('.'));
app.use(express.json());

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Main processing endpoint
app.post('/api/process-recording', upload.single('audio'), async (req, res) => {
    console.log('Processing recording request...');
    
    try {
        const audioFile = req.file;
        const course = req.body.course;
        const timestamp = req.body.timestamp;
        const duration = req.body.duration;

        if (!audioFile) {
            return res.status(400).json({ error: 'No audio file provided' });
        }

        console.log('File received:', {
            filename: audioFile.filename,
            size: audioFile.size,
            course: course
        });

        // Step 1: Transcribe audio using OpenAI Whisper
        console.log('Starting transcription...');
        const transcription = await openai.audio.transcriptions.create({
            file: fs.createReadStream(audioFile.path),
            model: "whisper-1",
            language: "en",
            response_format: "text"
        });

        console.log('Transcription completed, length:', transcription.length);

        // Step 2: Generate summary using GPT
        console.log('Generating summary...');
        const summaryResponse = await openai.chat.completions.create({
            model: "gpt-4",
            messages: [{
                role: "system",
                content: `You are an assistant that summarizes classroom lecture transcripts. Your task is to extract and organize the most important information for a student who missed class.

From the following transcript, please provide:

**Key Concepts & Definitions** — the main ideas the instructor emphasized.

**Examples / Applications** — any real-world examples, demonstrations, or problems the instructor gave.

**Important Questions** — questions asked by students or the instructor that help clarify the material.

**Announcements / Reminders** — homework due dates, quiz/exam info, or project updates.

**Summary in Plain English** — a short paragraph that makes the content easy to understand, as if explaining to a peer.

Format the output in clear sections with bullet points where useful. Avoid filler words or tangents.`
            }, {
                role: "user", 
                content: transcription
            }]
        });

        const summary = summaryResponse.choices[0].message.content;
        console.log('Summary generated, length:', summary.length);

        // Step 3: Save recording metadata (in a real app, this would go to a database)
        const recordingData = {
            id: generateRecordingId(),
            course: course,
            timestamp: timestamp,
            duration: duration,
            filename: audioFile.filename,
            transcript: transcription,
            summary: summary,
            created: new Date().toISOString()
        };

        // Save to JSON file (replace with database in production)
        const recordingsFile = './data/recordings.json';
        let recordings = [];
        
        // Create data directory if it doesn't exist
        if (!fs.existsSync('./data')) {
            fs.mkdirSync('./data', { recursive: true });
        }
        
        // Load existing recordings
        if (fs.existsSync(recordingsFile)) {
            try {
                recordings = JSON.parse(fs.readFileSync(recordingsFile, 'utf8'));
            } catch (e) {
                console.log('Creating new recordings file...');
                recordings = [];
            }
        }
        
        // Add new recording
        recordings.push(recordingData);
        
        // Save back to file
        fs.writeFileSync(recordingsFile, JSON.stringify(recordings, null, 2));

        console.log('Recording saved with ID:', recordingData.id);

        // Clean up uploaded file (optional - you might want to keep it)
        // fs.unlinkSync(audioFile.path);

        res.json({
            success: true,
            recordingId: recordingData.id,
            transcript: transcription,
            summary: summary,
            course: course,
            duration: duration
        });

    } catch (error) {
        console.error('Processing failed:', error);
        
        // Clean up file on error
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        
        res.status(500).json({ 
            error: 'Failed to process recording',
            details: error.message 
        });
    }
});

// Get all recordings
app.get('/api/recordings', (req, res) => {
    const recordingsFile = './data/recordings.json';
    
    if (fs.existsSync(recordingsFile)) {
        try {
            const recordings = JSON.parse(fs.readFileSync(recordingsFile, 'utf8'));
            res.json(recordings);
        } catch (e) {
            res.json([]);
        }
    } else {
        res.json([]);
    }
});

// Get specific recording
app.get('/api/recordings/:id', (req, res) => {
    const recordingsFile = './data/recordings.json';
    
    if (fs.existsSync(recordingsFile)) {
        try {
            const recordings = JSON.parse(fs.readFileSync(recordingsFile, 'utf8'));
            const recording = recordings.find(r => r.id === req.params.id);
            
            if (recording) {
                res.json(recording);
            } else {
                res.status(404).json({ error: 'Recording not found' });
            }
        } catch (e) {
            res.status(500).json({ error: 'Failed to load recording' });
        }
    } else {
        res.status(404).json({ error: 'No recordings found' });
    }
});

// Error handling middleware
app.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'File too large. Maximum size is 100MB.' });
        }
    }
    
    console.error('Server error:', error);
    res.status(500).json({ error: 'Internal server error' });
});

// Helper function to generate recording IDs
function generateRecordingId() {
    return 'rec_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Start server
app.listen(port, () => {
    console.log(`🚀 Server running at http://localhost:${port}`);
    console.log(`📁 Upload directory: ./uploads`);
    console.log(`💾 Data directory: ./data`);
    
    // Check OpenAI API key
    if (!process.env.OPENAI_API_KEY && openai.apiKey === 'your-openai-api-key-here') {
        console.warn('⚠️  Warning: OpenAI API key not set. Update OPENAI_API_KEY environment variable or edit server.js');
    }
});

module.exports = app;