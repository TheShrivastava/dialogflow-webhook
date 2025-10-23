const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(bodyParser.json());

const SHEETDB_API = 'https://sheetdb.io/api/v1/y5jawzr5mj38r';
const SPREADSHEET_URL = 'https://docs.google.com/spreadsheets/d/1eU7cn3XBsoTFrMgYKhMOJC-YMqx_usqh1KAYyk4UL30/edit?pli=1&gid=0';
const TICK_IMAGE_URL = 'https://www.clipartkey.com/mpngs/m/230-2305459_green-ticks-png-image-check-mark-transparent-gif.png';

app.post('/webhook', async (req, res) => {
  const intent = req.body.queryResult.intent.displayName;
  const parameters = req.body.queryResult.parameters;
  const timestamp = new Date().toISOString();

  const normalizedIntent = intent.toLowerCase().replace(/[\s.]+/g, '_');

  console.log("Intent:", intent);
  console.log("Normalized Intent:", normalizedIntent);
  console.log("Parameters:", parameters);

  const rawEntity =
    parameters.sport_swimming ||
    parameters.sport_chess ||
    parameters.sport_badminton ||
    parameters.acad_history ||
    parameters.acad_maths ||
    parameters.acad_sci ||
    parameters.art_drawing ||
    parameters.art_painting ||
    parameters.art_sculpting;

  const activity = rawEntity || "unspecified";
  const location = parameters['geo-city'] || "unspecified";
  const needForTutor = parameters['tutor'] ? "Yes" : "No";
  const uuid = uuidv4();

  if (normalizedIntent.startsWith('book_')) {
    try {
      await axios.post(SHEETDB_API, {
        data: {
          Location: location,
          Activity: activity,
          UUID: uuid,
          "Need for tutor": needForTutor,
          Timestamp: timestamp
        }
      });

      return res.json({
        fulfillmentMessages: [
          {
            platform: "SLACK",
            payload: {
              blocks: [
                {
                  type: "image",
                  image_url: TICK_IMAGE_URL,
                  alt_text: "Booking confirmed"
                },
                {
                  type: "section",
                  text: {
                    type: "mrkdwn",
                    text: `✅ *Your ${activity} booking is confirmed!*\nLocation: *${location}*\nTutor required: *${needForTutor}*`
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
          },
          {
            platform: "DIALOGFLOW_MESSENGER",
            payload: {
              richContent: [
                [
                  {
                    type: "image",
                    rawUrl: TICK_IMAGE_URL,
                    accessibilityText: "Booking confirmed"
                  },
                  {
                    type: "description",
                    title: `✅ Booking Confirmed: ${activity}`,
                    text: [
                      `Location: ${location}`,
                      `Tutor required: ${needForTutor}`,
                      `Booking ID: ${uuid}`
                    ]
                  },
                  {
                    type: "button",
                    icon: { type: "launch" },
                    text: "View Booking",
                    link: SPREADSHEET_URL
                  },
                  {
                    type: "button",
                    text: "Cancel Booking",
                    event: {
                      name: "cancel_booking",
                      parameters: { uuid: uuid }
                    }
                  }
                ]
              ]
            }
          },
          {
            text: {
              text: ["✅ Your booking is confirmed."]
            }
          }
        ],
        outputContexts: []
      });
    } catch (error) {
      console.error("Error logging to spreadsheet:", error.message);
      return res.json({
        fulfillmentText: "Booking confirmed, but we couldn’t log it to the spreadsheet."
      });
    }
  }

  return res.json({ fulfillmentText: "Intent not handled by webhook." });
});

app.listen(3000, () => console.log('Webhook server running on port 3000'));
