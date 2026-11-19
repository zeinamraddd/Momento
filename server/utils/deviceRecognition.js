import { createHash, randomBytes } from "node:crypto";
import User from "../models/user.js";

const COOKIE_DAYS = 90;
const MAX_DEVICES_PER_USER = 20;

const digest = (value) => createHash("sha256").update(value).digest("hex");

// A token identifies a remembered *browser*, not a device's IP or user agent.
// A separate cookie per account supports friends sharing the same computer.
export async function recognizeDevice(req, res, user) {
  const cookieName = `momento.device.${user._id}`;
  const previousToken = req.cookies?.[cookieName];
  const validToken = typeof previousToken === "string" && /^[a-f0-9]{64}$/.test(previousToken);

  if (validToken) {
    const recognized = await User.exists({
      _id: user._id,
      trustedDeviceHashes: digest(previousToken),
    });
    if (recognized) return false;
  }

  const token = randomBytes(32).toString("hex");
  await User.updateOne(
    { _id: user._id },
    {
      $push: {
        trustedDeviceHashes: {
          $each: [digest(token)],
          $slice: -MAX_DEVICES_PER_USER,
        },
      },
    }
  );

  const crossSite = process.env.COOKIE_CROSS_SITE === "true";
  res.cookie(cookieName, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production" || crossSite,
    sameSite: crossSite ? "none" : "lax",
    maxAge: COOKIE_DAYS * 24 * 60 * 60 * 1000,
    path: "/",
  });

  return true;
}
