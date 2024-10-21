/**
 * 
 * @param {*} context 
 * @param {*} event 
 * @param {*} callback 
 * @returns 
 * 
 * This function redirects the current call connected to the conversation relay endpoint back to the agent, by trnasferring the call back into the Twilio Studio flow
 */
exports.handler = async function (context, event, callback) {
  const voiceResponse = new Twilio.twiml.VoiceResponse();

  try {
    // Transfer the second leg of the call to a Twilio Studio flow
    voiceResponse.enqueue({
      workflowSid: context.WORKFLOW_SID
    });

    return callback(null, voiceResponse);
  } catch (error) {
    console.error(error);
    return callback(`Transfer to Agent error: ${error}`);
  }
}