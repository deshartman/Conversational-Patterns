exports.handler = async function (context, event, callback) {

  const twilioClient = context.getTwilioClient();

  console.log("Event object:", event);

  try {
    console.log(`[VerifySend] Sending verification code to: ${event.phone}`);
    // Generate code for the calling number (event.From)
    let code = "123456" // Temp hack

    // Send the code using the send-sms function

    console.log(`[VerifySend] Sending code: ${code} to: ${event.phone} from: ${context.SMS_FROM_NUMBER}`);

    await twilioClient.messages.create({
      to: event.phone,
      from: context.SMS_FROM_NUMBER,
      body: `Your verification code is: ${code}`
    });

    console.log(`[VerifySend] Verification code sent successfully`);

    return callback(null, code);
  } catch (error) {
    return callback(`Error with call-out: ${error}`);
  }
}