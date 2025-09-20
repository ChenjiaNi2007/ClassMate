// lecture-recorder.js
class LectureRecorder {
    constructor() {
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.isRecording = false;
        this.startTime = null;
        this.timerInterval = null;
        this.currentCourse = null;
    }

    // Get optimal MIME type for recording
    getOptimalMimeType() {
        if (window.MediaRecorder && MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
            return 'audio/webm;codecs=opus';
        }
        if (window.MediaRecorder && MediaRecorder.isTypeSupported('audio/mp4')) {
            return 'audio/mp4';
        }
        return '';
    }

    // Format time for display
    formatTime(milliseconds) {
        const seconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(seconds / 60).toString().padStart(2, '0');
        const remainingSeconds = (seconds % 60).toString().padStart(2, '0');
        return `${minutes}:${remainingSeconds}`;
    }

    // Start recording
    async startRecording() {
        try {
            // Get current course from the dashboard
            this.currentCourse = this.getCurrentCourse();
            
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    sampleRate: 44100
                }
            });

            const mimeType = this.getOptimalMimeType();
            this.mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
            
            this.audioChunks = [];
            this.startTime = Date.now();
            
            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data && event.data.size > 0) {
                    this.audioChunks.push(event.data);
                }
            };

            this.mediaRecorder.onstart = () => {
                this.isRecording = true;
                this.startTimer();
                this.updateUI('recording');
                console.log('Recording started...');
            };

            this.mediaRecorder.onstop = async () => {
                this.isRecording = false;
                this.stopTimer();
                this.updateUI('processing');
                await this.processRecording();
                stream.getTracks().forEach(track => track.stop());
            };

            this.mediaRecorder.start(1000); // Collect data every second
            
        } catch (error) {
            console.error('Failed to start recording:', error);
            alert('Could not access microphone. Please check browser permissions.');
            this.updateUI('error');
        }
    }

    // Stop recording
    stopRecording() {
        if (this.mediaRecorder && this.isRecording) {
            this.mediaRecorder.stop();
        }
    }

    // Start timer
    startTimer() {
        this.timerInterval = setInterval(() => {
            const elapsed = Date.now() - this.startTime;
            this.updateTimer(this.formatTime(elapsed));
        }, 500);
    }

    // Stop timer
    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    // Process the recording
    async processRecording() {
        try {
            const audioBlob = new Blob(this.audioChunks, { 
                type: this.mediaRecorder.mimeType || 'audio/webm'
            });
            
            console.log('Processing audio blob:', {
                size: audioBlob.size,
                type: audioBlob.type,
                duration: Date.now() - this.startTime
            });

            // Send to backend for processing
            await this.sendToAPI(audioBlob);
            
        } catch (error) {
            console.error('Failed to process recording:', error);
            this.updateUI('error');
        }
    }

    // Send audio to API
    async sendToAPI(audioBlob) {
        const formData = new FormData();
        const filename = `lecture_${this.currentCourse}_${new Date().toISOString()}.webm`;
        formData.append('audio', audioBlob, filename);
        formData.append('course', this.currentCourse);
        formData.append('timestamp', new Date().toISOString());
        formData.append('duration', Date.now() - this.startTime);

        try {
            this.updateUI('uploading');
            
            const response = await fetch('/api/process-recording', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();
            console.log('API Response:', result);
            
            this.displayResults(result);
            this.updateUI('completed');
            
        } catch (error) {
            console.error('API call failed:', error);
            
            // Fallback: try client-side processing with file download
            this.handleOfflineMode(audioBlob);
        }
    }

    // Fallback for when API is not available
    handleOfflineMode(audioBlob) {
        console.log('API unavailable, providing download option...');
        
        const url = URL.createObjectURL(audioBlob);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `lecture_${this.currentCourse}_${timestamp}.webm`;
        
        // Create download link
        const downloadLink = document.createElement('a');
        downloadLink.href = url;
        downloadLink.download = filename;
        downloadLink.textContent = 'Download Recording';
        downloadLink.className = 'btn btn-success';
        
        // Show in results area
        this.displayOfflineResults(downloadLink, audioBlob);
        this.updateUI('completed');
    }

    // Get current course from dashboard
    getCurrentCourse() {
        // Try to get from a selected course dropdown, or use first course
        const courseSelect = document.getElementById('recordingCourseSelect');
        if (courseSelect && courseSelect.value) {
            return courseSelect.value;
        }
        
        // Fallback to first course in user's course list
        const courses = JSON.parse(localStorage.getItem('userCourses') || '[]');
        return courses[0] || 'Unknown Course';
    }

    // Update timer display
    updateTimer(timeString) {
        const timerEl = document.getElementById('recording-timer');
        if (timerEl) {
            timerEl.textContent = timeString;
        }
    }

    // Update UI based on recording state
    updateUI(state) {
        const button = document.getElementById('record-button');
        const status = document.getElementById('recording-status');
        const timer = document.getElementById('recording-timer');
        
        switch(state) {
            case 'recording':
                if (button) {
                    button.textContent = '⏹️ Stop Recording';
                    button.className = 'btn btn-danger';
                }
                if (status) status.textContent = 'Recording...';
                if (timer) timer.style.display = 'inline';
                break;
                
            case 'processing':
                if (button) {
                    button.textContent = '⏳ Processing...';
                    button.disabled = true;
                }
                if (status) status.textContent = 'Processing audio...';
                break;
                
            case 'uploading':
                if (status) status.textContent = 'Uploading and transcribing...';
                break;
                
            case 'completed':
                if (button) {
                    button.textContent = '🔴 Start Recording';
                    button.className = 'btn btn-danger';
                    button.disabled = false;
                }
                if (status) status.textContent = 'Recording completed!';
                if (timer) {
                    timer.style.display = 'none';
                    timer.textContent = '00:00';
                }
                break;
                
            case 'error':
                if (button) {
                    button.textContent = '🔴 Start Recording';
                    button.className = 'btn btn-danger';
                    button.disabled = false;
                }
                if (status) status.textContent = 'Error occurred';
                if (timer) {
                    timer.style.display = 'none';
                    timer.textContent = '00:00';
                }
                break;
        }
    }

    // Display API results
    displayResults(result) {
        const resultsDiv = document.getElementById('recording-results');
        if (!resultsDiv) return;

        resultsDiv.innerHTML = `
            <div class="recording-result-card">
                <h4>📝 Recording Processed Successfully</h4>
                <div class="result-section">
                    <h5>Transcript:</h5>
                    <div class="transcript-text">${result.transcript || 'No transcript available'}</div>
                </div>
                <div class="result-section">
                    <h5>AI Summary:</h5>
                    <div class="summary-text">${result.summary || 'No summary available'}</div>
                </div>
                <div class="result-actions">
                    <button class="btn btn-primary" onclick="copyTranscript()">Copy Transcript</button>
                    <button class="btn btn-success" onclick="saveToLibrary('${result.recordingId}')">Save to Library</button>
                </div>
            </div>
        `;
    }

    // Display offline results
    displayOfflineResults(downloadLink, audioBlob) {
        const resultsDiv = document.getElementById('recording-results');
        if (!resultsDiv) return;

        resultsDiv.innerHTML = `
            <div class="recording-result-card">
                <h4>🎧 Recording Completed</h4>
                <p>Recording size: ${(audioBlob.size / 1024 / 1024).toFixed(2)} MB</p>
                <p>API processing unavailable - download your recording below:</p>
                <div class="result-actions">
                    ${downloadLink.outerHTML}
                </div>
                <p class="note">Note: Upload this file to get AI transcription and summary.</p>
            </div>
        `;
    }
}

// Global functions for UI interactions
function copyTranscript() {
    const transcriptText = document.querySelector('.transcript-text');
    if (transcriptText) {
        navigator.clipboard.writeText(transcriptText.textContent);
        alert('Transcript copied to clipboard!');
    }
}

function saveToLibrary(recordingId) {
    // Add recording to user's library in localStorage
    const recordings = JSON.parse(localStorage.getItem('userRecordings') || '[]');
    recordings.push({
        id: recordingId,
        date: new Date().toISOString(),
        course: lectureRecorder.currentCourse
    });
    localStorage.setItem('userRecordings', JSON.stringify(recordings));
    alert('Recording saved to your library!');
}

// Initialize global recorder instance
let lectureRecorder = new LectureRecorder();