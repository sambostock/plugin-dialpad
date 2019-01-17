exports.handler = async function(context, event, callback) {
  const client = context.getTwilioClient();
  const taskSid = event.FriendlyName;

  let attributes = {};

  if (event.StatusCallbackEvent === 'participant-join') {
    console.log(`callSid ${event.CallSid} joined, task is ${taskSid}, conference is ${event.ConferenceSid}`);

    try {
      const call = await client.calls(event.CallSid).fetch()

      if (call.to.includes('client')) {
        console.log(`agent ${call.to} joined the conference`);

        const task = await fetchTask(client, context, taskSid);

        attributes = {...JSON.parse(task.attributes)
        }

        attributes.conference = {
          sid: event.ConferenceSid,
          participants: {
            worker: event.CallSid
          }
        };

        console.log(attributes);

        const [to, from] = [attributes.to, attributes.from];

        console.log(`initiate outbound call to: ${attributes.to}`);
        console.log(to);
        console.log(from);

        if (to.length == 10) {
            to = `1${to}`;
        }

        const participant = await addParticipantToConference(client, context, event.ConferenceSid, to, from);

        console.log(`call triggered, callSid ${participant.callSid}`);

        attributes.conference.participants.customer = participant.callSid;

        await updateTaskAttributes(client, context, taskSid, attributes);

        console.log(`updated task ${taskSid} with new attributes: ${JSON.stringify(attributes)}`);

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
