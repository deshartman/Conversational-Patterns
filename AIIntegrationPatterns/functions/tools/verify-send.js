exports.handler = async function (context, event, callback) {

  console.log("Event object:", JSON.stringify(event));

  try {
    console.log("No verification code included in event object. Generating one now.");
    // Generate code for the calling number (event.From)
    let code = "123456" // Temp hack

    // Send the code using the send-sms function
    const client = context.getTwilioClient();
    const message = await client.messages.create({
      to: event.phone,
      from: context.MY_PHONE_NUMBER,
      body: `Your verification code is: ${code}`
    });
    return callback(null, code);
  } catch (error) {
    return callback(`Error with call-out: ${error}`);
  }
}