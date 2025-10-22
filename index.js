const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(bodyParser.json());

app.post('/webhook', async (req, res) => {
  const intent = req.body.queryResult.intent.displayName;
  const parameters = req.body.queryResult.parameters;
  const user = req.body.originalDetectIntentRequest?.payload?.data?.user?.name || "Unknown";
  const timestamp = new Date().toISOString();
  const location = parameters['geo-city'] || "Indore";
  const uuid = uuidv4();

  if (intent === 'View Booking') {
    try {
      await axios.post('https://sheetdb.io/api/v1/y5jawzr5mj38r', {
        data: {
          user,
          intent,
          timestamp,
          location,
          uuid
        }
      });

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
                    text: "*Your badminton booking is confirmed!*"
                  },
                  accessory: {
                    type: "button",
                    text: {
                      type: "plain_text",
                      text: "View Booking"
                    },
                    value: "view badminton"
                  }
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
      return res.json({ fulfillmentText: "Booking confirmed, but we couldn’t log it to the spreadsheet." });
    }
  }

  res.json({ fulfillmentText: "Intent not handled by webhook." });
});

app.listen(3000, () => console.log('Webhook server running on port 3000'));
