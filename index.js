const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const { WebClient } = require('@slack/web-api');

const app = express();
app.use(express.static('public'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const SHEETDB_API = 'https://sheetdb.io/api/v1/y5jawzr5mj38r';
const SPREADSHEET_URL = 'https://docs.google.com/spreadsheets/d/1eU7cn3XBsoTFrMgYKhMOJC-YMqx_usqh1KAYyk4UL30/edit?pli=1&gid=0';
const TICK_IMAGE_URL = 'https://www.clipartkey.com/mpngs/m/230-2305459_green-ticks-png-image-check-mark-transparent-gif.png';

const slackClient = new WebClient(process.env.SLACK_BOT_TOKEN);
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;

app.post('/webhook', async (req, res) => {
  const eventPayload = req.body.originalDetectIntentRequest?.payload?.event;
  const channelId = req.body.originalDetectIntentRequest?.payload?.data?.event?.channel;
  const telegramUserId = req.body.originalDetectIntentRequest?.payload?.data?.event?.user?.id;

  if (eventPayload?.name === 'cancel_booking') {
    const cancelUuid = eventPayload.parameters?.uuid;
    if (!cancelUuid) {
      return res.json({ fulfillmentText: "Missing booking ID. Cannot cancel." });
    }

    try {
      await axios.delete(`${SHEETDB_API}/UUID/${cancelUuid}`);
      return res.json({ fulfillmentText: `✅ Booking with ID ${cancelUuid} has been cancelled.` });
    } catch (error) {
      console.error("Error cancelling booking:", error.message);
      return res.json({ fulfillmentText: "We couldn’t cancel your booking. Please try again." });
    }
  }

  const intent = req.body.queryResult.intent.displayName;
  const parameters = req.body.queryResult.parameters;
  const timestamp = new Date().toISOString();
  const normalizedIntent = intent.toLowerCase().replace(/[\s.]+/g, '_');

  if (normalizedIntent === 'cancel_booking') {
    const cancelUuid = parameters.uuid;
    if (!cancelUuid) {
      return res.json({ fulfillmentText: "Missing booking ID. Cannot cancel." });
    }

    try {
      await axios.delete(`${SHEETDB_API}/UUID/${cancelUuid}`);
      return res.json({ fulfillmentText: `✅ Booking with ID ${cancelUuid} has been cancelled.` });
    } catch (error) {
      console.error("Error cancelling booking:", error.message);
      return res.json({ fulfillmentText: "We couldn’t cancel your booking. Please try again." });
    }
  }

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
  const date = parameters['date-time'].date_time || parameters['date-time'] || "unspecified";
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
          "Booked for date": date,
          "Booked on": timestamp
        }
      });

      if (channelId) {
        await slackClient.chat.postMessage({
          channel: channelId,
          text: `Booking confirmed: ${activity}`,
          blocks: [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `*Your ${activity} booking is confirmed!*\nLocation: *${location}*\nTutor required: *${needForTutor}*\nDate: *${date}*`
              },
              accessory: {
                type: "image",
                image_url: TICK_IMAGE_URL,
                alt_text: "Booking confirmed"
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
                  style: "danger",
                  value: `cancel_booking_${uuid}`
                }
              ]
            }
          ]
        });
      }

      // ✅ Send tick image to Telegram (if user ID is available)
      if (telegramUserId) {
        try {
          await axios.post(`${TELEGRAM_API}/sendPhoto`, {
            chat_id: telegramUserId,
            photo: TICK_IMAGE_URL,
            caption: `✅ Booking confirmed for ${activity} on ${date}`
          });
        } catch (err) {
          console.error("Telegram image send error:", err.message);
        }
      }

      return res.json({
        fulfillmentMessages: [
          {
            platform: "TELEGRAM",
            payload: {
              text: `✅ Booking confirmed for ${activity} on ${date}.\nLocation: ${location}\nTutor: ${needForTutor}\nBooking ID: ${uuid}`,
              reply_markup: {
                inline_keyboard: [
                  [{ text: "View Booking", url: SPREADSHEET_URL }],
                  [{ text: "Cancel Booking", callback_data: `cancel_booking_${uuid}` }]
                ]
              }
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
                    title: `Booking Confirmed: ${activity}`,
                    text: [
                      `Location: ${location}`,
                      `Tutor required: ${needForTutor}`,
                      `Booked for date: ${date}`,
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
                    icon: { type: "cancel" },
                    text: "Cancel Booking",
                    event: {
                      name: "cancel_booking",
                      parameters: { uuid: uuid }
                    }
                  }
                ]
              ]
            }
          }
        ],
        fulfillmentText: "Booking confirmed!"
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
