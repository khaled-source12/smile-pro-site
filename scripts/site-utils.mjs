import fs from "node:fs";
import { parsePhoneNumberFromString } from "libphonenumber-js/max";

export function deriveContact(phoneE164) {
  const phone = parsePhoneNumberFromString(phoneE164 || "");
  if (!phone?.isValid() || phone.number !== phoneE164) {
    throw new Error("The clinic phone must be a valid E.164 number");
  }

  const localDisplay = phone.country === "EG"
    ? phone.formatNational()
    : phone.formatInternational();

  return {
    phone_e164: phone.number,
    phone_display_en: phone.formatInternational(),
    // Phone numbers remain ASCII/Latin even inside Arabic pages so their
    // reading order and copy/paste behavior stay predictable.
    phone_display_ar: localDisplay,
    whatsapp: phone.number.slice(1),
  };
}

export function readWebpDimensions(file) {
  const data = fs.readFileSync(file);
  if (data.length < 30 || data.toString("ascii", 0, 4) !== "RIFF" || data.toString("ascii", 8, 12) !== "WEBP") {
    throw new Error("invalid WebP header");
  }
  let offset = 12;
  while (offset + 8 <= data.length) {
    const type = data.toString("ascii", offset, offset + 4);
    const size = data.readUInt32LE(offset + 4);
    const start = offset + 8;
    if (start + size > data.length) throw new Error("truncated WebP chunk");
    if (type === "VP8X" && size >= 10) {
      return { width: data.readUIntLE(start + 4, 3) + 1, height: data.readUIntLE(start + 7, 3) + 1 };
    }
    if (type === "VP8 " && size >= 10 && data[start + 3] === 0x9d && data[start + 4] === 0x01 && data[start + 5] === 0x2a) {
      return { width: data.readUInt16LE(start + 6) & 0x3fff, height: data.readUInt16LE(start + 8) & 0x3fff };
    }
    if (type === "VP8L" && size >= 5 && data[start] === 0x2f) {
      const b1 = data[start + 1];
      const b2 = data[start + 2];
      const b3 = data[start + 3];
      const b4 = data[start + 4];
      return {
        width: 1 + b1 + ((b2 & 0x3f) << 8),
        height: 1 + ((b2 & 0xc0) >> 6) + (b3 << 2) + ((b4 & 0x0f) << 10),
      };
    }
    offset = start + size + (size % 2);
  }
  throw new Error("WebP dimensions were not found");
}
