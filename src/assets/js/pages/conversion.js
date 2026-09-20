import {
  captureLeadConfirmationToken,
  dispatchConfirmedLead,
  readPendingLead
} from '../modules/tracking-core.js';

const confirmationToken = captureLeadConfirmationToken();
const lead = readPendingLead(confirmationToken);
if (lead) {
  dispatchConfirmedLead(lead);
}
