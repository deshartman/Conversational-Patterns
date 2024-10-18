/**
 * This function is used to connect the Twilio voice stream to the voice websocket on the Node server.
 * 
*/
exports.handler = function (context, event, callback) {
  const restClient = context.getTwilioClient();
  const voiceResponse = new Twilio.twiml.VoiceResponse();

  let domain = context.DOMAIN_NAME;
  // If the context.DOMAIN_NAME contains localhost or 127.0.0.1, use the NGROK_DOMAIN_URI, else use the DOMAIN_NAME
  if (context.DOMAIN_NAME.includes('localhost') || context.DOMAIN_NAME.includes('127.0.0.1')) {
    domain = context.NGOK_DOMAIN_URI;
  }

  console.info(`Domain: ${domain}`);
  // console.log(`Incoming Stream >> `, event);

  // Connect the Twilio voice stream to the voice websocket
  try {
    voiceResponse.say("O.K. you can start talking!");
    const connect = voiceResponse.connect();
    connect.stream({
      // url: `wss://${domain}/server-connect-stream`,
      url: `wss://${domain}/connect-stream`,
    });
    return callback(null, voiceResponse);
    // return callback(null, "Hello");

  } catch (error) {
    console.error("Error connecting to Retell", error);
    voiceResponse.say("An application exception occurred.");
    return callback(null, voiceResponse);
  }
};
