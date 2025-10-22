const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(bodyParser.json());

app.post('/webhook', async (req, res) => {
  const intent = req.body.queryResult.intent.displayName;
  const parameters = req.body.queryResult.parameters;

  // Extract parameters from Dialogflow
  const location = parameters['geo-city'];
  const activity = parameters['activity'];
  const needForTutor = parameters['needTutor'] || "unspecified";
  const timestamp = new Date().toISOString();
  const uuid = uuidv4();

  if (intent === 'view') {
    try {
      // Log booking to spreadsheet via SheetDB
      await axios.post('https://sheetdb.io/api/v1/y5jawzr5mj38r', {
        data: {
          Location: location,
          Activity: activity,
          UUID: uuid,
          "Need for tutor": needForTutor,
          Timestamp: timestamp
        }
      });

      // Respond with Slack card
      const slackCard = {
        fulfillmentMessages: [
          {
            platform: "SLACK",
            payload: {
              blocks: [
                {
                  type: "section",
                  text: {
                    type: "mrkdwn",
                    text: `*Your ${activity} booking is confirmed!*`
                  }
                },
                {
                  type: "actions",
                  elements: [
                    {
                      type: "button",
                      text: {
                        type: "plain_text",
                        text: "View Booking"
                      },
                      value: "view_booking"
                    },
                    {
                      type: "button",
                      text: {
                        type: "plain_text",
                        text: "Cancel Booking"
                      },
                      value: "cancel_booking"
                    }
                  ]
                },
                {
                  type: "context",
                  elements: [
                    {
                      type: "mrkdwn",
                      text: `Booking ID: \`${uuid}\``
                    }
                  ]
                }
              ]
            }
          }
        ]
      };

      return res.json(slackCard);
    } catch (error) {
      console.error("Error logging to spreadsheet:", error.message);
      return res.json({ fulfillmentText: "Booking confirmed, but we couldn’t log it to the spreadsheet." });
    }
  }

  res.json({ fulfillmentText: "Intent not handled by webhook." });
});

app.listen(3000, () => console.log('Webhook server running on port 3000'));
