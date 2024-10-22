const OpenAI = require('openai');
const EventEmitter = require('events');
require('dotenv').config();

const functionsURL = process.env.TWILIO_FUNCTIONS_URL;

class GptService extends EventEmitter {
    constructor(promptContext, toolManifest) {
        super();
        this.openai = new OpenAI(); // Implicitly uses process.env.OPENAI_API_KEY
        this.model = process.env.OPENAI_MODEL;
        this.messages = [
            { role: "system", content: promptContext },
        ];
        // Ensure toolManifest is in the correct format
        this.toolManifest = toolManifest.tools || [];
        this.phoneNumber = null;
    }

    // Helper function to set the calling phone number
    setPhoneNumbers(to, from) {
        this.twilioNumber = to;
        this.customerNumber = from;

        // Update this.messages with the phone "to" and the "from" numbers
        console.log(`[GptService] The "to" number is ${this.twilioNumber} and the "from" number is ${this.customerNumber}`);
        this.messages.push({ role: 'system', content: `The customer phone number or "from" number is ${this.customerNumber}, which you should use throughout as the reference when calling tools and the number to send SMSs from is: ${this.twilioNumber}` });
        // TODO: Complete this.
    }

    async generateResponse(prompt) {
        // Add the prompt as role user to the existing this.messages array
        this.messages.push({ role: 'user', content: prompt });

        // Call the OpenAI API to generate a response
        try {
            const response = await this.openai.chat.completions.create({
                model: this.model,
                tools: this.toolManifest,
                messages: this.messages,
                stream: false,
            });

            // Get the content or toolCalls array from the response
            const assistantMessage = response.choices[0]?.message;
            const toolCalls = assistantMessage?.tool_calls;

            // Add the assistant's message to this.messages
            this.messages.push(assistantMessage);

            // The response will be the use of a Tool or just a Response. If the toolCalls array is empty, then it is just a response
            if (toolCalls && toolCalls.length > 0) { // If the toolCalls array is not empty, then it is a Tool

                // The toolCalls array will contain the tool name and the response content
                for (const toolCall of toolCalls) {
                    console.log(`[GptService] Tool call: ${toolCall.function.name} with arguments: ${toolCall.function.arguments}`);

                    // Make the fetch request to the Twilio Functions URL with the tool name as the path and the tool arguments as the body
                    const functionResponse = await fetch(`${functionsURL}/tools/${toolCall.function.name}`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: toolCall.function.arguments,
                    });

                    // Log the content type of the response
                    console.log(`[GptService] Response content type: ${functionResponse.headers.get("content-type")}`);

                    // Now take the result and pass it back to the LLM as a tool response
                    const toolResult = await functionResponse.json();

                    // console.log(`[GptService] Tool response: ${toolCall.response}`);
                    // Add the tool call to the this.messages array
                    this.messages.push({
                        role: "tool",
                        content: JSON.stringify(toolResult),
                        tool_call_id: toolCall.id,
                    });
                }

                // After processing all tool calls, we need to get the final response from the model
                const finalResponse = await this.openai.chat.completions.create({
                    model: this.model,
                    messages: this.messages,
                    stream: false,
                });

                const responseContent = finalResponse.choices[0]?.message?.content || "";
                this.messages.push({ role: 'assistant', content: responseContent });
                return responseContent;

            } else {
                // If the toolCalls array is empty, then it is just a response
                const responseContent = assistantMessage?.content || "";

                // console.log(`[GptService] Response: ${responseContent}`);
                // Get the role of the response
                // const responseRole = assistantMessage.role;
                // Add the response to the this.messages array
                this.messages.push({
                    role: "assistant",
                    content: responseContent
                });
                // Remove all special characters from the responseContent
                // const sanitizedResponseContent = responseContent.replace(/[^a-zA-Z ]/g, '') + ".";
                // return sanitizedResponseContent;
                return responseContent

            }

        } catch (error) {
            console.error('Error in GptService:', error);
            throw error;
        }
    };
}

module.exports = { GptService };
