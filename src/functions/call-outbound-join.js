exports.handler = async function(context, event, callback) {
  const client = context.getTwilioClient();
  const taskSid = event.FriendlyName;

  if (event.StatusCallbackEvent === 'participant-join') {
    console.log(`callSid ${event.CallSid} joined, task is ${taskSid}, conference is ${event.ConferenceSid}`);

    try {
      const call = await client.calls(event.CallSid).fetch()

      if (call.to.includes('client')) {
        await initiateOutboundCall(client, context, event, taskSid, call);
      } else {
        console.log('the customer joined, nothing to do here');
      }

      console.log('all tasks done');
      callback();

    } catch(error) {
      console.log('an error occurred', error);
      callback(error);
    }

  } else {
    callback();
  }
};

async function initiateOutboundCall(client, context, event, taskSid, call) {
  console.log(`agent ${call.to} joined the conference`);

  const task = await fetchTask(client, context, taskSid);
  const attributes = JSON.parse(task.attributes)

  attributes.conference = {
    sid: event.ConferenceSid,
    participants: {
      worker: event.CallSid
    }
  };

  console.log(attributes);
  console.log(`initiate outbound call to: ${attributes.to}`);
  console.log(attributes.to);
  console.log(attributes.from);

  const normalizedTo = normalizePhoneNumber(attributes.to);
  const participant = await addParticipantToConference(client, context, event.ConferenceSid, normalizedTo, attributes.from);

  console.log(`call triggered, callSid ${participant.callSid}`);
  attributes.conference.participants.customer = participant.callSid;

  await updateTaskAttributes(client, context, taskSid, attributes);
  console.log(`updated task ${taskSid} with new attributes: ${JSON.stringify(attributes)}`);
}

function fetchTask(client, context, taskSid) {
  return client.taskrouter.workspaces(context.TWILIO_WORKSPACE_SID)
    .tasks(taskSid)
    .fetch();
};

function updateTaskAttributes(client, context, taskSid, attributes) {
  return client.taskrouter.workspaces(context.TWILIO_WORKSPACE_SID)
    .tasks(taskSid)
    .update({
      attributes: JSON.stringify(attributes)
    });
};

function addParticipantToConference (client, context, conferenceSid, to, from) {
  return client
    .conferences(conferenceSid)
    .participants.create({
      to,
      from,
      earlyMedia: true,
      endConferenceOnExit: true
    });
};

function normalizePhoneNumber(phoneNumber) {
  if (phoneNumber.length == 10) {
    return `1${phoneNumber}`;
  }

  return phoneNumber;
}
