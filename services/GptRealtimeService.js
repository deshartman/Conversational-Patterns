const EventEmitter = require('events');
require('dotenv').config();
const OpenAI = require('openai');
const WebSocket = require('ws');


// Import the Prompt Context you need to use
const promptContexts = require('../prompts/promptContexts');
const promptContext = process.env.PROMPT_CONTEXT;
// Constants
const VOICE = 'alloy';

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

class GptRealtimeService extends EventEmitter {
    constructor() {
        super();
        this.streamSid = null;
        this.isReady = false;
        this.connectToOpenAI();
    }

    connectToOpenAI() {
        // Open a web socket to OpenAI Realtime API
        console.log('Connecting to OpenAI Realtime API...');
        try {
            // this.openAiWs = new WebSocket(`wss://${process.env.OPENAI_REALTIME_URL}?model=gpt-4o-realtime-preview-2024-10-01`, {
            this.openAiWs = new WebSocket(`wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01`, {
                headers: {
                    Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
                    "OpenAI-Beta": "realtime=v1"
                }
            });
            console.log('Inside Try - OpenAI Realtime API WebSocket:');

            this.openAiWs.on('open', this.handleOpenAIOpen.bind(this));
            this.openAiWs.on('message', this.handleOpenAIMessage.bind(this));
            this.openAiWs.on('error', this.handleOpenAIError.bind(this));
            this.openAiWs.on('close', this.handleOpenAIClose.bind(this));
        } catch (error) {
            console.error('Error creating OpenAI WebSocket:', error);
            this.emit('error', error);
        }
    }

    handleOpenAIOpen() {
        console.log('Connected to the OpenAI Realtime API');
        setTimeout(this.sendSessionUpdate.bind(this), 250); // Ensure connection stability, send after .25 seconds
    }

    sendSessionUpdate() {
        const sessionUpdate = {
            type: 'session.update',
            session: {
                turn_detection: { type: 'server_vad' },
                input_audio_format: 'g711_ulaw',
                output_audio_format: 'g711_ulaw',
                voice: VOICE,
                instructions: promptContext,
                modalities: ["text", "audio"],
                temperature: 0.8,
            }
        };
        console.log('Sending session update to OpenAI WS');
        this.openAiWs.send(JSON.stringify(sessionUpdate));
    }

    handleOpenAIMessage(data) {
        try {
            const response = JSON.parse(data);
            console.log('Received message from OpenAI:', response.transcript);

            if (LOG_EVENT_TYPES.includes(response.type)) {
                console.log(`Received response type: ${response.type}`);
            }

            if (response.type === 'session.updated') {
                console.log('Session updated successfully');
                this.isReady = true;
                this.emit('ready');
            }

            if (response.type === 'response.audio.delta' && response.delta) {
                console.log('Received audio delta from OpenAI');
                const audioDelta = {
                    event: 'media',
                    streamSid: this.streamSid,
                    media: { payload: Buffer.from(response.delta, 'base64').toString('base64') }
                };
                // Send audio to Twilio via EventEmitter
                this.emit('media', audioDelta);
            }
        } catch (error) {
            console.error('GptRealtimeService: Error processing OpenAI message:', error, 'Raw message:', data);
            this.emit('error', error);
        }
    }

    handleOpenAIError(error) {
        console.error('Error in the OpenAI WebSocket:', error);
        this.emit('error', error);
    }

    handleOpenAIClose() {
        console.log('Disconnected from the OpenAI Realtime API');
        this.isReady = false;
        this.emit('close');
    }

    // Send media received to OpenAI
    async sendMedia(audio) {
        if (!this.isReady) {
            console.warn('GptRealtimeService is not ready. Waiting for ready state...');
            await new Promise(resolve => this.once('ready', resolve));
        }

        try {
            if (this.openAiWs.readyState === WebSocket.OPEN) {
                // console.log('Sending audio to OpenAI:');

                const audioAppend = {
                    type: 'input_audio_buffer.append',
                    audio: audio
                };
                this.openAiWs.send(JSON.stringify(audioAppend));
            } else {
                throw new Error('WebSocket is not open');
            }
        } catch (error) {
            console.error('GptRealtimeService. Error sending audio to OpenAI:', error);
            this.emit('error', error);
        }
    }

    // Close the openAI websocket. First check if it is open before closing.
    close() {
        if (this.openAiWs.readyState === WebSocket.OPEN) {
            console.log('Closing OpenAI Realtime API WebSocket');
            this.openAiWs.close();
        }
    }
}

module.exports = { GptRealtimeService };
