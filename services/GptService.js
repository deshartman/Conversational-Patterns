const OpenAI = require('openai');
const EventEmitter = require('events');
require('dotenv').config();

// Import the Prompt Context you need to use
const promptContexts = require('../prompts/promptContexts');
const promptContext = process.env.PROMPT_CONTEXT;

class GptService extends EventEmitter {
    constructor() {
        super();
        /**
         * Initialise the OpenAI API with the API key. Note this is implicit with the nodejs library. If you want to explicitly set the API key, 
         * you can do so by passing it as an object to the OpenAI constructor.
         * 
         * ```javascript
         *      const openai = new OpenAI({
         *          apiKey: process.env.OPENAI_API_KEY
         *      });
         * ```
         */
        this.openai = new OpenAI();
        // Initialise the OpenAI messages array with the system prompt context
        this.messages = [
            { role: "system", content: promptContexts[promptContext] },
        ];
        this.model = process.env.OPENAI_MODEL;
    }

    async generateResponse(prompt) {
        // Add the prompt as role user to the existing this.messages array
        this.messages.push({ role: 'user', content: prompt });

        // Call the OpenAI API to generate a response
        try {
            const response = await this.openai.chat.completions.create({
                model: this.model,
                messages: this.messages,
                stream: false,
            });

            const responseContent = response.choices[0].message.content;
            const responseRole = response.choices[0].message.role;

            // Add the response tto the this.messages array
            this.messages.push({ role: responseRole, content: responseContent });

            // console.log('[GptService] Generated response:', responseMessage);
            return responseContent;

        } catch (error) {
            console.error('Error in GTPService:', error);
            throw error;
        }
    }
}

module.exports = { GptService };