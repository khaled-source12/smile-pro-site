import {
  captureLeadConfirmationToken,
  dispatchLeadConversion,
  markLeadDispatched,
  readPendingLead
} from '../modules/tracking-core.js';

const confirmationToken = captureLeadConfirmationToken();
const lead = readPendingLead(confirmationToken);
if (lead) {
  markLeadDispatched(lead);
  dispatchLeadConversion(lead);
}
