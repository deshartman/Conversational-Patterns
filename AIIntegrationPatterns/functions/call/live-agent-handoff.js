
exports.handler = function (context, event, callback) {
  const voiceResponse = new Twilio.twiml.VoiceResponse();

  console.log('Transfer to Agent. Got the callSid:', event.CallSid);

  let domain = context.DOMAIN_NAME;
  // If the context.DOMAIN_NAME contains localhost or 127.0.0.1, use the NGROK_DOMAIN_URI, else use the DOMAIN_NAME
  if (context.DOMAIN_NAME.includes('localhost') || context.DOMAIN_NAME.includes('127.0.0.1')) {
    domain = context.NGOK_DOMAIN_URI;
  }

  try {
    // console.info(`Conversation Relay called and twilioResponse: ${JSON.stringify(voiceResponse, null, 4)}`);

    voiceResponse.say('Connecting you to the next available agent.');

    // connect the call to a Studio flow that will handle the call
    // client.studio.v2.flows(context.WORKFLOW_SID)
    //   .executions
    //   .create({ to: '+1234567890', from: '+0987654321' })
    //   .then(execution => console.log(execution.sid))
    //   .done();



    return callback(null, voiceResponse);
  } catch (error) {
    console.error(error);
    return callback(`Conversation Relay error: ${error}`);
  }
};
