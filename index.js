const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(bodyParser.json());

// 🔍 Map Dialogflow entity values to activity types
const entityMap = {
  acad_history: "history",
  acad_maths: "maths",
  acad_sci: "science",
  art_drawing: "drawing",
  art_painting: "painting",
  art_sculpting: "sculpting",
  sport_badminton: "badminton",
  sport_chess: "chess",
  sport_swimming: "swimming"
};

// ✅ Your actual SheetDB and spreadsheet URLs
const SHEETDB_API = 'https://sheetdb.io/api/v1/y5jawzr5mj38r';
const SPREADSHEET_URL = 'https://docs.google.com/spreadsheets/d/1eU7cn3XBsoTFrMgYKhMOJC-YMqx_usqh1KAYyk4UL30/edit?pli=1&gid=0';
const TICK_IMAGE_URL = 'https://www.clipartkey.com/mpngs/m/230-2305459_green-ticks-png-image-check-mark-transparent-gif.png';

app.post('/webhook', async (req, res) => {
  const intent = req.body.queryResult.intent.displayName;
  const parameters = req.body.queryResult.parameters;
  const timestamp = new Date().toISOString();

  // Normalize intent name
  const normalizedIntent = intent.toLowerCase().replace(/\s+/g, '_');

  // Extract parameters
  const rawEntity = parameters.activity;
  const activity = entityMap[rawEntity] || "unspecified";
  const location = parameters['geo-city'] || "unspecified";
  const needForTutor = parameters['tutor'] ? "Yes" : "No";
  const uuid = uuidv4();

  // ✅ Booking intent
  if (normalizedIntent.startsWith('book_')) {
    try {
      // Log booking to spreadsheet
      await axios.post(SHEETDB_API, {
        data: {
          Location: location,
          Activity: activity,
          UUID: uuid,
          "Need for tutor": needForTutor,
          Timestamp: timestamp
        }
      });

      // Slack card
      const slackCard = {
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
              type: "actions",
              elements: [
                {
                  type: "button",
                  text: { type: "plain_text", text: "View Booking" },
                  url: SPREADSHEET_URL
                },
                {
                  type: "button",
                  text: { type: "plain_text", text: "Cancel Booking" },
                  value: uuid,
                  action_id: "cancel_booking"
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
      };

      // Dialogflow Messenger card
      const dialogflowMessengerCard = {
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
      };

      return res.json({
        fulfillmentMessages: [slackCard, dialogflowMessengerCard]
      });
    } catch (error) {
      console.error("Error logging to spreadsheet:", error.message);
      return res.json({
        fulfillmentText: "Booking confirmed, but we couldn’t log it to the spreadsheet."
      });
    }
  }

  // ❌ Cancel booking intent
  if (normalizedIntent === 'cancel_booking') {
    const cancelUuid = parameters.uuid;

    try {
      await axios.delete(`${SHEETDB_API}/UUID/${cancelUuid}`);
      return res.json({
        fulfillmentText: `❌ Booking with ID ${cancelUuid} has been cancelled.`
      });
    } catch (error) {
      console.error("Error cancelling booking:", error.message);
      return res.json({
        fulfillmentText: "We couldn’t cancel your booking. Please try again."
      });
    }
  }

  // Fallback for unhandled intents
  return res.json({ fulfillmentText: "Intent not handled by webhook." });
});

app.listen(3000, () => console.log('Webhook server running on port 3000'));
