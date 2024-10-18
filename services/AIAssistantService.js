/**
 * This is using the Twilio AI Assistant to generate responses to prompts. Grab your AI Assistant SID from the Twilio Console and set it in your .env file, along with your Account SID and Auth token.
 */
require('dotenv').config();

class AIAssistantService {
    constructor(promptContext, toolManifest) {
        this.promptContext = promptContext;
        this.toolManifest = toolManifest;
    }

    async generateResponse(prompt) {
        let responseContent;
        try {
            const response = await fetch(`https://assistants.twilio.com/v1/Assistants/${process.env.AI_ASSISTANT_SID}/Messages`, {
                method: 'POST',
                body: JSON.stringify({
                    identity: 'email:demo@example.com',
                    session_id: 'mysession',
                    body: prompt,
                    context: this.promptContext,
                    tools: this.toolManifest
                }),
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Basic ${Buffer.from(`${process.env.ACCOUNT_SID}:${process.env.AUTH_TOKEN}`).toString('base64')}`,
                }
            });
            const data = await response.json();
            console.log('[AIAssistantService] Generated response:', data);
            // Remove special characters from the response
            responseContent = data.body.replace(/[\n+]/g, '')

            return responseContent;
        } catch (error) {
            console.error('Error in AIAssistantService:', error);
            throw error;
        }
    }
}

module.exports = { AIAssistantService };
