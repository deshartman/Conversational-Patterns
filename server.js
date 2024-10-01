console.log('Starting server...');

const express = require('express');
const http = require('http');
const ExpressWs = require("express-ws");
const dotenv = require('dotenv');
const { GptService } = require('./services/GptService');
const { AIAssistantService } = require('./services/AIAssistantService');

console.log('Loading environment variables...');
dotenv.config();

const app = express();
const server = http.createServer(app);
const expressWs = ExpressWs(app, server);

const nodePort = process.env.NODE_PORT || 3000;
const nodeServerUrl = process.env.NODE_SERVER_URL || 'localhost';

app.use(express.json());
// Parse URL-encoded bodies
app.use(express.urlencoded({ extended: true }));

/**
 * Testing endpoints for the server. echo endpoint and websocket endpoint
 */

// Add a simple echo endpoint for testing
app.get('/echo', (req, res) => {
    console.log(`Server is live ${nodeServerUrl}:${nodePort}`);
    // respond back to the web server with "Server is alive"
    res.send(`Server is live ${nodeServerUrl}:${nodePort}`);
});

app.ws("/test-socket", (ws, req) => {
    console.log("Websocket connection established.");
    ws.on("message", (msg) => {
        console.log("Received message:", msg);
        ws.send(msg);
    });
});

/**
 * Endpoints for the AI Integration Patterns
 * - Webhook endpoint
 * - Text WebSocket connection
 */

// Webhook endpoint
app.post('/webhook', (req, res) => {
    console.log('Received webhook:', req.body);
    res.sendStatus(200);
});

// Transcription Webhook endpoint with various message types
app.post('/transcription', (req, res) => {
    // Log out the application/x-www-form-urlencoded body
    // console.log('Received transcription:', req.body);

    const { TranscriptionEvent, TranscriptionSid, TranscriptionData, Track, TranscriptionErrorCode } = req.body;

    // Switch based on the extracted TranscriptionEvent from the body
    switch (TranscriptionEvent) {
        case 'transcription-started':
            console.log('## Transcription started');
            break
        case 'transcription-content':
            console.log(' ## Transcription content');
            console.log('Transcription: ', TranscriptionData);
            console.log('Transcription track: ', Track);
            break;
        case 'transcription-stopped':
            console.log('## Transcription stopped');
            console.log('Transcription: ', TranscriptionSid);
            break;
        case 'transcription-error':
            console.log('## Transcription error');
            console.log(`Transcription: ${TranscriptionSid} with error: ${TranscriptionErrorCode}`);
            break;
        default:
            console.log('## Unknown transcription event');
    }
    res.sendStatus(200);
});

// Conversation Relay (Text WebSocket) connection
app.ws('/conversation-relay', (ws, req) => {
    console.log('Conversation Relay (Text WebSocket) client connected');
    // Initialise the GptService
    const gptService = new GptService();
    // const aiAssistantService = new AIAssistantService();
    console.log('GptService initialised, back in server.js');

    /**
     * Handle incoming messages on the WebSocket connection.
     * 
     * There are multiple types of messages that can be received from Twilio Conversation Relay:
     * - Prompt (Utterance) message: "prompt"
     * - Interrupt message: "interrupt"
     * - DTMF digits: "dtmf"
     * - Setup message: "setup"
     * 
     */
    ws.on('message', async (data) => {
        try {
            const message = JSON.parse(data);
            // console.log(`[Conversation Relay] Message received: ${JSON.stringify(message)}`);

            switch (message.type) {
                case 'prompt':

                    // OpenAI Model
                    console.info(`[Conversation Relay] >>>>>>: ${message.voicePrompt}`);
                    const response = await gptService.generateResponse(message.voicePrompt);
                    console.info(`[Conversation Relay] <<<<<<: ${response}`);

                    // Twilio AI Assistant Model
                    // console.info(`[Conversation Relay] >>>>>>: ${message.voicePrompt}`);
                    // const response = await aiAssistantService.generateResponse(message.voicePrompt);
                    // console.info(`[Conversation Relay] <<<<<<: ${response}`);

                    // Send the response back to the WebSocket client
                    ws.send(JSON.stringify({
                        type: 'text',
                        token: response,
                        last: false
                    }));
                    break;
                case 'interrupt':
                    // Handle interrupt message
                    console.info(`[Conversation Relay] Interrupt ...... : ${JSON.stringify(message, null, 4)}`);
                    break;
                case 'dtmf':
                    // Handle DTMF digits. We are just logging them out for now.
                    console.debug(`[Conversation Relay] DTMF: ${message.digits.digit}`);
                    break;
                case 'setup':
                    // Handle setup message. Just logging sessionId out for now.
                    console.debug(`[Conversation Relay] Setup message received: ${message.sessionId}`);
                    break;
                default:
                    console.log(`[Conversation Relay] Unknown message type: ${message.type}`);
            };
        } catch (error) {
            console.error('Error in Conversation Relay message handling:', error);
        }
    });

    ws.on('close', () => {
        console.log('[Conversation Relay] client disconnected');
    });
});

// Audio WebSocket connection
app.ws('/websocket-audio', (ws, req) => {
    console.log('Audio WebSocket client connected');

    ws.on('message', (message) => {
        console.log('Received audio message:', message);
        // Handle the audio message as needed
    });

    ws.on('close', () => {
        console.log('Audio WebSocket client disconnected');
    });
});

function startServer(nodePort) {
    server.listen(nodePort, () => {
        console.log(`Server running on port ${nodePort}`);
        console.log(`Webhook URL: http://${nodeServerUrl}:${nodePort}/webhook`);
        console.log(`Transcription Webhook URL: http://${nodeServerUrl}:${nodePort}/transcription`);
        console.log(`Conversation Relay WebSocket URL: ws://${nodeServerUrl}:${nodePort}/conversation-relay`);
        console.log(`Audio WebSocket URL: ws://${nodeServerUrl}:${nodePort}/websocket-audio`);
    }).on('error', (error) => {
        if (error.code === 'EADDRINUSE') {
            console.log(`Port ${nodePort} is busy, trying the next one...`);
            startServer(nodePort + 1);
        } else {
            console.error('Error starting server:', error);
        }
    });
}

startServer(nodePort);

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});