exports.handler = async function (context, event, callback) {
  const restClient = context.getTwilioClient();
  const voiceResponse = new Twilio.twiml.VoiceResponse();

  let domain = context.DOMAIN_NAME;
  // If the context.DOMAIN_NAME contains localhost or 127.0.0.1, use the NGROK_DOMAIN_URI, else use the DOMAIN_NAME
  if (context.DOMAIN_NAME.includes('localhost') || context.DOMAIN_NAME.includes('127.0.0.1')) {
    domain = context.NGOK_DOMAIN_URI;
  }

  console.info(`Domain: ${domain}`);

  try {
    to = `${event.To}@${context.SIP_DOMAIN_URI}`;
    from = event.From;
    console.info(`Call Out: Dialling SIP ${to} with Caller ID ${from}`);

    voiceResponse
      .start()
      .transcription({
        statusCallbackUrl: `https://${domain}/transcription`
      });

    voiceResponse.dial()
      .sip(to);

    return callback(null, voiceResponse);
  } catch (error) {
    console.error(error);
    return callback(`Transcription creation error: ${error}`);
  }
};