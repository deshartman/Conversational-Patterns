exports.handler = async function (context, event, callback) {

  console.log("Event object:", JSON.stringify(event));
  const client = context.getTwilioClient();

  try {
    // send an SMS using the Twilio client
    const message = await client.messages.create({
      to: event.From,
      from: context.MY_PHONE_NUMBER,
      body: event.message
    });
    return callback(null, `Message: ${event.message} sent to ${event.From}`);
  } catch (error) {
    return callback(`Error with send-sms: ${error}`);
  }
}