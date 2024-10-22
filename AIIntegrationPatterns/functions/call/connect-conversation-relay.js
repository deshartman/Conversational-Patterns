
exports.handler = function (context, event, callback) {
  const restClient = context.getTwilioClient();
  // ConversationRelay helper library is not available yet, so manually using TwiML
  // const voiceResponse = new Twilio.twiml.VoiceResponse();
  const twilioResponse = new Twilio.Response();

  let domain = context.DOMAIN_NAME;
  // If the context.DOMAIN_NAME contains localhost or 127.0.0.1, use the NGROK_DOMAIN_URI, else use the DOMAIN_NAME
  if (context.DOMAIN_NAME.includes('localhost') || context.DOMAIN_NAME.includes('127.0.0.1')) {
    domain = context.NGOK_DOMAIN_URI;
  }

  console.info(`domain: ${domain}`);

  try {
    twilioResponse
      // Set the Content-Type Header
      .appendHeader('Content-Type', 'application/xml')
      // Set the body of the response to the desired TwiML string
      .setBody(`
    <Response>
      <Connect>
        <Voxray url="wss://${domain}/conversation-relay" voice="en-AU-Standard-A" dtmfDetection="true" interruptByDtmf="true" />
      </Connect>
      <Record />
    </Response>`);

    console.info(`Conversation Relay called and twilioResponse: ${JSON.stringify(twilioResponse, null, 4)}`);

    return callback(null, twilioResponse);
  } catch (error) {
    console.error(error);
    return callback(`Conversation Relay error: ${error}`);
  }
};
