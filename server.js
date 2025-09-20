// server.js
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const OpenAI = require('openai');

// Create Express app
const app = express();
const port = 3000;

// Initialize OpenAI client
const openai = new OpenAI({
    apiKey: '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'
});

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
        const fileExtension = path.extname(file.originalname);
        const baseName = path.basename(file.originalname, fileExtension);
        cb(null, baseName + '-' + uniqueSuffix + fileExtension);
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 100 * 1024 * 1024 // 100MB limit
    },
    fileFilter: (req, file, cb) => {
        // Accept audio files for recordings and documents for resources
        if (file.mimetype.startsWith('audio/') || 
            file.mimetype.startsWith('image/') ||
            file.mimetype.includes('pdf') ||
            file.mimetype.includes('document') ||
            file.mimetype.includes('word') ||
            file.mimetype.includes('powerpoint') ||
            file.mimetype.includes('text') ||
            file.originalname.match(/\.(pdf|doc|docx|ppt|pptx|txt|jpg|jpeg|png|gif)$/i)) {
            cb(null, true);
        } else {
            cb(new Error('File type not supported!'), false);
        }
    }
});

// Middleware
app.use(express.static('.'));
app.use(express.json());

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        message: 'Classmate server is running!'
    });
});

// Recording processing endpoint
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

        console.log('Audio file received:', {
            filename: audioFile.filename,
            size: audioFile.size,
            course: course
        });

        // Transcribe audio using OpenAI Whisper
        console.log('Starting transcription...');
        const transcription = await openai.audio.transcriptions.create({
            file: fs.createReadStream(audioFile.path),
            model: "whisper-1",
            language: "en",
            response_format: "text"
        });

        console.log('Transcription completed, length:', transcription.length);

        // Generate summary using GPT
        console.log('Generating summary...');
        const summaryResponse = await openai.chat.completions.create({
            model: "gpt-4",
            messages: [{
                role: "system",
                content: `You are an assistant that summarizes classroom lecture transcripts. Extract and organize the most important information for a student who missed class.

Provide:
- Key Concepts & Definitions
- Examples / Applications  
- Important Questions
- Announcements / Reminders
- Summary in Plain English

Format with clear sections and bullet points.`
            }, {
                role: "user", 
                content: transcription
            }]
        });

        const summary = summaryResponse.choices[0].message.content;
        console.log('Summary generated');

        // Save recording data
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

        saveToFile('./data/recordings.json', recordingData);
        console.log('Recording saved with ID:', recordingData.id);

        res.json({
            success: true,
            recordingId: recordingData.id,
            transcript: transcription,
            summary: summary,
            course: course,
            duration: duration
        });

    } catch (error) {
        console.error('Recording processing failed:', error);
        
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        
        res.status(500).json({ 
            error: 'Failed to process recording',
            details: error.message 
        });
    }
});

// Resource upload endpoint
app.post('/api/upload-resource', upload.single('file'), async (req, res) => {
    console.log('Processing resource upload...');
    
    try {
        const uploadedFile = req.file;
        const { course, title, description, isPublic, uploader } = req.body;

        if (!uploadedFile) {
            return res.status(400).json({ error: 'No file provided' });
        }

        if (!course || !title) {
            return res.status(400).json({ error: 'Course and title are required' });
        }

        console.log('Resource file received:', {
            filename: uploadedFile.filename,
            originalName: uploadedFile.originalname,
            size: uploadedFile.size,
            course: course,
            title: title
        });

        const resourceData = {
            id: generateResourceId(),
            course: course,
            title: title,
            description: description || '',
            fileName: uploadedFile.originalname,
            storedFileName: uploadedFile.filename,
            fileSize: uploadedFile.size,
            mimeType: uploadedFile.mimetype,
            uploader: uploader || 'Anonymous',
            uploadDate: new Date().toISOString(),
            downloads: 0,
            isPublic: isPublic === 'true',
            filePath: uploadedFile.path
        };

        saveToFile('./data/resources.json', resourceData);
        console.log('Resource saved with ID:', resourceData.id);

        res.json({
            success: true,
            id: resourceData.id,
            course: resourceData.course,
            title: resourceData.title,
            description: resourceData.description,
            fileName: resourceData.fileName,
            fileSize: resourceData.fileSize,
            uploader: resourceData.uploader,
            uploadDate: resourceData.uploadDate,
            downloads: resourceData.downloads,
            isPublic: resourceData.isPublic
        });

    } catch (error) {
        console.error('Resource upload failed:', error);
        
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        
        res.status(500).json({ 
            error: 'Failed to upload resource',
            details: error.message 
        });
    }
});

// Get all recordings
app.get('/api/recordings', (req, res) => {
    const recordings = loadFromFile('./data/recordings.json');
    res.json(recordings);
});

// Get specific recording
app.get('/api/recordings/:id', (req, res) => {
    const recordings = loadFromFile('./data/recordings.json');
    const recording = recordings.find(r => r.id === req.params.id);
    
    if (recording) {
        res.json(recording);
    } else {
        res.status(404).json({ error: 'Recording not found' });
    }
});

// Get all resources
app.get('/api/resources', (req, res) => {
    const resources = loadFromFile('./data/resources.json');
    // Don't expose file paths to client
    const publicResources = resources.map(r => ({
        id: r.id,
        course: r.course,
        title: r.title,
        description: r.description,
        fileName: r.fileName,
        fileSize: r.fileSize,
        uploader: r.uploader,
        uploadDate: r.uploadDate,
        downloads: r.downloads,
        isPublic: r.isPublic
    }));
    res.json(publicResources);
});

// Download resource
app.get('/api/resources/:id/download', (req, res) => {
    const resources = loadFromFile('./data/resources.json');
    const resource = resources.find(r => r.id === req.params.id);
    
    if (resource && fs.existsSync(resource.filePath)) {
        // Increment download count
        resource.downloads++;
        const allResources = loadFromFile('./data/resources.json');
        const updatedResources = allResources.map(r => 
            r.id === resource.id ? resource : r
        );
        fs.writeFileSync('./data/resources.json', JSON.stringify(updatedResources, null, 2));
        
        // Send file
        res.download(resource.filePath, resource.fileName);
    } else {
        res.status(404).json({ error: 'Resource not found' });
    }
});

// Delete resource
app.delete('/api/resources/:id', (req, res) => {
    try {
        const resources = loadFromFile('./data/resources.json');
        const resourceIndex = resources.findIndex(r => r.id === req.params.id);
        
        if (resourceIndex !== -1) {
            const resource = resources[resourceIndex];
            
            // Delete file from disk
            if (fs.existsSync(resource.filePath)) {
                fs.unlinkSync(resource.filePath);
            }
            
            // Remove from array
            resources.splice(resourceIndex, 1);
            
            // Save updated resources
            fs.writeFileSync('./data/resources.json', JSON.stringify(resources, null, 2));
            
            res.json({ success: true, message: 'Resource deleted successfully' });
        } else {
            res.status(404).json({ error: 'Resource not found' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete resource' });
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

// Helper functions
function generateRecordingId() {
    return 'rec_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function generateResourceId() {
    return 'resource_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function saveToFile(filePath, newData) {
    // Create directory if it doesn't exist
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    
    // Load existing data
    let existingData = [];
    if (fs.existsSync(filePath)) {
        try {
            existingData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        } catch (e) {
            console.log('Creating new file:', filePath);
            existingData = [];
        }
    }
    
    // Add new data
    existingData.push(newData);
    
    // Save back to file
    fs.writeFileSync(filePath, JSON.stringify(existingData, null, 2));
}

function loadFromFile(filePath) {
    if (fs.existsSync(filePath)) {
        try {
            return JSON.parse(fs.readFileSync(filePath, 'utf8'));
        } catch (e) {
            console.error('Error reading file:', filePath, e);
            return [];
        }
    }
    return [];
}

// Start server
app.listen(port, () => {
    console.log('🚀 Classmate Server Started Successfully!');
    console.log(`📍 Server URL: http://localhost:${port}`);
    console.log(`📁 Upload directory: ./uploads`);
    console.log(`💾 Data directory: ./data`);
    console.log('');
    
    // Check OpenAI API key
    if (!process.env.OPENAI_API_KEY && openai.apiKey === 'your-openai-api-key-here') {
        console.log('⚠️  OpenAI API key not configured.');
        console.log('   Set OPENAI_API_KEY environment variable or edit server.js');
        console.log('');
    }
    
    console.log('✅ Server ready for connections!');
});

module.exports = app;