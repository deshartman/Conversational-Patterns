// @ts-nocheck
const express = require('express');
// Make sure to install the express-ws package: npm install express-ws
const expressWs = require('express-ws');
const http = require('http');
const WebSocket = require('ws');
const fs = require('fs');
const dotenv = require('dotenv');

// Load environment variables from .env file
dotenv.config();

// Retrieve the OpenAI API key from environment variables. You must have OpenAI Realtime API access.
const { OPENAI_API_KEY, NODE_PORT } = process.env;

if (!OPENAI_API_KEY) {
    console.error('Missing OpenAI API key. Please set it in the .env file.');
    process.exit(1);
}

// Initialize Express and add WebSocket support
const app = express();
const server = http.createServer(app);
expressWs(app, server);

// Use Express built-in middleware for parsing JSON and URL-encoded data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Constants
const SYSTEM_MESSAGE = 'You are a helpful and bubbly AI assistant who loves to chat about anything the user is interested about and is prepared to offer them facts. You have a penchant for dad jokes, owl jokes, and rickrolling – subtly. Always stay positive, but work in a joke when appropriate.';
const VOICE = 'alloy';
const PORT = NODE_PORT || 5050; // Allow dynamic port assignment

// List of Event Types to log to the console. See OpenAI Realtime API Documentation. (session.updated is handled separately.)
const LOG_EVENT_TYPES = [
    'response.content.done',
    'rate_limits.updated',
    'response.done',
    'input_audio_buffer.committed',
    'input_audio_buffer.speech_stopped',
    'input_audio_buffer.speech_started',
    'session.created'
];

// Root Route
app.get('/', (req, res) => {
    res.json({ message: 'Twilio Media Stream Server is running!' });
});

// Route for Twilio to handle incoming and outgoing calls
app.all('/connect-stream', (req, res) => {
    console.log('Incoming call header stream:', `${req.headers.host}/media-stream`);
    const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
                          <Response>
                              <Say>O.K. This is the local server, you can start talking!</Say>
                              <Connect>
                                  <Stream url="wss://${req.headers.host}/media-stream" />
                              </Connect>
                          </Response>`;

    res.type('text/xml').send(twimlResponse);
});

// WebSocket route handler
app.ws('/media-stream', (ws, req) => {
    console.log('Client connected to media-stream');

    const openAiWs = new WebSocket('wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01', {
        headers: {
            Authorization: `Bearer ${OPENAI_API_KEY}`,
            "OpenAI-Beta": "realtime=v1"
        }
    });

    let streamSid = null;

    const sendSessionUpdate = () => {
        const sessionUpdate = {
            type: 'session.update',
            session: {
                turn_detection: { type: 'server_vad' },
                input_audio_format: 'g711_ulaw',
                output_audio_format: 'g711_ulaw',
                voice: VOICE,
                instructions: SYSTEM_MESSAGE,
                modalities: ["text", "audio"],
                temperature: 0.8,
            }
        };

        console.log('Sending session update:');
        openAiWs.send(JSON.stringify(sessionUpdate));
    };

    // Open event for OpenAI WebSocket
    openAiWs.on('open', () => {
        console.log('Connected to the OpenAI Realtime API');
        setTimeout(sendSessionUpdate, 250); // Ensure connection stability, send after .25 seconds
    });

    // Listen for messages from the OpenAI WebSocket (and send to Twilio if necessary)
    openAiWs.on('message', (data) => {
        try {
            const response = JSON.parse(data);

            if (LOG_EVENT_TYPES.includes(response.type)) {
                console.log(`Received event: ${response.type}`);
            }

            if (response.type === 'session.updated') {
                console.log('Session updated successfully:');
            }

            if (response.type === 'response.audio.delta' && response.delta) {
                const audioDelta = {
                    event: 'media',
                    streamSid: streamSid,
                    media: { payload: Buffer.from(response.delta, 'base64').toString('base64') }
                };
                ws.send(JSON.stringify(audioDelta));
            }
        } catch (error) {
            console.error('Error processing OpenAI message:', error, 'Raw message:', data);
        }
    });

    // Handle incoming messages from Twilio
    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data);

            switch (message.event) {
                case 'media':
                    if (openAiWs.readyState === WebSocket.OPEN) {
                        const audioAppend = {
                            type: 'input_audio_buffer.append',
                            audio: message.media.payload
                        };

                        openAiWs.send(JSON.stringify(audioAppend));
                    }
                    break;
                case 'start':
                    streamSid = message.start.streamSid;
                    console.log('Incoming stream has started', streamSid);
                    break;
                default:
                    console.log('Received non-media event:', message.event);
                    break;
            }
        } catch (error) {
            console.error('Error parsing message:', error, 'Message:', data);
        }
    });

    // Handle connection close
    ws.on('close', () => {
        if (openAiWs.readyState === WebSocket.OPEN) openAiWs.close();
        console.log('Client disconnected.');
    });

    // Handle WebSocket close and errors
    openAiWs.on('close', () => {
        console.log('Disconnected from the OpenAI Realtime API');
    });

    openAiWs.on('error', (error) => {
        console.error('Error in the OpenAI WebSocket:', error);
    });
});

server.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
});