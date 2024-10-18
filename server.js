console.log('Starting server...');

const express = require('express');
const http = require('http');
const ExpressWs = require("express-ws");
const dotenv = require('dotenv');
const { GptService } = require('./services/GptService');
const { GptRealtimeService } = require('./services/GptRealtimeService');
const { AIAssistantService } = require('./services/AIAssistantService');
const WebSocket = require('ws');

console.log('Loading environment variables...');
dotenv.config();

const app = express();
const server = http.createServer(app);
const expressWs = ExpressWs(app, server);

const nodePort = process.env.NODE_PORT || 3000;
const nodeServerUrl = process.env.NODE_SERVER_URL || 'localhost';
const functionsURL = process.env.TWILIO_FUNCTIONS_URL;

app.use(express.json());
// Parse URL-encoded bodies
app.use(express.urlencoded({ extended: true }));

// Function to fetch context and manifest
async function fetchContextAndManifest() {
    try {
        // console.log(`[Server] Fetching context and manifest from ${functionsURL}`);
        const context = await fetch(`${functionsURL}/context.md`);
        const promptContext = await context.text();
        // console.log(`[Server] Context: ${promptContext}`);

        const manifest = await fetch(`${functionsURL}/toolManifest.json`);
        const toolManifest = await manifest.json(); // Parse JSON response
        // console.log(`[Server] Manifest: ${JSON.stringify(toolManifest)}`);

        return { promptContext, toolManifest };
    } catch (error) {
        console.error('Error fetching context or manifest:', error);
        throw error;
    }
}

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
app.ws('/conversation-relay', async (ws, req) => {
    console.log('Conversation Relay (Text WebSocket) client connected');

    // Fetch the configuration
    let promptContext, toolManifest;
    try {
        ({ promptContext, toolManifest } = await fetchContextAndManifest());
    } catch (error) {
        console.error('Error fetching context or manifest:', error);
        ws.close();
        return;
    }

    // Initialise the GptService with the fetched context and manifest
    const gptService = new GptService(promptContext, toolManifest);
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
                    /**
                     * Handle setup message. Just logging sessionId out for now.
                     * This is the object received from Twilio:
                     * {
                            "type": "setup",
                            "sessionId": "VXxxxx",
                            "callSid": "CAxxxx",
                            "parentCallSid": "",
                            "from": "+614nnnn",
                            "to": "+612nnnn",
                            "forwardedFrom": "+612nnnnn",
                            "callerName": "",
                            "direction": "inbound",
                            "callType": "PSTN",
                            "callStatus": "RINGING",
                            "accountSid": "ACxxxxxx",
                            "applicationSid": null
                        }
                     */
                    // 
                    // console.debug(`[Conversation Relay] Setup message received: ${JSON.stringify(message, null, 4)}`);
                    // Log out the to and from phone numbers
                    console.log(`[Conversation Relay] Call from: ${message.from} to: ${message.to}`);
                    // extract the "from" value and pass it to gptService
                    gptService.setPhoneNumbers(message.to, message.from);
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

// Audio Stream Connection
/**
 * Twilio establishes a WebSocket connection to your server when a Stream is started.
 * 
 * Twilio then sends the following "message" types to your WebSocket server during a Stream:
 * - Connected
 * - Start
 * - Media
 * - DTMF
 * - Stop
 * - Mark ( bidirectional Streams only)
 * 
 */
app.ws('/connect-stream', async (ws, req) => {
    console.log('Connect Stream (Audio WebSocket) client connected');

    // Fetch the configuration
    let promptContext, toolManifest;
    try {
        ({ promptContext, toolManifest } = await fetchContextAndManifest());
    } catch (error) {
        console.error('Error fetching context or manifest:', error);
        ws.close();
        return;
    }

    // Initialise the GptRealtimeService with the fetched context and manifest
    const gptRealtimeService = new GptRealtimeService(promptContext, toolManifest);
    console.log('GptRealtimeService initialised in server.js under connect-stream');

    // Wait for GptRealtimeService to be ready
    gptRealtimeService.once('ready', () => {
        console.log('GptRealtimeService is ready');
    });

    ws.on('open', () => {
        console.log('WebSocket connection to connect-stream opened');
    });

    /**
     * Twilio then sends the following "message" types to your WebSocket server during a Stream:
     * - Connected
     * - Start
     * - Media
     * - DTMF
     * - Stop
     * - Mark ( bidirectional Streams only)*/

    ws.on('message', async (data) => {
        // console.log('WebSocket message to connect-stream');
        try {
            const message = JSON.parse(data);
            // console.log(`Received event: ${message.event}`);

            switch (message.event) {
                case 'connected':
                    console.log('Stream connected:', message);
                    break;
                case 'start':
                    gptRealtimeService.streamSid = message.start.streamSid;
                    console.log('Incoming stream has started', gptRealtimeService.streamSid);
                    break;
                case 'media':
                    // console.log('Received media:');
                    // Send media to OpenAI Realtime API
                    await gptRealtimeService.sendMedia(message.media.payload);
                    break;
                case 'dtmf':
                    console.log('Received DTMF:', message.dtmf);
                    // Handle DTMF digits
                    break;
                case 'stop':
                    console.log('Stream stopped:', message);
                    break;
                case 'mark':
                    console.log('Received mark:', message.mark);
                    // Handle mark event
                    break;
                default:
                    console.log(`Unknown message type: ${message.event}`);
            }
        } catch (error) {
            console.error('Error processing connect-stream message:', error, 'Raw message:', data);
        }
    });

    ws.on('close', () => {
        console.log('WebSocket connection to connect-stream closed');
        gptRealtimeService.close();
        console.log('Client disconnected.');
    });

    ws.on('error', (error) => {
        console.error('WebSocket to connect-stream error:', error);
    });

    // gptRealtimeService Services //

    // Handle the media event from OpenAI real-time API
    gptRealtimeService.on('media', (audioDelta) => {
        // console.log('Sending audio to Twilio:', audioDelta);
        ws.send(JSON.stringify(audioDelta));
    });

    // Handle WebSocket close and errors
    gptRealtimeService.on('close', () => {
        console.log('Disconnected from the OpenAI Realtime API');
        ws.close();
    });

    gptRealtimeService.on('error', (error) => {
        console.error('Error in the OpenAI WebSocket:', error);
        ws.close();
    });
});

// Generic Audio WebSocket connection
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
        console.log(`Conversation Relay WebSocket URL: ws://${nodeServerUrl}:${nodePort}/connect-stream`);
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
