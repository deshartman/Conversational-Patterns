exports.handler = async function (context, event, callback) {
  console.log("Get Customer Event object:", event);

  try {
    // Extract phone-number from the event object
    let caller = event.caller;
    if (!caller) {
      throw new Error('phone-number is missing from the event object');
    }

    console.log(`Get Customer: Phone number provided:`, caller);

    // Fetch customer details based on the provided phone number
    let customerData = { // temp hack
      firstName: "Des",
      lastName: "Hartman",
      phone: caller,
      dob: "10/10/2010",
      account: "A-1234567890",
      other: "Some other detail"
    }

    console.log(`Customer details found and returned: ${JSON.stringify(customerData)}`);
    return callback(null, customerData);
  } catch (error) {
    return callback(`Error with get-customer: ${error}`);
  }
}
