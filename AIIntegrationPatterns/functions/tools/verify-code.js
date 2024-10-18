exports.handler = async function (context, event, callback) {

  console.log("Event object:", JSON.stringify(event));

  try {
    // Check if a verification code has been included. If so, check the code, else generate one
    if (event.code) {
      console.log("Verification code included in event object:", event.code);
      // Add checks for the code here based on the calling number (event.From and the code)
      let result = true; // Temp hack
      return (callback(null, result));
    } else {
      const message = "No verification code included in event object."
      console.log(message);
      return callback(null, message);
    }
  } catch (error) {
    return callback(`Error with call-out: ${error}`);
  }
}