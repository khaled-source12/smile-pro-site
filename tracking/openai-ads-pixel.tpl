___TERMS_OF_SERVICE___

By creating or modifying this file you agree to Google Tag Manager's Community
Template Gallery Developer Terms of Service available at
https://developers.google.com/tag-manager/gallery-tos (or such other URL as
Google may provide), as modified from time to time.

___INFO___

{
  "type": "TAG",
  "id": "cvt_smile_pro_openai_ads",
  "version": 1,
  "securityGroups": [],
  "displayName": "OpenAI Ads Measurement Pixel",
  "brand": {
    "id": "smile_pro_openai_ads",
    "displayName": "OpenAI Ads"
  },
  "description": "Loads the official OpenAI Ads SDK and sends allowlisted standard events. It accepts only a pre-hashed phone value.",
  "containerContexts": ["WEB"]
}

___TEMPLATE_PARAMETERS___

[
  {
    "type": "TEXT",
    "name": "pixelId",
    "displayName": "Pixel ID",
    "simpleValueType": true,
    "valueValidators": [
      { "type": "NON_EMPTY" },
      { "type": "STRING_LENGTH", "args": [1, 128] }
    ],
    "help": "Use the real Pixel ID from OpenAI Ads Manager. Leave the corresponding GTM tag paused until this exists."
  },
  {
    "type": "SELECT",
    "name": "operation",
    "displayName": "Operation",
    "macrosInSelect": false,
    "selectItems": [
      { "value": "initialize", "displayValue": "Initialize only" },
      { "value": "page_viewed", "displayValue": "Page viewed" },
      { "value": "contents_viewed", "displayValue": "Contents viewed" },
      { "value": "lead_created", "displayValue": "Lead created" }
    ],
    "simpleValueType": true,
    "defaultValue": "initialize"
  },
  {
    "type": "TEXT",
    "name": "phoneNumberSha256",
    "displayName": "Phone SHA-256 (digits only)",
    "simpleValueType": true,
    "help": "For lead_created only. Set this to {{DLV - user_data.phone_sha256_digits}}. Never pass a raw phone number."
  },
  {
    "type": "TEXT",
    "name": "eventId",
    "displayName": "Event ID",
    "simpleValueType": true,
    "help": "Set this to {{DLV - event_id}} so a future Conversions API event can be deduplicated."
  },
  {
    "type": "CHECKBOX",
    "name": "debug",
    "checkboxText": "Enable OpenAI SDK debug logging",
    "simpleValueType": true,
    "help": "Enable only in a GTM Preview or Netlify Deploy Preview, never in the live workspace."
  }
]

___SANDBOXED_JS_FOR_WEB_TEMPLATE___

const createArgumentsQueue = require('createArgumentsQueue');
const injectScript = require('injectScript');
const makeString = require('makeString');

const SDK_URL = 'https://bzrcdn.openai.com/sdk/oaiq.min.js';
const pixelId = makeString(data.pixelId || '');
const operation = makeString(data.operation || 'initialize');
const phoneHash = makeString(data.phoneNumberSha256 || '');
const eventId = makeString(data.eventId || '');

if (!pixelId) {
  data.gtmOnFailure();
  return;
}

const oaiq = createArgumentsQueue('oaiq', 'oaiq.q');
if (operation === 'initialize' || operation === 'lead_created') {
  const initOptions = { pixelId: pixelId };
  if (data.debug) initOptions.debug = true;
  if (operation === 'lead_created' && phoneHash.length === 64) {
    initOptions.user = { phone_number_sha256: phoneHash };
  }
  oaiq('init', initOptions);
}

if (operation !== 'initialize') {
  const eventData = {
    type: operation === 'lead_created' ? 'customer_action' : 'contents'
  };
  if (eventId) oaiq('measure', operation, eventData, { event_id: eventId });
  else oaiq('measure', operation, eventData);
}

injectScript(SDK_URL, data.gtmOnSuccess, data.gtmOnFailure, SDK_URL);

___WEB_PERMISSIONS___

[
  {
    "instance": {
      "key": { "publicId": "inject_script", "versionId": "1" },
      "param": [
        {
          "key": "urls",
          "value": {
            "type": 2,
            "listItem": [
              { "type": 1, "string": "https://bzrcdn.openai.com/sdk/oaiq.min.js" }
            ]
          }
        }
      ]
    },
    "clientAnnotations": { "isEditedByUser": true },
    "isRequired": true
  },
  {
    "instance": {
      "key": { "publicId": "access_globals", "versionId": "1" },
      "param": [
        {
          "key": "keys",
          "value": {
            "type": 2,
            "listItem": [
              {
                "type": 3,
                "mapKey": [
                  { "type": 1, "string": "key" },
                  { "type": 1, "string": "read" },
                  { "type": 1, "string": "write" },
                  { "type": 1, "string": "execute" }
                ],
                "mapValue": [
                  { "type": 1, "string": "oaiq" },
                  { "type": 8, "boolean": true },
                  { "type": 8, "boolean": true },
                  { "type": 8, "boolean": true }
                ]
              },
              {
                "type": 3,
                "mapKey": [
                  { "type": 1, "string": "key" },
                  { "type": 1, "string": "read" },
                  { "type": 1, "string": "write" },
                  { "type": 1, "string": "execute" }
                ],
                "mapValue": [
                  { "type": 1, "string": "oaiq.q" },
                  { "type": 8, "boolean": true },
                  { "type": 8, "boolean": true },
                  { "type": 8, "boolean": false }
                ]
              }
            ]
          }
        }
      ]
    },
    "clientAnnotations": { "isEditedByUser": true },
    "isRequired": true
  }
]

___TESTS___

scenarios: []

___NOTES___

This project-owned template intentionally exposes only the official OpenAI SDK URL,
the oaiq queue, four documented operations, an event ID and a pre-hashed phone.
Page and content tags rely on the sequenced Initialize tag; only the lead operation
re-initializes the Pixel to attach request-scoped manual matching data.
Automatic advanced matching must remain disabled in OpenAI Ads Manager.
